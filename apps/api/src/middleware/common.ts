import type { Context, ErrorHandler, MiddlewareHandler } from 'hono';
import { err, toErrorResponse } from '@stratum/shared';
import type { AppEnv, Services } from '../context.js';

export function errorHandler(services: Services): ErrorHandler<AppEnv> {
  return (e, c) => {
    const { status, body } = toErrorResponse(e, services.config.isProduction);
    if (status >= 500) {
      services.logger.error('unhandled error', { error: e instanceof Error ? e.stack ?? e.message : String(e) });
    }
    return c.json(body, status as never);
  };
}

export function securityHeaders(): MiddlewareHandler {
  return async (c, next) => {
    await next();
    c.header('x-content-type-options', 'nosniff');
    c.header('x-frame-options', 'DENY');
    c.header('referrer-policy', 'no-referrer');
  };
}

export function corsFor(allowedOrigins: string[]): MiddlewareHandler {
  const allowAll = allowedOrigins.includes('*');
  const origins = new Set(allowedOrigins);

  return async (c, next) => {
    const reqOrigin = c.req.header('origin');
    const allow = allowAll ? '*' : reqOrigin && origins.has(reqOrigin) ? reqOrigin : undefined;

    if (c.req.method === 'OPTIONS') {
      const headers = new Headers();
      if (allow) headers.set('access-control-allow-origin', allow);
      headers.set('access-control-allow-methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD');
      headers.set('access-control-allow-headers', 'apikey, authorization, content-type, content-range, range');
      headers.set('access-control-expose-headers', 'content-range, x-total-count, x-response-time');
      headers.set('access-control-max-age', '86400');
      return new Response(null, { status: 204, headers });
    }

    await next();
    if (allow) c.header('access-control-allow-origin', allow);
    c.header('access-control-expose-headers', 'content-range, x-total-count, x-response-time');
  };
}

export function requestLogger(services: Services): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const started = performance.now();
    c.set('startedAt', started);
    await next();
    const duration = Math.round((performance.now() - started) * 100) / 100;
    c.header('x-response-time', `${duration}ms`);

    const path = new URL(c.req.url).pathname;
    if (path !== '/health') {
      services.db
        .query(
          `insert into stratum.request_logs (method, path, status, duration_ms, key_id) values ($1,$2,$3,$4,$5)`,
          [c.req.method, path, c.res.status, Math.round(duration), c.get('keyId') ?? null],
        )
        .catch(() => {});
    }
  };
}

export function bodyLimit(maxBytes: number): MiddlewareHandler {
  return async (c, next) => {
    const len = c.req.header('content-length');
    if (len && Number(len) > maxBytes) {
      throw err('PAYLOAD_TOO_LARGE', `Request body exceeds limit of ${maxBytes} bytes.`);
    }
    await next();
  };
}
