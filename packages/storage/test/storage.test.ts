import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { LocalStorageProvider, assertBucketName, assertObjectKey } from '../src/index.js';

let root: string;
let storage: LocalStorageProvider;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'bf-storage-'));
  storage = new LocalStorageProvider({ root, apiBaseUrl: 'http://localhost:8788' });
});
afterEach(async () => { await fs.rm(root, { recursive: true, force: true }); });

describe('validation', () => {
  it('rejects path traversal and absolute keys', () => {
    for (const bad of ['../../etc/passwd', '/etc/passwd', 'a//b', 'a/../../b', '', 'x\u0000y']) {
      expect(() => assertObjectKey(bad)).toThrow();
    }
    expect(assertObjectKey('avatars/user-1.png')).toBe('avatars/user-1.png');
  });

  it('enforces bucket naming rules', () => {
    for (const bad of ['A', 'ab', 'has_underscore', '-leading', 'trailing-', 'x'.repeat(64)]) {
      expect(() => assertBucketName(bad)).toThrow();
    }
    expect(assertBucketName('avatars')).toBe('avatars');
  });
});

describe('LocalStorageProvider', () => {
  it('round-trips an object with its content type', async () => {
    await storage.createBucket('avatars');
    const info = await storage.put('avatars', 'a/b.png', Buffer.from('hello'), { contentType: 'image/png' });
    expect(info.size).toBe(5);
    expect(info.contentType).toBe('image/png');

    const got = await storage.get('avatars', 'a/b.png');
    expect(got.info.contentType).toBe('image/png');
    const chunks: Buffer[] = [];
    for await (const c of got.body) chunks.push(Buffer.from(c as Buffer));
    expect(Buffer.concat(chunks).toString()).toBe('hello');
  });

  it('lists objects without leaking sidecar metadata files', async () => {
    await storage.createBucket('docs');
    await storage.put('docs', 'one.txt', Buffer.from('1'));
    await storage.put('docs', 'nested/two.txt', Buffer.from('22'));
    const objects = await storage.list('docs');
    expect(objects.map((o) => o.key)).toEqual(['nested/two.txt', 'one.txt']);
    expect(objects.some((o) => o.key.endsWith('.bfmeta'))).toBe(false);
  });

  it('filters by prefix', async () => {
    await storage.createBucket('docs');
    await storage.put('docs', 'invoices/a.pdf', Buffer.from('a'));
    await storage.put('docs', 'reports/b.pdf', Buffer.from('b'));
    expect((await storage.list('docs', 'invoices/')).map((o) => o.key)).toEqual(['invoices/a.pdf']);
  });

  it('reports missing objects rather than inventing them', async () => {
    await storage.createBucket('docs');
    expect(await storage.head('docs', 'nope.txt')).toBeNull();
    await expect(storage.get('docs', 'nope.txt')).rejects.toThrow(/does not exist/);
  });

  it('deletes objects and buckets', async () => {
    await storage.createBucket('tmp');
    await storage.put('tmp', 'x.txt', Buffer.from('x'));
    await storage.remove('tmp', 'x.txt');
    expect(await storage.list('tmp')).toEqual([]);
    await storage.deleteBucket('tmp');
    expect(await storage.listBuckets()).not.toContain('tmp');
  });

  it('never writes outside the bucket directory', async () => {
    await storage.createBucket('safe');
    await expect(storage.put('safe', '../escaped.txt', Buffer.from('x'))).rejects.toThrow();
    await expect(fs.stat(path.join(root, 'escaped.txt'))).rejects.toThrow();
  });

  it('marks local signed uploads as proxied, not direct', async () => {
    const signed = await storage.signedUpload('avatars', 'a.png', { contentType: 'image/png' });
    expect(signed.direct).toBe(false);
    expect(signed.method).toBe('PUT');
    expect(signed.url).toContain('/storage/v1/buckets/avatars/objects/a.png');
  });
});
