import { Hono } from 'hono';
import {
  buildDelete, buildInsert, buildUpdate, getTable, parseListParams, selectRows,
} from '@stratum/database';
import { assertIdentifier, err } from '@stratum/shared';
import type { AppEnv, Services } from '../context.js';

/**
 * Automatic CRUD over any table in an exposed schema.
 * Table and column names are validated against live introspection; every value
 * the caller supplies is passed as a bound parameter.
 */
export function restRoutes(services: Services) {
  const app = new Hono<AppEnv>();
  const { db } = services;

  const schemaOf = (c: { req: { query: (k: string) => string | undefined } }) =>
    assertIdentifier(c.req.query('schema') ?? 'public', 'schema');

  const jsonBody = async (c: { req: { json: () => Promise<unknown> } }): Promise<unknown> => {
    try {
      return await c.req.json();
    } catch {
      throw err('BAD_REQUEST', 'Request body must be valid JSON.');
    }
  };

  app.get('/:table', async (c) => {
    const schema = schemaOf(c);
    const table = assertIdentifier(c.req.param('table'), 'table');
    const url = new URL(c.req.url);
    url.searchParams.delete('schema');
    const page = await selectRows(db, schema, table, url.searchParams);
    if (page.count !== null) c.header('content-range', `${page.offset}-${page.offset + page.data.length - 1}/${page.count}`);
    return c.json(page);
  });

  app.get('/:table/:id', async (c) => {
    const schema = schemaOf(c);
    const table = assertIdentifier(c.req.param('table'), 'table');
    const info = await getTable(db, schema, table);
    const pk = info.primaryKey[0];
    if (!pk) throw err('BAD_REQUEST', `Table "${schema}.${table}" has no primary key, so it has no /:id route.`);

    const params = new URLSearchParams({ limit: '1' });
    params.set(pk, `eq.${c.req.param('id')}`);
    const page = await selectRows(db, schema, table, params);
    const row = page.data[0];
    if (!row) throw err('NOT_FOUND', `No row in "${schema}.${table}" with ${pk} = ${c.req.param('id')}.`);
    return c.json(row);
  });

  app.post('/:table', async (c) => {
    const schema = schemaOf(c);
    const table = assertIdentifier(c.req.param('table'), 'table');
    const info = await getTable(db, schema, table);
    const payload = await jsonBody(c);
    const rows = (Array.isArray(payload) ? payload : [payload]) as Record<string, unknown>[];
    if (rows.some((r) => typeof r !== 'object' || r === null)) {
      throw err('VALIDATION_FAILED', 'Insert body must be an object or an array of objects.');
    }
    if (rows.length > 1000) throw err('PAYLOAD_TOO_LARGE', 'At most 1000 rows may be inserted per request.');

    const q = buildInsert(schema, table, rows, new Set(info.columns.map((col) => col.name)));
    const res = await db.query(q.text, q.params);
    return c.json({ data: res.rows, count: res.rowCount }, 201);
  });

  app.patch('/:table', async (c) => {
    const schema = schemaOf(c);
    const table = assertIdentifier(c.req.param('table'), 'table');
    const info = await getTable(db, schema, table);
    const url = new URL(c.req.url);
    url.searchParams.delete('schema');
    const { filters } = parseListParams(url.searchParams, info);

    const patch = (await jsonBody(c)) as Record<string, unknown>;
    if (typeof patch !== 'object' || patch === null || Array.isArray(patch)) {
      throw err('VALIDATION_FAILED', 'Update body must be a JSON object.');
    }

    const q = buildUpdate(schema, table, patch, filters, new Set(info.columns.map((col) => col.name)));
    const res = await db.query(q.text, q.params);
    return c.json({ data: res.rows, count: res.rowCount });
  });

  app.patch('/:table/:id', async (c) => {
    const schema = schemaOf(c);
    const table = assertIdentifier(c.req.param('table'), 'table');
    const info = await getTable(db, schema, table);
    const pk = info.primaryKey[0];
    if (!pk) throw err('BAD_REQUEST', `Table "${schema}.${table}" has no primary key.`);

    const patch = (await jsonBody(c)) as Record<string, unknown>;
    const q = buildUpdate(
      schema, table, patch,
      [{ column: pk, operator: 'eq', value: c.req.param('id') }],
      new Set(info.columns.map((col) => col.name)),
    );
    const res = await db.query(q.text, q.params);
    const row = res.rows[0];
    if (!row) throw err('NOT_FOUND', `No row in "${schema}.${table}" with ${pk} = ${c.req.param('id')}.`);
    return c.json(row);
  });

  app.delete('/:table', async (c) => {
    const schema = schemaOf(c);
    const table = assertIdentifier(c.req.param('table'), 'table');
    const info = await getTable(db, schema, table);
    const url = new URL(c.req.url);
    url.searchParams.delete('schema');
    const { filters } = parseListParams(url.searchParams, info);

    const q = buildDelete(schema, table, filters);
    const res = await db.query(q.text, q.params);
    return c.json({ data: res.rows, count: res.rowCount });
  });

  app.delete('/:table/:id', async (c) => {
    const schema = schemaOf(c);
    const table = assertIdentifier(c.req.param('table'), 'table');
    const info = await getTable(db, schema, table);
    const pk = info.primaryKey[0];
    if (!pk) throw err('BAD_REQUEST', `Table "${schema}.${table}" has no primary key.`);

    const q = buildDelete(schema, table, [{ column: pk, operator: 'eq', value: c.req.param('id') }]);
    const res = await db.query(q.text, q.params);
    if (res.rowCount === 0) throw err('NOT_FOUND', `No row in "${schema}.${table}" with ${pk} = ${c.req.param('id')}.`);
    return c.body(null, 204);
  });

  return app;
}
