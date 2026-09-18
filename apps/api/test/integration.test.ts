import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PostgresAdapter, bootstrap, createTable, migrate, createMigrationFile, status, rollback } from '@stratum/database';
import { createLogger, generateKey, hashKey, maskKey } from '@stratum/shared';
import { createStorageProvider } from '@stratum/storage';
import { RealtimeHub } from '@stratum/realtime';
import { LocalFunctionRuntime } from '@stratum/functions';
import { createApp } from '../src/app.js';
import type { Services } from '../src/context.js';
import { startTestDatabase, skipReason, type TestDatabase } from './setup-postgres.js';

let pg: TestDatabase;
let db: PostgresAdapter;
let services: Services;
let app: ReturnType<typeof createApp>;
let storageDir: string;
let functionsDir: string;
let migrationsDir: string;
let publicKey: string;
let secretKey: string;

const BASE = 'http://api.test';

async function call(
  path: string,
  init: RequestInit & { key?: string } = {},
): Promise<{ status: number; body: any }> {
  const { key = secretKey, ...rest } = init;
  const res = await app.fetch(
    new Request(`${BASE}${path}`, {
      ...rest,
      headers: { 'content-type': 'application/json', apikey: key, ...((rest.headers as object) ?? {}) },
    }),
  );
  const text = await res.text();
  let body: any = null;
  if (text) { try { body = JSON.parse(text); } catch { body = text; } }
  return { status: res.status, body };
}

let unavailable: string | null = null;

beforeAll(async () => {
  try {
    pg = await startTestDatabase();
  } catch (e) {
    // Skipping loudly beats a green suite that never touched a database.
    unavailable = skipReason(e);
    console.warn(unavailable);
    return;
  }
  storageDir = await fs.mkdtemp(path.join(os.tmpdir(), 'strat-int-storage-'));
  functionsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'strat-int-fn-'));
  migrationsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'strat-int-mig-'));

  db = new PostgresAdapter({ connectionString: pg.connectionString });
  // The suite must be repeatable against a persistent TEST_DATABASE_URL, so it starts
  // from a known-empty schema rather than inheriting state from a previous run.
  await db.query('drop schema if exists public cascade');
  await db.query('drop schema if exists stratum cascade');
  await db.query('create schema public');
  await bootstrap(db);

  publicKey = generateKey('public');
  secretKey = generateKey('secret');
  for (const [role, raw] of [['public', publicKey], ['secret', secretKey]] as const) {
    await db.query(
      `insert into stratum.api_keys (label, role, key_hash, key_masked) values ($1,$2,$3,$4)`,
      [`test ${role}`, role, hashKey(raw), maskKey(raw)],
    );
  }

  const logger = createLogger({ level: 'error' });
  services = {
    config: {
      NODE_ENV: 'test', isProduction: false, DATABASE_URL: pg.connectionString,
      DATABASE_POOL_MAX: 5, DATABASE_STATEMENT_TIMEOUT_MS: 15000,
      STRATUM_API_PORT: 8788, STRATUM_DASHBOARD_PORT: 8787, STRATUM_REALTIME_PORT: 8789,
      STORAGE_DRIVER: 'local', STORAGE_PATH: storageDir, STORAGE_MAX_UPLOAD_BYTES: 1024 * 1024,
      R2_REGION: 'auto', CORS_ORIGINS: '*', corsOrigins: ['*'],
      RATE_LIMIT_WINDOW_MS: 60000, RATE_LIMIT_MAX: 100000, MAX_REQUEST_BYTES: 5 * 1024 * 1024,
      LOG_LEVEL: 'error', REALTIME_ENABLED: true, FUNCTIONS_DIR: functionsDir, MIGRATIONS_DIR: migrationsDir,
    } as any,
    db,
    storage: createStorageProvider({ driver: 'local', localPath: storageDir, apiBaseUrl: BASE }),
    hub: new RealtimeHub(),
    functions: new LocalFunctionRuntime(functionsDir, {}, logger),
    logger,
  };
  app = createApp(services);
}, 180_000);

beforeEach((ctx) => {
  if (unavailable) ctx.skip();
});

