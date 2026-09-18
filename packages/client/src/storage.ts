import type { Result } from './types.js';

interface Transport {
  request(path: string, init?: RequestInit): Promise<{ status: number; body: unknown }>;
  baseUrl: string;
  headers(): Record<string, string>;
}

export interface UploadOptions {
  contentType?: string;
  /** Ask the server for a presigned URL and send the bytes straight to object storage. */
  direct?: boolean;
  onProgress?: (progress: { loaded: number; total: number; percent: number }) => void;
}

export class StorageBucketClient {
  constructor(private readonly transport: Transport, private readonly bucket: string) {}

  async list(prefix = ''): Promise<Result<{ key: string; size: number; contentType: string; lastModified: string }[]>> {
    const qs = prefix ? `?prefix=${encodeURIComponent(prefix)}` : '';
    const { status, body } = await this.transport.request(`/storage/v1/buckets/${this.bucket}/objects${qs}`);
    if (status >= 400) return { data: null, error: (body as any)?.error ?? { code: 'UNKNOWN_ERROR', message: 'List failed.' } };
    return { data: (body as any).data ?? [], error: null };
  }

  async upload(key: string, file: Blob | ArrayBuffer | Uint8Array, opts: UploadOptions = {}): Promise<Result<{ key: string; size: number }>> {
    const blob = file instanceof Blob ? file : new Blob([file as BlobPart]);
    const contentType =
      opts.contentType || (file instanceof Blob && file.type ? file.type : 'application/octet-stream');
    const path = `/storage/v1/buckets/${this.bucket}/objects/${key.split('/').map(encodeURIComponent).join('/')}`;

    if (opts.direct) {
      const signed = await this.transport.request(`/storage/v1/buckets/${this.bucket}/signed-upload`, {
        method: 'POST',
        body: JSON.stringify({ key, contentType }),
      });
      if (signed.status >= 400) {
        return { data: null, error: (signed.body as any)?.error ?? { code: 'UNKNOWN_ERROR', message: 'Could not sign upload.' } };
      }
      const info = signed.body as { url: string; method: string; headers: Record<string, string>; direct: boolean };
      // When direct is false the server is telling us it cannot bypass the API; honour that
      // rather than pretending the upload went straight to object storage.
      const headers = info.direct ? info.headers : { ...info.headers, ...this.transport.headers() };
      const res = await fetch(info.url, { method: info.method, headers, body: blob });
      if (!res.ok) return { data: null, error: { code: 'STORAGE_ERROR', message: `Upload failed with status ${res.status}.` } };
      opts.onProgress?.({ loaded: blob.size, total: blob.size, percent: 100 });
      return { data: { key, size: blob.size }, error: null };
    }

    const { status, body } = await this.transport.request(path, {
      method: 'PUT',
      body: blob,
      headers: { 'content-type': contentType },
    });
    if (status >= 400) return { data: null, error: (body as any)?.error ?? { code: 'STORAGE_ERROR', message: 'Upload failed.' } };
    opts.onProgress?.({ loaded: blob.size, total: blob.size, percent: 100 });
    return { data: { key, size: blob.size }, error: null };
  }

  /** Public URL for the proxied download endpoint. Private buckets still require a key. */
  getPublicUrl(key: string): string {
    return `${this.transport.baseUrl}/storage/v1/buckets/${this.bucket}/objects/${key.split('/').map(encodeURIComponent).join('/')}`;
  }

  async createSignedUrl(key: string, expiresIn = 900): Promise<Result<{ url: string }>> {
    const { status, body } = await this.transport.request(
      `/storage/v1/buckets/${this.bucket}/signed-download`,
      { method: 'POST', body: JSON.stringify({ key, expiresIn }) },
    );
    if (status >= 400) return { data: null, error: (body as any)?.error ?? { code: 'UNKNOWN_ERROR', message: 'Signing failed.' } };
    return { data: body as { url: string }, error: null };
  }

  async remove(key: string): Promise<Result<{ key: string }>> {
    const path = `/storage/v1/buckets/${this.bucket}/objects/${key.split('/').map(encodeURIComponent).join('/')}`;
    const { status, body } = await this.transport.request(path, { method: 'DELETE' });
    if (status >= 400) return { data: null, error: (body as any)?.error ?? { code: 'STORAGE_ERROR', message: 'Delete failed.' } };
    return { data: { key }, error: null };
  }
}
