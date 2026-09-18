import { err } from '@stratum/shared';

export interface StorageObject {
  key: string;
  size: number;
  contentType: string;
  etag: string | null;
  lastModified: string;
}

export interface SignedUploadResult {
  url: string;
  method: 'PUT' | 'POST';
  headers: Record<string, string>;
  direct: boolean;
}

export interface StorageProvider {
  readonly driver: 'local' | 's3';
  createBucket(bucket: string): Promise<void>;
  deleteBucket(bucket: string): Promise<void>;
  listBuckets(): Promise<string[]>;
  put(bucket: string, key: string, data: Buffer, options?: { contentType?: string }): Promise<StorageObject>;
  get(bucket: string, key: string): Promise<{ body: NodeJS.ReadableStream; info: StorageObject }>;
  head(bucket: string, key: string): Promise<StorageObject | null>;
  remove(bucket: string, key: string): Promise<void>;
  list(bucket: string, prefix?: string, limit?: number): Promise<StorageObject[]>;
  signedUpload(bucket: string, key: string, options?: { expiresIn?: number; contentType?: string }): Promise<SignedUploadResult>;
  signedDownload(bucket: string, key: string, expiresIn?: number): Promise<string>;
}

const BUCKET = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/;

export function assertBucketName(name: string): string {
  if (typeof name !== 'string' || !BUCKET.test(name) || name.includes('..')) {
    throw err('VALIDATION_FAILED', `Invalid bucket name: ${JSON.stringify(name)}`);
  }
  return name;
}

export function assertObjectKey(key: string): string {
  if (typeof key !== 'string' || key.length === 0 || key.length > 1024) {
    throw err('VALIDATION_FAILED', `Invalid object key: ${JSON.stringify(key)}`);
  }
  if (key.includes('//') || key.startsWith('/') || key.includes('\0')) {
    throw err('VALIDATION_FAILED', `Object key contains invalid characters or leading slashes: ${JSON.stringify(key)}`);
  }
  for (const part of key.split('/')) {
    if (part === '..' || part === '.') {
      throw err('VALIDATION_FAILED', 'Path traversal components ("." or "..") are forbidden in object keys.');
    }
  }
  return key;
}
