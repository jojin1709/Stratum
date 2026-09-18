import { Hono } from 'hono';
import { disableRealtimeForTable, enableRealtimeForTable, listRealtimeTables } from '@stratum/realtime';
import { assertIdentifier, assertUserSchema } from '@stratum/shared';
import type { AppEnv, Services } from '../context.js';
import { requireSecretKey } from '../middleware/auth.js';

export function realtimeRoutes(services: Services) {
  const app = new Hono<AppEnv>();
  const { db, hub, config } = services;

  app.get('/status', async (c) => {
    const stats = hub.stats();
    return c.json({
      enabled: config.REALTIME_ENABLED,
      endpoint: '/realtime/v1',
      connections: stats.connections,
      channels: stats.channels,
      tables: await listRealtimeTables(db).catch(() => []),
    });
  });

  app.post('/tables', requireSecretKey(), async (c) => {
    const payload = (await c.req.json().catch(() => ({}))) as { schema?: unknown; table?: unknown };
    const schema = assertUserSchema(String(payload.schema ?? 'public'));
    const table = assertIdentifier(String(payload.table ?? ''), 'table');
    await enableRealtimeForTable(db, schema, table);
    return c.json({ enabled: `${schema}.${table}`, channel: `table:${schema}.${table}` }, 201);
  });

  app.delete('/tables/:schema/:table', requireSecretKey(), async (c) => {
    const schema = assertUserSchema(c.req.param('schema'));
    const table = assertIdentifier(c.req.param('table'), 'table');
    await disableRealtimeForTable(db, schema, table);
    return c.json({ disabled: `${schema}.${table}` });
  });

  return app;
}