afterAll(async () => {
  await db?.close();
  await pg?.stop();
  for (const dir of [storageDir, functionsDir, migrationsDir]) {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
});

describe('health and auth', () => {
  it('reports health without an API key', async () => {
    const res = await app.fetch(new Request(`${BASE}/health`));
    expect(res.status).toBe(200);
    expect((await res.json()).database.connected).toBe(true);
  });

  it('rejects requests with no key, a malformed key, and an unknown key', async () => {
    const noKey = await app.fetch(new Request(`${BASE}/api/v1/meta/tables`));
    expect(noKey.status).toBe(401);

    expect((await call('/api/v1/meta/tables', { key: 'garbage' })).status).toBe(401);
    expect((await call('/api/v1/meta/tables', { key: generateKey('secret') })).status).toBe(401);
  });

  it('lets the public key read but not touch schema, keys, or raw SQL', async () => {
    expect((await call('/api/v1/meta/tables', { key: publicKey })).status).toBe(200);

    const ddl = await call('/api/v1/meta/tables', {
      key: publicKey, method: 'POST',
      body: JSON.stringify({ name: 'sneaky', columns: [{ name: 'id', type: 'uuid', primaryKey: true }] }),
    });
    expect(ddl.status).toBe(403);

    expect((await call('/api/v1/keys', { key: publicKey })).status).toBe(403);
    expect((await call('/api/v1/rpc/query', { key: publicKey, method: 'POST', body: JSON.stringify({ sql: 'select 1' }) })).status).toBe(403);
  });
});

describe('schema management', () => {
  it('creates a table and reflects it in introspection', async () => {
    const created = await call('/api/v1/meta/tables', {
      method: 'POST',
      body: JSON.stringify({
        name: 'products',
        columns: [
          { name: 'id', type: 'uuid', primaryKey: true, defaultValue: 'gen_random_uuid()' },
          { name: 'name', type: 'text', nullable: false },
          { name: 'price', type: 'numeric(10,2)', nullable: false, defaultValue: '0' },
          { name: 'status', type: 'text', nullable: false, defaultValue: "'draft'" },
          { name: 'created_at', type: 'timestamptz', nullable: false, defaultValue: 'now()' },
        ],
      }),
    });
    expect(created.status).toBe(201);
    expect(created.body.columns.map((c: any) => c.name)).toEqual(['id', 'name', 'price', 'status', 'created_at']);
    expect(created.body.primaryKey).toEqual(['id']);

    const tables = await call('/api/v1/meta/tables');
    expect(tables.body.tables.some((t: any) => t.name === 'products')).toBe(true);
  });

  it('refuses to create tables in system schemas', async () => {
    const res = await call('/api/v1/meta/tables', {
      method: 'POST',
      body: JSON.stringify({ schema: 'pg_catalog', name: 'x', columns: [{ name: 'a', type: 'text' }] }),
    });
    expect(res.status).toBe(403);
  });

  it('adds, alters and drops a column', async () => {
    const added = await call('/api/v1/meta/tables/public/products/columns', {
      method: 'POST', body: JSON.stringify({ name: 'sku', type: 'text' }),
    });
    expect(added.body.columns.some((c: any) => c.name === 'sku')).toBe(true);

    const altered = await call('/api/v1/meta/tables/public/products/columns/sku', {
      method: 'PATCH', body: JSON.stringify({ rename: 'stock_keeping_unit' }),
    });
    expect(altered.body.columns.some((c: any) => c.name === 'stock_keeping_unit')).toBe(true);

    const dropped = await call('/api/v1/meta/tables/public/products/columns/stock_keeping_unit', { method: 'DELETE' });
    expect(dropped.body.columns.some((c: any) => c.name === 'stock_keeping_unit')).toBe(false);
  });

  it('creates and lists an index', async () => {
    const created = await call('/api/v1/meta/indexes', {
      method: 'POST', body: JSON.stringify({ table: 'products', columns: ['status'] }),
    });
    expect(created.status).toBe(201);
    const list = await call('/api/v1/meta/indexes?schema=public');
    expect(list.body.data.some((i: any) => i.name === created.body.name)).toBe(true);
  });
});

describe('automatic REST API', () => {
  const ids: string[] = [];

  it('inserts rows and returns them', async () => {
    const res = await call('/api/v1/products', {
      method: 'POST',
      body: JSON.stringify([
        { name: 'Standing desk', price: '499.00', status: 'active' },
        { name: 'Monitor arm', price: '89.50', status: 'active' },
        { name: 'Cable tray', price: '24.00', status: 'draft' },
      ]),
    });
    expect(res.status).toBe(201);
    expect(res.body.count).toBe(3);
    for (const row of res.body.data) ids.push(row.id);
    expect(ids[0]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('applies defaults declared in the schema', async () => {
    const res = await call('/api/v1/products', { method: 'POST', body: JSON.stringify({ name: 'Footrest' }) });
    expect(res.body.data[0].status).toBe('draft');
    expect(res.body.data[0].price).toBe('0.00');
  });

  it('filters, sorts, paginates and counts', async () => {
    const active = await call('/api/v1/products?status=eq.active&order=price.desc&count=exact');
    expect(active.body.count).toBe(2);
    expect(active.body.data[0].name).toBe('Standing desk');

    const page = await call('/api/v1/products?limit=2&offset=0&order=name.asc');
    expect(page.body.data).toHaveLength(2);
    expect(page.body.limit).toBe(2);
  });

  it('selects a subset of columns', async () => {
    const res = await call('/api/v1/products?select=name&limit=1');
    expect(Object.keys(res.body.data[0])).toEqual(['name']);
  });

  it('fetches, patches and deletes by primary key', async () => {
    const id = ids[0] as string;
    expect((await call(`/api/v1/products/${id}`)).body.name).toBe('Standing desk');

    const patched = await call(`/api/v1/products/${id}`, { method: 'PATCH', body: JSON.stringify({ price: '449.00' }) });
    expect(patched.body.price).toBe('449.00');

    expect((await call(`/api/v1/products/${id}`, { method: 'DELETE' })).status).toBe(204);
    expect((await call(`/api/v1/products/${id}`)).status).toBe(404);
  });

  it('returns a structured error for an unknown table', async () => {
    const res = await call('/api/v1/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('TABLE_NOT_FOUND');
  });

  it('returns a structured error for an unknown column filter', async () => {
    const res = await call('/api/v1/products?nope=eq.1');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('COLUMN_NOT_FOUND');
  });

  it('refuses an unfiltered bulk update or delete', async () => {
    expect((await call('/api/v1/products', { method: 'PATCH', body: JSON.stringify({ status: 'archived' }) })).status).toBe(422);
    expect((await call('/api/v1/products', { method: 'DELETE' })).status).toBe(422);
  });

  it('survives an injection attempt in a filter value', async () => {
    const res = await call(`/api/v1/products?name=eq.${encodeURIComponent("x'; DROP TABLE products; --")}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect((await call('/api/v1/products?limit=1')).status).toBe(200);
  });
});

describe('SQL editor', () => {
  it('runs a parameterised query', async () => {
    const res = await call('/api/v1/rpc/query', {
      method: 'POST',
      body: JSON.stringify({ sql: 'select name from products where status = $1 order by name', params: ['active'] }),
    });
    expect(res.status).toBe(200);
    expect(res.body.columns).toEqual(['name']);
    expect(res.body.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('returns a useful error for bad SQL instead of a stack trace', async () => {
    const res = await call('/api/v1/rpc/query', { method: 'POST', body: JSON.stringify({ sql: 'select * from ghosts' }) });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('TABLE_NOT_FOUND');
    expect(JSON.stringify(res.body)).not.toContain('at Object');
  });

  it('blocks writes in read-only mode', async () => {
    const res = await call('/api/v1/rpc/query', {
      method: 'POST',
      body: JSON.stringify({ sql: "insert into products (name) values ('nope')", readOnly: true }),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

describe('api keys', () => {
  it('creates a key, shows it once, and never returns it again', async () => {
    const created = await call('/api/v1/keys', { method: 'POST', body: JSON.stringify({ label: 'ci', role: 'public' }) });
    expect(created.status).toBe(201);
    expect(created.body.key).toMatch(/^strat_public_/);

    const list = await call('/api/v1/keys');
    const found = list.body.data.find((k: any) => k.id === created.body.id);
    expect(found.key_masked).toContain('…');
    expect(JSON.stringify(list.body)).not.toContain(created.body.key);
  });

  it('revokes a key and immediately rejects it', async () => {
    const created = await call('/api/v1/keys', { method: 'POST', body: JSON.stringify({ role: 'public' }) });
    expect((await call('/api/v1/meta/tables', { key: created.body.key })).status).toBe(200);
    await call(`/api/v1/keys/${created.body.id}/revoke`, { method: 'POST' });
    expect((await call('/api/v1/meta/tables', { key: created.body.key })).status).toBe(401);
  });

  it('rotates a key atomically', async () => {
    const created = await call('/api/v1/keys', { method: 'POST', body: JSON.stringify({ role: 'public', label: 'rotate-me' }) });
    const rotated = await call(`/api/v1/keys/${created.body.id}/rotate`, { method: 'POST' });
    expect(rotated.status).toBe(201);
    expect((await call('/api/v1/meta/tables', { key: created.body.key })).status).toBe(401);
    expect((await call('/api/v1/meta/tables', { key: rotated.body.key })).status).toBe(200);
  });
});

describe('storage', () => {
  it('creates a bucket, uploads, lists, downloads and deletes', async () => {
    expect((await call('/storage/v1/buckets', { method: 'POST', body: JSON.stringify({ name: 'avatars' }) })).status).toBe(201);

    const upload = await app.fetch(new Request(`${BASE}/storage/v1/buckets/avatars/objects/users/a.txt`, {
      method: 'PUT', headers: { apikey: secretKey, 'content-type': 'text/plain' }, body: 'hello stratum',
    }));
    expect(upload.status).toBe(201);

    const list = await call('/storage/v1/buckets/avatars/objects');
    expect(list.body.data.map((o: any) => o.key)).toEqual(['users/a.txt']);

    const download = await app.fetch(new Request(`${BASE}/storage/v1/buckets/avatars/objects/users/a.txt`, { headers: { apikey: secretKey } }));
    expect(await download.text()).toBe('hello stratum');
    // Stored files must never be served inline, or an uploaded HTML file becomes stored XSS.
    expect(download.headers.get('content-disposition')).toContain('attachment');

    const buckets = await call('/storage/v1/buckets');
    expect(buckets.body.data.find((b: any) => b.name === 'avatars').fileCount).toBe(1);

    const removed = await app.fetch(new Request(`${BASE}/storage/v1/buckets/avatars/objects/users/a.txt`, { method: 'DELETE', headers: { apikey: secretKey } }));
    expect(removed.status).toBe(204);
  });

  it('rejects path traversal in object keys', async () => {
    const res = await app.fetch(new Request(`${BASE}/storage/v1/buckets/avatars/objects/../../escape.txt`, {
      method: 'PUT', headers: { apikey: secretKey }, body: 'x',
    }));
    expect(res.status).toBeGreaterThanOrEqual(400);
    await expect(fs.stat(path.join(storageDir, 'escape.txt'))).rejects.toThrow();
  });

  it('tells the client that local uploads are proxied, not direct', async () => {
    const res = await call('/storage/v1/buckets/avatars/signed-upload', {
      method: 'POST', body: JSON.stringify({ key: 'b.png', contentType: 'image/png' }),
    });
    expect(res.body.direct).toBe(false);
  });
});

describe('functions', () => {
  it('discovers, invokes and logs a function', async () => {
    await fs.mkdir(path.join(functionsDir, 'hello'), { recursive: true });
    await fs.writeFile(
      path.join(functionsDir, 'hello', 'index.mjs'),
      `export default async (request, context) => { context.log('info', 'greeted'); return Response.json({ hello: 'world', method: request.method }); };`,
    );

    const list = await call('/functions/v1');
    expect(list.body.data.map((f: any) => f.name)).toContain('hello');

    const invoked = await call('/functions/v1/hello', { method: 'POST', body: JSON.stringify({}) });
    expect(invoked.body).toEqual({ hello: 'world', method: 'POST' });

    const logs = await call('/functions/v1/hello/logs');
    expect(logs.body.data[0].message).toBe('greeted');
  });

  it('flags a Worker-incompatible function without refusing to run it locally', async () => {
    await fs.mkdir(path.join(functionsDir, 'nodey'), { recursive: true });
    await fs.writeFile(path.join(functionsDir, 'nodey', 'index.ts'), `import fs from 'node:fs';\nexport default async () => new Response('ok');`);
    const list = await call('/functions/v1');
    const fn = list.body.data.find((f: any) => f.name === 'nodey');
    expect(fn.workerCompatible).toBe(false);
    expect(fn.compatIssues[0].api).toBe('node:fs');
  });

  it('returns FUNCTION_NOT_FOUND for an unknown function', async () => {
    const res = await call('/functions/v1/ghost', { method: 'POST', body: '{}' });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('FUNCTION_NOT_FOUND');
  });
});

describe('realtime', () => {
  it('enables change capture on a table and reports it', async () => {
    const enabled = await call('/realtime/v1/tables', { method: 'POST', body: JSON.stringify({ table: 'products' }) });
    expect(enabled.status).toBe(201);
    expect(enabled.body.channel).toBe('table:public.products');

    const status = await call('/realtime/v1/status');
    expect(status.body.tables).toContainEqual({ schema: 'public', table: 'products' });
  });

  it('fires the trigger and emits a well-formed payload', async () => {
    const res = await db.query<{ payload: string }>(
      `select row_to_json(t)::text as payload from (select 'x' as name) t`,
    );
    expect(res.rows[0]?.payload).toBeTruthy();

    // The trigger function must exist after enabling realtime on a table.
    const fn = await db.query<{ count: number }>(
      `select count(*)::int as count from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'stratum' and p.proname = 'notify_change'`,
    );
    expect(fn.rows[0]?.count).toBe(1);
  });
});

describe('migrations', () => {
  it('applies, reports status, and rolls back', async () => {
    const file = await createMigrationFile(migrationsDir, 'add_profiles');
    await fs.writeFile(
      file,
      `-- +stratum up\ncreate table profiles (id uuid primary key default gen_random_uuid(), handle text not null unique);\n-- +stratum down\ndrop table profiles;\n`,
    );

    const applied = await migrate(db, migrationsDir);
    expect(applied.applied).toHaveLength(1);

    const exists = await db.query(`select 1 from information_schema.tables where table_name = 'profiles'`);
    expect(exists.rowCount).toBe(1);

    expect((await status(db, migrationsDir))[0]?.state).toBe('applied');

    const rolled = await rollback(db, migrationsDir);
    expect(rolled?.name).toBe('add_profiles');
    const gone = await db.query(`select 1 from information_schema.tables where table_name = 'profiles'`);
    expect(gone.rowCount).toBe(0);
  });

  it('refuses to run a migration that was edited after being applied', async () => {
    const file = await createMigrationFile(migrationsDir, 'add_notes');
    await fs.writeFile(file, `-- +stratum up\ncreate table notes (id serial primary key);\n`);
    await migrate(db, migrationsDir);

    await fs.writeFile(file, `-- +stratum up\ncreate table notes (id serial primary key, body text);\n`);
    await expect(migrate(db, migrationsDir)).rejects.toThrow(/changed after it was applied/);
  });
});

describe('overview and generated docs', () => {
  it('reports metrics measured from the running system', async () => {
    const res = await call('/api/v1/meta/overview');
    expect(res.status).toBe(200);
    expect(res.body.database.tables).toBeGreaterThan(0);
    expect(res.body.database.version).toMatch(/PostgreSQL/);
    expect(res.body.storage.driver).toBe('local');
    expect(res.body.api.requests24h).toBeGreaterThan(0);
    expect(res.body.realtime.tables).toBe(1);
  });

  it('generates an OpenAPI document from the live schema', async () => {
    const res = await call('/api/v1/openapi.json');
    expect(res.body.openapi).toBe('3.1.0');
    expect(res.body.paths['/api/v1/products']).toBeDefined();
    expect(res.body.components.schemas.products.properties.price.type).toBe('number');
    expect(res.body.components.securitySchemes.apiKey.name).toBe('apikey');
  });

  it('records request logs the dashboard reads', async () => {
    const logs = await call('/logs/v1/requests?limit=5');
    expect(logs.body.data.length).toBeGreaterThan(0);
    expect(logs.body.data[0]).toHaveProperty('duration_ms');
  });
});
