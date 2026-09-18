import { Hono } from 'hono';
import { discoverFunctions } from '@stratum/functions';
import { err } from '@stratum/shared';
import type { AppEnv, Services } from '../context.js';
import { requireSecretKey } from '../middleware/auth.js';

export function functionRoutes(services: Services) {
  const app = new Hono<AppEnv>();
  const { config, functions, db } = services;

  app.get('/', async (c) => {
    const found = await discoverFunctions(config.FUNCTIONS_DIR);
    const deployed = await db.query<{ name: string; target: string; deployed_at: string | null; invocations: number }>(
      `select name, target, deployed_at, invocations from stratum.functions`,
    );
    const byName = new Map(deployed.rows.map((r) => [r.name, r]));

    return c.json({
      dir: config.FUNCTIONS_DIR,
      data: found.map((f) => ({
        name: f.name,
        entrypoint: f.entrypoint,
        workerCompatible: f.compatIssues.length === 0,
        compatIssues: f.compatIssues,
        target: byName.get(f.name)?.target ?? 'local',
        deployedAt: byName.get(f.name)?.deployed_at ?? null,
        invocations: Number(byName.get(f.name)?.invocations ?? 0),
      })),
    });
  });

  app.all('/:name', async (c) => {
    const name = c.req.param('name');
    const started = performance.now();

    const request = new Request(c.req.url, {
      method: c.req.method,
      headers: c.req.raw.headers,
      ...(c.req.method === 'GET' || c.req.method === 'HEAD' ? {} : { body: await c.req.arrayBuffer() }),
    });

    try {
      const result = await functions.invoke(name, request);
      const durationMs = Math.round(performance.now() - started);
      void db
        .query(
          `insert into stratum.functions (name, entrypoint, invocations) values ($1,$2,1)
             on conflict (name) do update set invocations = stratum.functions.invocations + 1`,
          [name, `${config.FUNCTIONS_DIR}/${name}/index.ts`],
        )
        .catch(() => {});
      for (const log of result.logs) {
        void db
          .query(`insert into stratum.function_logs (function, level, message, duration_ms) values ($1,$2,$3,$4)`,
            [name, log.level, log.message, durationMs])
          .catch(() => {});
      }
      return result.response;
    } catch (e) {
      void db
        .query(
          `insert into stratum.functions (name, entrypoint, last_error) values ($1,$2,$3)
             on conflict (name) do update set last_error = excluded.last_error`,
          [name, `${config.FUNCTIONS_DIR}/${name}/index.ts`, String(e)],
        )
        .catch(() => {});
      throw e;
    }
  });

  app.post('/:name/reload', requireSecretKey(), async (c) => {
    functions.invalidate(c.req.param('name'));
    return c.json({ reloaded: c.req.param('name') });
  });

  app.get('/:name/logs', requireSecretKey(), async (c) => {
    const limit = Math.min(Number(c.req.query('limit') ?? 100), 500);
    const res = await db.query(
      `select at, level, message, duration_ms from stratum.function_logs
        where function = $1 order by at desc limit $2`,
      [c.req.param('name'), limit],
    );
    if (res.rowCount === 0) {
      const found = await discoverFunctions(config.FUNCTIONS_DIR);
      if (!found.some((f) => f.name === c.req.param('name'))) {
        throw err('FUNCTION_NOT_FOUND', `No function named "${c.req.param('name')}".`);
      }
    }
    return c.json({ data: res.rows });
  });

  return app;
}
