import type { MiddlewareHandler } from 'hono';
import { err } from '@stratum/shared';
import type { AppEnv } from '../context.js';

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * In-memory sliding fixed-window limiter. Keyed by API key ID (or IP for unauthed).
 * For a single-instance container/VM deployment this avoids needing a separate Redis.
 */
export function rateLimit(opts: { windowMs: number; max: number }): MiddlewareHandler<AppEnv> {
  const buckets = new Map<string, Bucket>();

  return async (c, next) => {
    const key =
      c.get('keyId') ??
      c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
      c.req.header('cf-connecting-ip') ??
      'anonymous';

    const now = Date.now();
    let bucket = buckets.get(key);

    if (!bucket || now >= bucket.resetAt) {
      bucket = { count: 0, resetAt: now + opts.windowMs };
      buckets.set(key, bucket);
    }

    bucket.count++;

    c.header('x-ratelimit-limit', String(opts.max));
    c.header('x-ratelimit-remaining', String(Math.max(0, opts.max - bucket.count)));
    c.header('x-ratelimit-reset', String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > opts.max) {
      throw err('RATE_LIMITED', `Rate limit exceeded. Try again in ${Math.ceil((bucket.resetAt - now) / 1000)}s.`);
    }

    await next();
  };
}
