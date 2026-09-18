import { createHash } from 'node:crypto';
import { createReadStream, promises as fs } from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { err } from '@stratum/shared';
import { assertBucketName, assertObjectKey, type SignedUploadResult, type StorageObject, type StorageProvider } from './provider.js';

export interface LocalStorageOptions {
  root: string;
  apiBaseUrl: string;
}

interface MetaPayload {
  contentType: string;
  etag: string;
  size: number;
  lastModified: string;
}

export class LocalStorageProvider implements StorageProvider {
  readonly driver = 'local' as const;
  private readonly root: string;
  private readonly apiBaseUrl: string;

  constructor(opts: LocalStorageOptions) {
    this.root = path.resolve(opts.root);
    this.apiBaseUrl = opts.apiBaseUrl.replace(/\/$/, '');
  }

  private resolveBucket(bucket: string): string {
    assertBucketName(bucket);
    return path.join(this.root, bucket);
  }

  private resolvePath(bucket: string, key: string): { filePath: string; metaPath: string } {
    assertBucketName(bucket);
    assertObjectKey(key);
    const bucketDir = path.join(this.root, bucket);
    const filePath = path.resolve(bucketDir, key);
    const bucketRoot = path.resolve(bucketDir);
    if (!filePath.startsWith(bucketRoot + path.sep) && filePath !== bucketRoot) {
      throw err('FORBIDDEN', 'Path traversal outside the target bucket is forbidden.');
    }
    const metaPath = `${filePath}.bfmeta`;
    return { filePath, metaPath };
  }

  async createBucket(bucket: string): Promise<void> {
    const dir = this.resolveBucket(bucket);
    await fs.mkdir(dir, { recursive: true });
  }

  async deleteBucket(bucket: string): Promise<void> {
    const dir = this.resolveBucket(bucket);
    await fs.rm(dir, { recursive: true, force: true });
  }

  async listBuckets(): Promise<string[]> {
    await fs.mkdir(this.root, { recursive: true });
    const entries = await fs.readdir(this.root, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  }

  async put(
    bucket: string,
    key: string,
    data: Buffer,
    options: { contentType?: string } = {},
  ): Promise<StorageObject> {
    const { filePath, metaPath } = this.resolvePath(bucket, key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, data);

    const etag = `"${createHash('md5').update(data).digest('hex')}"`;
    const contentType = options.contentType ?? 'application/octet-stream';
    const lastModified = new Date().toISOString();

    const meta: MetaPayload = {
      contentType,
      etag,
      size: data.length,
      lastModified,
    };
    await fs.writeFile(metaPath, JSON.stringify(meta), 'utf8');

    return {
      key,
      size: data.length,
      contentType,
      etag,
      lastModified,
    };
  }

  async get(bucket: string, key: string): Promise<{ body: NodeJS.ReadableStream; info: StorageObject }> {
    const info = await this.head(bucket, key);
    if (!info) {
      throw err('OBJECT_NOT_FOUND', `Object "${key}" does not exist in bucket "${bucket}".`);
    }
    const { filePath } = this.resolvePath(bucket, key);
    return {
      body: createReadStream(filePath) as unknown as Readable,
      info,
    };
  }

  async head(bucket: string, key: string): Promise<StorageObject | null> {
    const { filePath, metaPath } = this.resolvePath(bucket, key);
    try {
      const stat = await fs.stat(filePath);
      if (stat.isDirectory()) return null;

      let contentType = 'application/octet-stream';
      let etag: string | null = null;
      let lastModified = stat.mtime.toISOString();

      try {
        const metaRaw = await fs.readFile(metaPath, 'utf8');
        const meta = JSON.parse(metaRaw) as MetaPayload;
        contentType = meta.contentType ?? contentType;
        etag = meta.etag ?? etag;
        lastModified = meta.lastModified ?? lastModified;
      } catch {
        // Fall back to stat
      }

      return {
        key,
        size: stat.size,
        contentType,
        etag,
        lastModified,
      };
    } catch {
      return null;
    }
  }

  async remove(bucket: string, key: string): Promise<void> {
    const { filePath, metaPath } = this.resolvePath(bucket, key);
    await fs.unlink(filePath).catch(() => {});
    await fs.unlink(metaPath).catch(() => {});
  }

  async list(bucket: string, prefix = '', limit = 1000): Promise<StorageObject[]> {
    const bucketDir = this.resolveBucket(bucket);
    const results: StorageObject[] = [];

    const walk = async (current: string, relPrefix: string) => {
      let entries;
      try {
        entries = await fs.readdir(current, { withFileTypes: true });
      } catch {
        return;
      }
      for (const e of entries) {
        if (results.length >= limit) return;
        const full = path.join(current, e.name);
        const rel = relPrefix ? `${relPrefix}/${e.name}` : e.name;
        if (e.isDirectory()) {
          await walk(full, rel);
        } else if (e.isFile()) {
          if (rel.endsWith('.bfmeta') || rel.endsWith('.stratmeta')) continue;
          if (!prefix || rel.startsWith(prefix)) {
            const stat = await fs.stat(full);
            let contentType = 'application/octet-stream';
            let etag: string | null = null;
            let lastModified = stat.mtime.toISOString();
            try {
              const metaRaw = await fs.readFile(`${full}.bfmeta`, 'utf8');
              const meta = JSON.parse(metaRaw) as MetaPayload;
              contentType = meta.contentType ?? contentType;
              etag = meta.etag ?? etag;
              lastModified = meta.lastModified ?? lastModified;
            } catch {
              // Ignore
            }
            results.push({
              key: rel,
              size: stat.size,
              contentType,
              etag,
              lastModified,
            });
          }
        }
      }
    };

    await walk(bucketDir, '');
    return results.sort((a, b) => a.key.localeCompare(b.key));
  }

  async signedUpload(
    bucket: string,
    key: string,
    options: { expiresIn?: number; contentType?: string } = {},
  ): Promise<SignedUploadResult> {
    assertBucketName(bucket);
    assertObjectKey(key);
    return {
      url: `${this.apiBaseUrl}/storage/v1/buckets/${bucket}/objects/${encodeURIComponent(key)}`,
      method: 'PUT',
      headers: options.contentType ? { 'content-type': options.contentType } : {},
      direct: false,
    };
  }

  async signedDownload(bucket: string, key: string, _expiresIn = 900): Promise<string> {
    assertBucketName(bucket);
    assertObjectKey(key);
    return `${this.apiBaseUrl}/storage/v1/buckets/${bucket}/objects/${encodeURIComponent(key)}`;
  }
}
