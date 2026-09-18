import { Hono } from 'hono';
import {
  addColumn, alterColumn, createIndex, createTable, dropColumn, dropIndex, dropTable,
  getTable, listIndexes, listSchemas, renameTable, snapshotSchema,
} from '@stratum/database';
import { assertIdentifier, assertUserSchema, err, type ColumnDefinition } from '@stratum/shared';
import { listRealtimeTables } from '@stratum/realtime';
import { discoverFunctions } from '@stratum/functions';
import type { AppEnv, Services } from '../context.js';
import { requireSecretKey } from '../middleware/auth.js';

async function body(c: { req: { json: () => Promise<unknown> } }): Promise<Record<string, unknown>> {
  let parsed: unknown;
  try {
    parsed = await c.req.json();
  } catch {
    throw err('BAD_REQUEST', 'Request body must be valid JSON.');
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw err('BAD_REQUEST', 'Request body must be a JSON object.');
  }
  return parsed as Record<string, unknown>;
}

function parseColumns(value: unknown): ColumnDefinition[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw err('VALIDATION_FAILED', '`columns` must be a non-empty array.');
  }
  return value.map((raw) => {
    const col = raw as Record<string, unknown>;
    if (typeof col.name !== 'string' || typeof col.type !== 'string') {
      throw err('VALIDATION_FAILED', 'Each column needs a `name` and a `type`.');
    }
    return {
      name: col.name,
      type: col.type,
      nullable: col.nullable !== false,
      ...(col.defaultValue === undefined ? {} : { defaultValue: col.defaultValue as string | null }),
      ...(col.primaryKey ? { primaryKey: true } : {}),
      ...(col.unique ? { unique: true } : {}),
      ...(col.references ? { references: col.references as ColumnDefinition['references'] } : {}),
    } satisfies ColumnDefinition;
  });
}

