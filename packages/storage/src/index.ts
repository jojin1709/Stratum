export * from './provider.js';
export { LocalStorageProvider } from './local.js';
export { S3StorageProvider, type S3ProviderOptions } from './s3.js';

import { LocalStorageProvider } from './local.js';
import { S3StorageProvider } from './s3.js';
import type { StorageProvider } from './provider.js';

export interface StorageFactoryOptions {
  driver: 'local' | 's3';
  localPath: string;
  apiBaseUrl: string;
  s3?: {
    endpoint?: string | undefined;
    region?: string | undefined;
    bucket?: string | undefined;
    accessKeyId?: string | undefined;
    secretAccessKey?: string | undefined;
  };
}

export function createStorageProvider(opts: StorageFactoryOptions): StorageProvider {
  if (opts.driver === 'local') {
    return new LocalStorageProvider({ root: opts.localPath, apiBaseUrl: opts.apiBaseUrl });
  }
  const s3 = opts.s3 ?? {};
  if (!s3.endpoint || !s3.accessKeyId || !s3.secretAccessKey) {
    throw new Error('STORAGE_DRIVER=s3 requires R2_ENDPOINT, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY.');
  }
  return new S3StorageProvider({
    endpoint: s3.endpoint,
    region: s3.region ?? 'auto',
    accessKeyId: s3.accessKeyId,
    secretAccessKey: s3.secretAccessKey,
    forcePathStyle: true,
    ...(s3.bucket ? { fixedBucket: s3.bucket } : {}),
  });
}
