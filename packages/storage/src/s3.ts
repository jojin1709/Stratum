import {
  CreateBucketCommand,
  DeleteBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListBucketsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'node:stream';
import { err } from '@stratum/shared';
import { assertBucketName, assertObjectKey, type SignedUploadResult, type StorageObject, type StorageProvider } from './provider.js';

export interface S3ProviderOptions {
  endpoint: string;
  region?: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle?: boolean;
  fixedBucket?: string;
}

export class S3StorageProvider implements StorageProvider {
  readonly driver = 's3' as const;
  private readonly client: S3Client;
  private readonly fixedBucket?: string;

  constructor(opts: S3ProviderOptions) {
    this.client = new S3Client({
      endpoint: opts.endpoint,
      region: opts.region ?? 'auto',
      credentials: {
        accessKeyId: opts.accessKeyId,
        secretAccessKey: opts.secretAccessKey,
      },
      forcePathStyle: opts.forcePathStyle ?? true,
    });
    this.fixedBucket = opts.fixedBucket;
  }

  private resolveBucket(bucket: string): string {
    return this.fixedBucket ?? assertBucketName(bucket);
  }

  private resolveKey(bucket: string, key: string): string {
    assertObjectKey(key);
    return this.fixedBucket ? `${bucket}/${key}` : key;
  }

  async createBucket(bucket: string): Promise<void> {
    if (this.fixedBucket) return;
    assertBucketName(bucket);
    await this.client.send(new CreateBucketCommand({ Bucket: bucket }));
  }

  async deleteBucket(bucket: string): Promise<void> {
    if (this.fixedBucket) return;
    assertBucketName(bucket);
    await this.client.send(new DeleteBucketCommand({ Bucket: bucket }));
  }

  async listBuckets(): Promise<string[]> {
    if (this.fixedBucket) return [this.fixedBucket];
    const res = await this.client.send(new ListBucketsCommand({}));
    return (res.Buckets ?? []).map((b) => b.Name ?? '').filter(Boolean);
  }

  async put(
    bucket: string,
    key: string,
    data: Buffer,
    options: { contentType?: string } = {},
  ): Promise<StorageObject> {
    const s3Bucket = this.resolveBucket(bucket);
    const s3Key = this.resolveKey(bucket, key);
    const contentType = options.contentType ?? 'application/octet-stream';

    const res = await this.client.send(
      new PutObjectCommand({
        Bucket: s3Bucket,
        Key: s3Key,
        Body: data,
        ContentType: contentType,
      }),
    );

    return {
      key,
      size: data.length,
      contentType,
      etag: res.ETag ?? null,
      lastModified: new Date().toISOString(),
    };
  }

  async get(bucket: string, key: string): Promise<{ body: NodeJS.ReadableStream; info: StorageObject }> {
    const s3Bucket = this.resolveBucket(bucket);
    const s3Key = this.resolveKey(bucket, key);

    try {
      const res = await this.client.send(new GetObjectCommand({ Bucket: s3Bucket, Key: s3Key }));
      if (!res.Body) throw err('OBJECT_NOT_FOUND', `Object "${key}" does not exist.`);

      return {
        body: res.Body as unknown as Readable,
        info: {
          key,
          size: res.ContentLength ?? 0,
          contentType: res.ContentType ?? 'application/octet-stream',
          etag: res.ETag ?? null,
          lastModified: res.LastModified?.toISOString() ?? new Date().toISOString(),
        },
      };
    } catch (e: any) {
      if (e.name === 'NoSuchKey' || e.$metadata?.httpStatusCode === 404) {
        throw err('OBJECT_NOT_FOUND', `Object "${key}" does not exist in bucket "${bucket}".`);
      }
      throw e;
    }
  }

  async head(bucket: string, key: string): Promise<StorageObject | null> {
    const s3Bucket = this.resolveBucket(bucket);
    const s3Key = this.resolveKey(bucket, key);

    try {
      const res = await this.client.send(new HeadObjectCommand({ Bucket: s3Bucket, Key: s3Key }));
      return {
        key,
        size: res.ContentLength ?? 0,
        contentType: res.ContentType ?? 'application/octet-stream',
        etag: res.ETag ?? null,
        lastModified: res.LastModified?.toISOString() ?? new Date().toISOString(),
      };
    } catch (e: any) {
      if (e.name === 'NotFound' || e.$metadata?.httpStatusCode === 404) {
        return null;
      }
      throw e;
    }
  }

  async remove(bucket: string, key: string): Promise<void> {
    const s3Bucket = this.resolveBucket(bucket);
    const s3Key = this.resolveKey(bucket, key);
    await this.client.send(new DeleteObjectCommand({ Bucket: s3Bucket, Key: s3Key }));
  }

  async list(bucket: string, prefix = '', limit = 1000): Promise<StorageObject[]> {
    const s3Bucket = this.resolveBucket(bucket);
    const s3Prefix = this.fixedBucket ? `${bucket}/${prefix}` : prefix;

    const res = await this.client.send(
      new ListObjectsV2Command({
        Bucket: s3Bucket,
        Prefix: s3Prefix,
        MaxKeys: limit,
      }),
    );

    return (res.Contents ?? []).map((o) => {
      const rawKey = o.Key ?? '';
      const key = this.fixedBucket && rawKey.startsWith(`${bucket}/`) ? rawKey.slice(bucket.length + 1) : rawKey;
      return {
        key,
        size: o.Size ?? 0,
        contentType: 'application/octet-stream',
        etag: o.ETag ?? null,
        lastModified: o.LastModified?.toISOString() ?? new Date().toISOString(),
      };
    });
  }

  async signedUpload(
    bucket: string,
    key: string,
    options: { expiresIn?: number; contentType?: string } = {},
  ): Promise<SignedUploadResult> {
    const s3Bucket = this.resolveBucket(bucket);
    const s3Key = this.resolveKey(bucket, key);
    const command = new PutObjectCommand({
      Bucket: s3Bucket,
      Key: s3Key,
      ...(options.contentType ? { ContentType: options.contentType } : {}),
    });

    const url = await getSignedUrl(this.client, command, { expiresIn: options.expiresIn ?? 900 });
    return {
      url,
      method: 'PUT',
      headers: options.contentType ? { 'content-type': options.contentType } : {},
      direct: true,
    };
  }

  async signedDownload(bucket: string, key: string, expiresIn = 900): Promise<string> {
    const s3Bucket = this.resolveBucket(bucket);
    const s3Key = this.resolveKey(bucket, key);
    const command = new GetObjectCommand({ Bucket: s3Bucket, Key: s3Key });
    return getSignedUrl(this.client, command, { expiresIn });
  }
}
