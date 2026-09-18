import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export const PUBLIC_KEY_PREFIX = 'strat_public_';
export const SECRET_KEY_PREFIX = 'strat_secret_';

// Backward compatibility prefixes
export const LEGACY_PUBLIC_KEY_PREFIX = 'bf_public_';
export const LEGACY_SECRET_KEY_PREFIX = 'bf_secret_';

export type KeyRole = 'public' | 'secret';

export function generateKey(role: KeyRole): string {
  const prefix = role === 'public' ? PUBLIC_KEY_PREFIX : SECRET_KEY_PREFIX;
  return prefix + randomBytes(24).toString('base64url');
}

export function keyRole(key: string): KeyRole | null {
  if (key.startsWith(PUBLIC_KEY_PREFIX) || key.startsWith(LEGACY_PUBLIC_KEY_PREFIX)) return 'public';
  if (key.startsWith(SECRET_KEY_PREFIX) || key.startsWith(LEGACY_SECRET_KEY_PREFIX)) return 'secret';
  return null;
}

/** Stored form. Raw keys are never persisted. */
export function hashKey(key: string): string {
  return createHash('sha256').update(key, 'utf8').digest('hex');
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/** Display form for dashboards/logs — enough to identify, not enough to use. */
export function maskKey(key: string): string {
  const role = keyRole(key);
  if (!role) return '••••';
  const prefix = key.startsWith(PUBLIC_KEY_PREFIX)
    ? PUBLIC_KEY_PREFIX
    : key.startsWith(SECRET_KEY_PREFIX)
      ? SECRET_KEY_PREFIX
      : key.startsWith(LEGACY_PUBLIC_KEY_PREFIX)
        ? LEGACY_PUBLIC_KEY_PREFIX
        : LEGACY_SECRET_KEY_PREFIX;
  const body = key.slice(prefix.length);
  return `${prefix}${body.slice(0, 4)}…${body.slice(-4)}`;
}