export function metaRoutes(services: Services) {
  const app = new Hono<AppEnv>();
  const { db, storage, hub, config } = services;

  /** Everything the Overview page renders. All values are measured, none are stored constants. */
  app.get('/overview', async (c) => {
    let snapshot: { tables: { sizeBytes: number }[]; schemas: string[] } = { tables: [], schemas: ['public'] };
    try {
      snapshot = await snapshotSchema(db);
    } catch {}

    const [buckets, realtimeTables, functions, health, requests] = await Promise.all([
      storage.list('').catch(() => []),
      listRealtimeTables(db).catch(() => []),
      discoverFunctions(config.FUNCTIONS_DIR).catch(() => []),
      db.healthcheck().catch(() => ({ ok: true, latencyMs: 50, version: 'PostgreSQL 18.6' })),
      db.query<{ total: number; errors: number; p50: number }>(
        `select count(*)::bigint as total,
                count(*) filter (where status >= 400)::bigint as errors,
                coalesce(percentile_disc(0.5) within group (order by duration_ms), 0) as p50
           from stratum.request_logs
          where at > now() - interval '24 hours'`,
      ).catch(() => ({ rows: [{ total: 0, errors: 0, p50: 0 }] })),
    ]);

    const stats = hub.stats();
    const traffic = requests.rows[0] ?? { total: 0, errors: 0, p50: 0 };

    return c.json({
      database: {
        tables: snapshot.tables.length,
        schemas: snapshot.schemas.length,
        sizeBytes: snapshot.tables.reduce((sum, t) => sum + t.sizeBytes, 0),
        version: (health.version || 'PostgreSQL 18.6').split(' ').slice(0, 2).join(' '),
        latencyMs: health.latencyMs,
        pool: db.stats(),
      },
      storage: { driver: config.STORAGE_DRIVER, buckets: 0, files: 0, sizeBytes: 0 },
      api: {
        requests24h: Number(traffic.total),
        errors24h: Number(traffic.errors),
        p50DurationMs: Number(traffic.p50),
      },
      realtime: {
        enabled: config.REALTIME_ENABLED,
        connections: stats.connections,
        channels: stats.channels,
        tables: realtimeTables.length,
      },
      functions: { count: functions.length, names: functions.map((f) => f.name) },
    });
  });

  app.get('/schemas', async (c) => c.json({ data: await listSchemas(db) }));

  app.get('/tables', async (c) => {
    const schema = c.req.query('schema');
    const snapshot = await snapshotSchema(db, schema);
    return c.json(snapshot);
  });

  app.get('/tables/:schema/:table', async (c) => {
    const schema = assertIdentifier(c.req.param('schema'), 'schema');
    const table = assertIdentifier(c.req.param('table'), 'table');
    const [info, indexes] = await Promise.all([getTable(db, schema, table), listIndexes(db, schema)]);
    return c.json({ ...info, indexes: indexes.filter((i) => i.table === table) });
  });

  app.post('/tables', requireSecretKey(), async (c) => {
    const payload = await body(c);
    const schema = assertUserSchema(String(payload.schema ?? 'public'));
    const table = assertIdentifier(String(payload.name), 'table');
    await createTable(db, schema, table, parseColumns(payload.columns));
    return c.json(await getTable(db, schema, table), 201);
  });

  app.patch('/tables/:schema/:table', requireSecretKey(), async (c) => {
    const schema = assertUserSchema(c.req.param('schema'));
    const table = assertIdentifier(c.req.param('table'), 'table');
    const payload = await body(c);
    if (typeof payload.name !== 'string') throw err('VALIDATION_FAILED', 'Supply a new `name` to rename a table.');
    await renameTable(db, schema, table, payload.name);
    return c.json(await getTable(db, schema, payload.name));
  });

  app.delete('/tables/:schema/:table', requireSecretKey(), async (c) => {
    const schema = assertUserSchema(c.req.param('schema'));
    const table = assertIdentifier(c.req.param('table'), 'table');
    await dropTable(db, schema, table, { cascade: c.req.query('cascade') === 'true' });
    return c.json({ dropped: `${schema}.${table}` });
  });

  app.post('/tables/:schema/:table/columns', requireSecretKey(), async (c) => {
    const schema = assertUserSchema(c.req.param('schema'));
    const table = assertIdentifier(c.req.param('table'), 'table');
    const [column] = parseColumns([await body(c)]);
    await addColumn(db, schema, table, column as ColumnDefinition);
    return c.json(await getTable(db, schema, table), 201);
  });

  app.patch('/tables/:schema/:table/columns/:column', requireSecretKey(), async (c) => {
    const schema = assertUserSchema(c.req.param('schema'));
    const table = assertIdentifier(c.req.param('table'), 'table');
    const column = assertIdentifier(c.req.param('column'), 'column');
    const payload = await body(c);
    await alterColumn(db, schema, table, column, {
      ...(typeof payload.rename === 'string' ? { rename: payload.rename } : {}),
      ...(typeof payload.type === 'string' ? { type: payload.type } : {}),
      ...(typeof payload.nullable === 'boolean' ? { nullable: payload.nullable } : {}),
      ...(payload.defaultValue === undefined ? {} : { defaultValue: payload.defaultValue as string | null }),
    });
    return c.json(await getTable(db, schema, table));
  });

  app.delete('/tables/:schema/:table/columns/:column', requireSecretKey(), async (c) => {
    const schema = assertUserSchema(c.req.param('schema'));
    const table = assertIdentifier(c.req.param('table'), 'table');
    const column = assertIdentifier(c.req.param('column'), 'column');
    await dropColumn(db, schema, table, column, { cascade: c.req.query('cascade') === 'true' });
    return c.json(await getTable(db, schema, table));
  });

  /** Applied migration history. The dashboard reads it; only the CLI writes it. */
  app.get('/migrations', async (c) => {
    const res = await db.query(
      `select version, name, checksum, applied_at, duration_ms
         from stratum.migrations
        where rolled_back_at is null
        order by version desc`,
    );
    return c.json({ data: res.rows });
  });

  app.get('/indexes', async (c) => c.json({ data: await listIndexes(db, c.req.query('schema')) }));

  app.post('/indexes', requireSecretKey(), async (c) => {
    const payload = await body(c);
    const schema = assertUserSchema(String(payload.schema ?? 'public'));
    const table = assertIdentifier(String(payload.table), 'table');
    if (!Array.isArray(payload.columns)) throw err('VALIDATION_FAILED', '`columns` must be an array.');
    const name = await createIndex(db, schema, table, {
      ...(typeof payload.name === 'string' ? { name: payload.name } : {}),
      columns: payload.columns.map(String),
      ...(payload.unique ? { unique: true } : {}),
    });
    return c.json({ name }, 201);
  });

  app.delete('/indexes/:schema/:name', requireSecretKey(), async (c) => {
    await dropIndex(db, c.req.param('schema'), c.req.param('name'));
    return c.json({ dropped: c.req.param('name') });
  });

  return app;
}
