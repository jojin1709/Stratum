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

    const secretKey = services.config.STRATUM_SECRET_KEY ?? services.config.BASEFORGE_SECRET_KEY;
    const publicKey = services.config.STRATUM_PUBLIC_KEY ?? services.config.BASEFORGE_PUBLIC_KEY;

    if (secretKey && raw === secretKey) {
      c.set('keyRole', 'secret');
      c.set('keyId', 'master-secret');
      return await next();
    }

    if (publicKey && raw === publicKey) {
      c.set('keyRole', 'public');
      c.set('keyId', 'master-public');
      return await next();
    }

    const res = await services.db.query<{ id: string; role: string }>(
      `select id, role from stratum.api_keys where key_hash = $1 and revoked_at is null`,
      [hashKey(raw)],
    );

    const row = res.rows[0];
    if (!row) throw err('UNAUTHORIZED', 'Invalid or revoked API key.');

    c.set('keyRole', row.role as KeyRole);
    c.set('keyId', row.id);

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
