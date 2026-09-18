import { Hono } from 'hono';
import { err } from '@stratum/shared';
import type { AppEnv, Services } from '../context.js';
import { requireSecretKey } from '../middleware/auth.js';

/**
 * The SQL editor endpoint. It is deliberately secret-key-only: it runs arbitrary SQL
 * with the database role's full privileges, so exposing it to a browser key would make
 * the public/secret split meaningless.
 */
export function sqlRoutes(services: Services) {
  const app = new Hono<AppEnv>();
  const { db } = services;

  app.post('/query', requireSecretKey(), async (c) => {
    let payload: { sql?: unknown; params?: unknown; readOnly?: unknown };
    try {
      payload = (await c.req.json()) as typeof payload;
    } catch {
      throw err('BAD_REQUEST', 'Request body must be valid JSON.');
    }

    const sql = payload.sql;
    if (typeof sql !== 'string' || sql.trim() === '') throw err('VALIDATION_FAILED', '`sql` must be a non-empty string.');
    if (sql.length > 100_000) throw err('PAYLOAD_TOO_LARGE', 'Query exceeds 100,000 characters.');

    const params = Array.isArray(payload.params) ? payload.params : [];

    // read-only runs inside an aborted transaction, so an accidental write cannot land.
    if (payload.readOnly === true) {
      const result = await db.transaction(async (tx) => {
        await tx.query('SET TRANSACTION READ ONLY');
        return tx.query(sql, params);
      });
      return c.json(serialise(result));
    }

    return c.json(serialise(await db.query(sql, params)));
  });

  app.get('/history', requireSecretKey(), async (c) => {
    const limit = Math.min(Number(c.req.query('limit') ?? 50), 200);
    const res = await db.query(
      `select id, at, method, path, status, duration_ms
         from stratum.request_logs
        where path like '/api/v1/rpc/%'
        order by at desc limit $1`,
      [limit],
    );
    return c.json({ data: res.rows });
  });

  return app;
}

function serialise(result: { rows: unknown[]; rowCount: number; fields: { name: string }[]; command: string; durationMs: number }) {
  return {
    rows: result.rows,
    rowCount: result.rowCount,
    columns: result.fields.map((f) => f.name),
    command: result.command,
    durationMs: result.durationMs,
  };
}
