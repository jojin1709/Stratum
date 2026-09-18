import { Hono } from 'hono';
import type { AppEnv, Services } from '../context.js';
import { requireSecretKey } from '../middleware/auth.js';

export function logRoutes(services: Services) {
  const router = new Hono<AppEnv>();
  const { db } = services;

  router.use('*', requireSecretKey());

  router.get('/requests', async (c) => {
    const limit = Math.min(1000, Math.max(1, Number(c.req.query('limit') ?? 50)));
    const res = await db.query(
      `select id, at, method, path, status, duration_ms, key_id, source
         from stratum.request_logs order by at desc limit $1`,
      [limit],
    );
    return c.json({ data: res.rows });
  });

  router.get('/functions', async (c) => {
    const limit = Math.min(1000, Math.max(1, Number(c.req.query('limit') ?? 50)));
    const fn = c.req.query('function');
    if (fn) {
      const res = await db.query(
        `select id, at, function, level, message, duration_ms
           from stratum.function_logs where function = $1 order by at desc limit $2`,
        [fn, limit],
      );
      return c.json({ data: res.rows });
    }
    const res = await db.query(
      `select id, at, function, level, message, duration_ms
         from stratum.function_logs order by at desc limit $1`,
      [limit],
    );
    return c.json({ data: res.rows });
  });

  router.get('/metrics', async (c) => {
    const [requests, errors, p95] = await Promise.all([
      db.query<{ count: number }>(`select count(*)::int as count from stratum.request_logs where at > now() - interval '24 hours'`),
      db.query<{ count: number }>(`select count(*)::int as count from stratum.request_logs where status >= 500 and at > now() - interval '24 hours'`),
      db.query<{ p95: number }>(
        `select coalesce(percentile_cont(0.95) within group (order by duration_ms), 0)::float as p95
           from stratum.request_logs where at > now() - interval '24 hours'`,
      ),
    ]);

    return c.json({
      last24Hours: {
        totalRequests: requests.rows[0]?.count ?? 0,
        errors: errors.rows[0]?.count ?? 0,
        p95DurationMs: Math.round((p95.rows[0]?.p95 ?? 0) * 10) / 10,
      },
    });
  });

  return router;
}
