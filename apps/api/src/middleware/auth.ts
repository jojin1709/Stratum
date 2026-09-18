import type { MiddlewareHandler } from 'hono';
import { err, hashKey, keyRole, type KeyRole } from '@stratum/shared';
import type { AppEnv, Services } from '../context.js';

export function apiKeyAuth(services: Services): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const raw =
      c.req.header('apikey') ??
      c.req.header('authorization')?.replace(/^bearer\s+/i, '') ??
      c.req.query('apikey');

    if (!raw) {
      throw err('UNAUTHORIZED', 'Missing API key. Pass it in the `apikey` or `Authorization: Bearer` header.');
    }

    const role = keyRole(raw);
    if (!role) throw err('UNAUTHORIZED', 'Malformed API key prefix.');

    const res = await services.db.query<{ id: string; role: string }>(
      `select id, role from stratum.api_keys where key_hash = $1 and revoked_at is null`,
      [hashKey(raw)],
    );

    const row = res.rows[0];
    if (!row) throw err('UNAUTHORIZED', 'Invalid or revoked API key.');

    c.set('keyRole', row.role as KeyRole);
    c.set('keyId', row.id);

    // Update last_used_at asynchronously — never block the request on metadata updates.
    services.db
      .query(`update stratum.api_keys set last_used_at = now() where id = $1`, [row.id])
      .catch(() => {});

    await next();
  };
}

export function requireSecretKey(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    if (c.get('keyRole') !== 'secret') {
      throw err(
        'FORBIDDEN',
        'This operation requires the project secret key. The public key is only allowed to access table rows, objects, functions and realtime channels.',
      );
    }
    await next();
  };
}
