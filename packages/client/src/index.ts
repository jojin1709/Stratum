import { QueryBuilder } from './query-builder.js';
import { RealtimeClient, type RealtimeChannel } from './realtime.js';
import { StorageBucketClient } from './storage.js';
import type { ClientOptions, GenericDatabase, Result, RowOf, TableNames } from './types.js';

export type { ClientOptions, Result, GenericDatabase, RealtimeChannel };
export { QueryBuilder, StorageBucketClient, RealtimeClient };

function deriveRealtimeUrl(httpUrl: string): string {
  return httpUrl.replace(/^http/, 'ws').replace(/\/$/, '') + '/realtime/v1';
}

export class StratumClient<D extends GenericDatabase = GenericDatabase> {
  private readonly baseUrl: string;
  private readonly key: string;
  private readonly extraHeaders: Record<string, string>;
  private readonly fetchImpl: typeof globalThis.fetch;
  private realtimeClient: RealtimeClient | null = null;
  private readonly realtimeUrl: string;

  constructor(options: ClientOptions) {
    if (!options.url) throw new Error('createClient requires a `url`.');
    if (!options.key) throw new Error('createClient requires a `key`.');
    if ((options.key.startsWith('strat_secret_') || options.key.startsWith('bf_secret_')) && typeof window !== 'undefined') {
      throw new Error(
        'A secret key was passed to createClient in a browser. Secret keys must stay server-side — use the public key here.',
      );
    }
    this.baseUrl = options.url.replace(/\/$/, '');
    this.key = options.key;
    this.extraHeaders = options.headers ?? {};
    this.fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.realtimeUrl = options.realtimeUrl ?? deriveRealtimeUrl(this.baseUrl);
  }

  private headers(): Record<string, string> {
    return { 'content-type': 'application/json', apikey: this.key, ...this.extraHeaders };
  }

  private async request(path: string, init: RequestInit = {}): Promise<{ status: number; body: unknown }> {
    const headers = { ...this.headers(), ...((init.headers as Record<string, string>) ?? {}) };
    // Binary uploads set their own content type; don't force JSON onto them.
    if (init.body instanceof Blob || init.body instanceof ArrayBuffer) delete headers['content-type'];
    else if (init.headers && 'content-type' in (init.headers as object)) {
      headers['content-type'] = (init.headers as Record<string, string>)['content-type'] as string;
    }

    const response = await this.fetchImpl(`${this.baseUrl}${path}`, { ...init, headers });
    const text = await response.text();
    let body: unknown = null;
    if (text) { try { body = JSON.parse(text); } catch { body = text; } }
    return { status: response.status, body };
  }

  private transport() {
    return {
      request: this.request.bind(this),
      baseUrl: this.baseUrl,
      headers: () => ({ apikey: this.key }),
    };
  }

  from<T extends TableNames<D>>(table: T): QueryBuilder<RowOf<D, T>> {
    return new QueryBuilder<RowOf<D, T>>(this.transport(), table);
  }

  /** `channel('products')` shorthand resolves to the public.products change feed. */
  channel(name: string): RealtimeChannel {
    if (!this.realtimeClient) this.realtimeClient = new RealtimeClient(this.realtimeUrl, this.key);
    const resolved = name.includes(':') ? name : `table:public.${name}`;
    return this.realtimeClient.channel(resolved);
  }

  /** Channel that is explicitly a broadcast room rather than a table feed. */
  room(name: string): RealtimeChannel {
    if (!this.realtimeClient) this.realtimeClient = new RealtimeClient(this.realtimeUrl, this.key);
    return this.realtimeClient.channel(`room:${name}`);
  }

  storage(bucket: string): StorageBucketClient {
    return new StorageBucketClient(this.transport(), bucket);
  }

  functions() {
    const request = this.request.bind(this);
    return {
      async invoke<T = unknown>(name: string, body?: unknown): Promise<Result<T>> {
        const { status, body: res } = await request(`/functions/v1/${encodeURIComponent(name)}`, {
          method: 'POST',
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        if (status >= 400) {
          return { data: null, error: (res as any)?.error ?? { code: 'UNKNOWN_ERROR', message: `Status ${status}.` } };
        }
        return { data: res as T, error: null };
      },
    };
  }

  async rpc(sql: string, params: unknown[] = []): Promise<Result<Record<string, unknown>[]>> {
    const { status, body } = await this.request('/api/v1/rpc/query', {
      method: 'POST',
      body: JSON.stringify({ sql, params }),
    });
    if (status >= 400) {
      return { data: null, error: (body as any)?.error ?? { code: 'UNKNOWN_ERROR', message: `Status ${status}.` } };
    }
    return { data: (body as any).rows ?? [], error: null };
  }

  disconnect(): void {
    this.realtimeClient?.disconnect();
    this.realtimeClient = null;
  }
}

// Backwards compatibility alias
export { StratumClient as BaseForgeClient };

export function createClient<D extends GenericDatabase = GenericDatabase>(options: ClientOptions): StratumClient<D> {
  return new StratumClient<D>(options);
}
