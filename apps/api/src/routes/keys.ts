import { Hono } from 'hono';
import { err, generateKey, hashKey, maskKey } from '@stratum/shared';
import type { AppEnv, Services } from '../context.js';
import { requireSecretKey } from '../middleware/auth.js';

export function keyRoutes(services: Services) {
  const router = new Hono<AppEnv>();
  const { db } = services;

  router.use('*', requireSecretKey());

  router.get('/', async (c) => {
    const res = await db.query<{
      id: string; label: string; role: string; key_masked: string;
      created_at: string; last_used_at: string | null; revoked_at: string | null;
    }>(
      `select id, label, role, key_masked, created_at, last_used_at, revoked_at
         from stratum.api_keys order by created_at desc`,
    );
    return c.json({ data: res.rows });
  });

  router.post('/', async (c) => {
    const payload = (await c.req.json().catch(() => ({}))) as { label?: string; role?: string };
    const role = payload.role;
    if (!role || !['public', 'secret'].includes(role)) {
      throw err('VALIDATION_FAILED', '`role` (public | secret) is required.');
    }
    const label = payload.label ?? `${role} key`;

    const raw = generateKey(role as 'public' | 'secret');
    const res = await db.query<{ id: string }>(
      `insert into stratum.api_keys (label, role, key_hash, key_masked) values ($1,$2,$3,$4) returning id`,
      [label, role, hashKey(raw), maskKey(raw)],
    );

    return c.json(
      {
        id: res.rows[0]?.id,
        label,
        role,
        key: raw,
        keyMasked: maskKey(raw),
        warning: 'Save this key now — it will never be displayed again.',
      },
      201,
    );
  });

  router.post('/:id/revoke', async (c) => {
    const id = c.req.param('id');
    const res = await db.query(
      `update stratum.api_keys set revoked_at = now() where id = $1 and revoked_at is null returning id, key_masked`,
      [id],
    );
    if (res.rowCount === 0) throw err('NOT_FOUND', `Key "${id}" not found or already revoked.`);
    return c.json({ ok: true, revokedId: id });
  });

  router.post('/:id/rotate', async (c) => {
    const id = c.req.param('id');
    const current = await db.transaction(async (tx) => {
      const prev = await tx.query<{ label: string; role: 'public' | 'secret' }>(
        `select label, role from stratum.api_keys where id = $1 and revoked_at is null`,
        [id],
      );
      const row = prev.rows[0];
      if (!row) throw err('NOT_FOUND', `Key "${id}" not found or already revoked.`);

      await tx.query(`update stratum.api_keys set revoked_at = now() where id = $1`, [id]);
      const raw = generateKey(row.role);
      const created = await tx.query<{ id: string }>(
        `insert into stratum.api_keys (label, role, key_hash, key_masked) values ($1,$2,$3,$4) returning id`,
        [row.label, row.role, hashKey(raw), maskKey(raw)],
      );
      return { id: created.rows[0]?.id, label: row.label, role: row.role, key: raw, keyMasked: maskKey(raw) };
    });

    return c.json({ ...current, warning: 'Save this key now — it will never be displayed again.' }, 201);
  });

  return router;
}
