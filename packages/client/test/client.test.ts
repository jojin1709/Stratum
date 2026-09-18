import { describe, it, expect, vi } from 'vitest';
import { createClient } from '../src/index.js';

function mockFetch(handler: (url: string, init: RequestInit) => { status?: number; body?: unknown }) {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl = vi.fn(async (url: any, init: any = {}) => {
    calls.push({ url: String(url), init });
    const { status = 200, body = { data: [] } } = handler(String(url), init);
    return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  });
  return { impl: impl as unknown as typeof fetch, calls };
}

const base = (fetchImpl: typeof fetch) =>
  createClient({ url: 'https://demo.stratum.app/', key: 'strat_public_test', fetch: fetchImpl });

describe('createClient', () => {
  it('requires a url and a key', () => {
    expect(() => createClient({ url: '', key: 'k' })).toThrow(/requires a `url`/);
    expect(() => createClient({ url: 'https://x', key: '' })).toThrow(/requires a `key`/);
  });

  it('sends the api key on every request and strips the trailing slash from the url', async () => {
    const { impl, calls } = mockFetch(() => ({}));
    await base(impl).from('products').select('*');
    expect(calls[0]?.url).toBe('https://demo.stratum.app/api/v1/products');
    expect((calls[0]?.init.headers as any).apikey).toBe('strat_public_test');
  });
});

describe('query builder', () => {
  it('translates chained filters into query parameters', async () => {
    const { impl, calls } = mockFetch(() => ({}));
    await base(impl)
      .from('products')
      .select('id,name')
      .eq('status', 'active')
      .gte('price', 100)
      .in('category', ['a', 'b'])
      .order('created_at', { ascending: false })
      .limit(20)
      .offset(40);

    const url = new URL(calls[0]?.url as string);
    expect(url.searchParams.get('select')).toBe('id,name');
    expect(url.searchParams.get('status')).toBe('eq.active');
    expect(url.searchParams.get('price')).toBe('gte.100');
    expect(url.searchParams.get('category')).toBe('in.(a,b)');
    expect(url.searchParams.get('order')).toBe('created_at.desc');
    expect(url.searchParams.get('limit')).toBe('20');
    expect(url.searchParams.get('offset')).toBe('40');
  });

  it('turns range() into offset and limit', async () => {
    const { impl, calls } = mockFetch(() => ({}));
    await base(impl).from('products').select().range(10, 19);
    const url = new URL(calls[0]?.url as string);
    expect(url.searchParams.get('offset')).toBe('10');
    expect(url.searchParams.get('limit')).toBe('10');
  });

  it('uses the right verb and body for writes', async () => {
    const { impl, calls } = mockFetch(() => ({}));
    const client = base(impl);
    await client.from('products').insert({ name: 'Desk' });
    await client.from('products').update({ name: 'New' }).eq('id', 1);
    await client.from('products').delete().eq('id', 1);

    expect(calls[0]?.init.method).toBe('POST');
    expect(JSON.parse(calls[0]?.init.body as string)).toEqual({ name: 'Desk' });
    expect(calls[1]?.init.method).toBe('PATCH');
    expect(calls[2]?.init.method).toBe('DELETE');
  });

  it('returns data with a null error on success', async () => {
    const { impl } = mockFetch(() => ({ body: { data: [{ id: 1 }], count: 1 } }));
    const { data, error } = await base(impl).from('products').select('*');
    expect(error).toBeNull();
    expect(data).toEqual([{ id: 1 }]);
  });

  it('returns the API error instead of throwing', async () => {
    const { impl } = mockFetch(() => ({
      status: 404,
      body: { error: { code: 'TABLE_NOT_FOUND', message: 'The requested table does not exist.' } },
    }));
    const { data, error } = await base(impl).from('ghosts').select('*');
    expect(data).toBeNull();
    expect(error).toEqual({ code: 'TABLE_NOT_FOUND', message: 'The requested table does not exist.' });
  });

  it('reports an empty result from maybeSingle as NOT_FOUND', async () => {
    const { impl } = mockFetch(() => ({ body: { data: [] } }));
    const { data, error } = await base(impl).from('products').select('*').eq('id', 99).maybeSingle();
    expect(data).toBeNull();
    expect(error?.code).toBe('NOT_FOUND');
  });
});

describe('functions and rpc', () => {
  it('invokes a function by name', async () => {
    const { impl, calls } = mockFetch(() => ({ body: { ok: true } }));
    const { data } = await base(impl).functions().invoke('hello', { name: 'ada' });
    expect(calls[0]?.url).toBe('https://demo.stratum.app/functions/v1/hello');
    expect(data).toEqual({ ok: true });
  });

  it('sends rpc sql and params as a body, never interpolated into the url', async () => {
    const { impl, calls } = mockFetch(() => ({ body: { rows: [] } }));
    await base(impl).rpc('select * from products where id = $1', [7]);
    expect(calls[0]?.url).toBe('https://demo.stratum.app/api/v1/rpc/query');
    expect(JSON.parse(calls[0]?.init.body as string)).toEqual({
      sql: 'select * from products where id = $1',
      params: [7],
    });
  });
});

describe('storage', () => {
  it('builds public urls with encoded segments', () => {
    const { impl } = mockFetch(() => ({}));
    expect(base(impl).storage('avatars').getPublicUrl('users/a b.png')).toBe(
      'https://demo.stratum.app/storage/v1/buckets/avatars/objects/users/a%20b.png',
    );
  });

  it('proxies uploads through the api by default', async () => {
    const { impl, calls } = mockFetch(() => ({ body: { key: 'a.png' } }));
    await base(impl).storage('avatars').upload('a.png', new Blob(['x']), { contentType: 'image/png' });
    expect(calls[0]?.init.method).toBe('PUT');
    expect(calls[0]?.url).toContain('/storage/v1/buckets/avatars/objects/a.png');
  });
});

describe('realtime channel naming', () => {
  it('maps a bare name to the public table feed and room() to a broadcast room', () => {
    const { impl } = mockFetch(() => ({}));
    const client = base(impl);
    // No socket is opened until subscribe(), so this only exercises naming.
    expect(() => client.channel('products')).not.toThrow();
    expect(() => client.room('123')).not.toThrow();
    client.disconnect();
  });
});
