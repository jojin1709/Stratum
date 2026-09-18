import { Hono } from 'hono';
import { Readable } from 'node:stream';
import { assertBucketName, assertObjectKey } from '@stratum/storage';
import { err } from '@stratum/shared';
import type { AppEnv, Services } from '../context.js';
import { requireSecretKey } from '../middleware/auth.js';

export function storageRoutes(services: Services) {
  const app = new Hono<AppEnv>();
  const { db, storage, config } = services;

  const keyFromPath = (c: { req: { path: string; url: string } }, bucket: string): string => {
    const marker = `/buckets/${bucket}/objects/`;
    const path = new URL(c.req.url).pathname;
    const idx = path.indexOf(marker);
    if (idx === -1) throw err('BAD_REQUEST', 'Malformed object path.');
    return assertObjectKey(decodeURIComponent(path.slice(idx + marker.length)));
  };

  app.get('/buckets', async (c) => {
    const names = await storage.listBuckets();
    const meta = await db.query<{ name: string; is_public: boolean; created_at: string }>(
      `select name, is_public, created_at from stratum.buckets`,
    );
    const byName = new Map(meta.rows.map((r) => [r.name, r]));

    const data = await Promise.all(
      names.map(async (name) => {
        const objects = await storage.list(name, '', 1000).catch(() => []);
        return {
          name,
          public: byName.get(name)?.is_public ?? false,
          createdAt: byName.get(name)?.created_at ?? null,
          fileCount: objects.length,
          sizeBytes: objects.reduce((sum, o) => sum + o.size, 0),
        };
      }),
    );
    return c.json({ data, driver: storage.driver });
  });

  app.post('/buckets', requireSecretKey(), async (c) => {
    const payload = (await c.req.json().catch(() => ({}))) as { name?: unknown; public?: unknown };
    const name = assertBucketName(String(payload.name ?? ''));
    await storage.createBucket(name);
    await db.query(
      `insert into stratum.buckets (name, is_public) values ($1,$2) on conflict (name) do update set is_public = excluded.is_public`,
      [name, payload.public === true],
    );
    return c.json({ name, public: payload.public === true }, 201);
  });

  app.delete('/buckets/:bucket', requireSecretKey(), async (c) => {
    const bucket = assertBucketName(c.req.param('bucket'));
    await storage.deleteBucket(bucket);
    await db.query(`delete from stratum.buckets where name = $1`, [bucket]);
    return c.json({ deleted: bucket });
  });

  app.get('/buckets/:bucket/objects', async (c) => {
    const bucket = assertBucketName(c.req.param('bucket'));
    const limit = Math.min(Number(c.req.query('limit') ?? 200), 1000);
    return c.json({ data: await storage.list(bucket, c.req.query('prefix') ?? '', limit) });
  });

  app.put('/buckets/:bucket/objects/*', async (c) => {
    const bucket = assertBucketName(c.req.param('bucket'));
    const key = keyFromPath(c, bucket);

    const declared = Number(c.req.header('content-length') ?? 0);
    if (declared > config.STORAGE_MAX_UPLOAD_BYTES) {
      throw err('PAYLOAD_TOO_LARGE', `Uploads are limited to ${config.STORAGE_MAX_UPLOAD_BYTES} bytes.`);
    }

    const buffer = Buffer.from(await c.req.arrayBuffer());
    if (buffer.byteLength > config.STORAGE_MAX_UPLOAD_BYTES) {
      throw err('PAYLOAD_TOO_LARGE', `Uploads are limited to ${config.STORAGE_MAX_UPLOAD_BYTES} bytes.`);
    }

    const contentType = c.req.header('content-type') ?? 'application/octet-stream';
    const info = await storage.put(bucket, key, buffer, { contentType });
    await db.query(
      `insert into stratum.objects (bucket, key, size_bytes, content_type, etag)
            values ($1,$2,$3,$4,$5)
       on conflict (bucket, key) do update
            set size_bytes = excluded.size_bytes, content_type = excluded.content_type,
                etag = excluded.etag, updated_at = now()`,
      [bucket, key, info.size, info.contentType, info.etag ?? null],
    );
    return c.json(info, 201);
  });

  app.get('/buckets/:bucket/objects/*', async (c) => {
    const bucket = assertBucketName(c.req.param('bucket'));
    const key = keyFromPath(c, bucket);
    const { body, info } = await storage.get(bucket, key);

    c.header('content-type', info.contentType);
    c.header('content-length', String(info.size));
    // Uploaded content is served as an attachment so a stored HTML/SVG file cannot
    // execute scripts against the API origin.
    c.header('content-disposition', `attachment; filename="${key.split('/').pop() ?? 'file'}"`);
    return c.body(Readable.toWeb(body as any) as any);
  });

  app.delete('/buckets/:bucket/objects/*', async (c) => {
    const bucket = assertBucketName(c.req.param('bucket'));
    const key = keyFromPath(c, bucket);
    await storage.remove(bucket, key);
    await db.query(`delete from stratum.objects where bucket = $1 and key = $2`, [bucket, key]);
    return c.body(null, 204);
  });

  app.post('/buckets/:bucket/signed-upload', async (c) => {
    const bucket = assertBucketName(c.req.param('bucket'));
    const payload = (await c.req.json().catch(() => ({}))) as { key?: unknown; contentType?: unknown; expiresIn?: unknown };
    const key = assertObjectKey(String(payload.key ?? ''));
    const signed = await storage.signedUpload(bucket, key, {
      expiresIn: Math.min(Number(payload.expiresIn ?? 900), 3600),
      ...(typeof payload.contentType === 'string' ? { contentType: payload.contentType } : {}),
    });
    return c.json(signed);
  });

  app.post('/buckets/:bucket/signed-download', async (c) => {
    const bucket = assertBucketName(c.req.param('bucket'));
    const payload = (await c.req.json().catch(() => ({}))) as { key?: unknown; expiresIn?: unknown };
    const key = assertObjectKey(String(payload.key ?? ''));
    const url = await storage.signedDownload(bucket, key, Math.min(Number(payload.expiresIn ?? 900), 3600));
    return c.json({ url, expiresIn: Math.min(Number(payload.expiresIn ?? 900), 3600) });
  });

  return app;
}
