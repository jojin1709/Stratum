import type { StratumErrorShape, Result } from './types.js';

type Op = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'ilike' | 'is' | 'in' | 'contains';

interface Transport {
  request(path: string, init?: RequestInit): Promise<{ status: number; body: unknown }>;
}

function toError(body: unknown, status: number): StratumErrorShape {
  const wrapped = (body as { error?: StratumErrorShape } | null)?.error;
  if (wrapped?.code) return wrapped;
  return { code: 'UNKNOWN_ERROR', message: `Request failed with status ${status}.` };
}

/**
 * Chainable, immutable-per-call query builder. It is thenable, so `await stratum.from('x').select('*')`
 * works without an explicit terminal method.
 */
export class QueryBuilder<Row> implements PromiseLike<Result<Row[]>> {
  private readonly params = new URLSearchParams();
  private method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET';
  private body: unknown = undefined;
  private single = false;

  constructor(
    private readonly transport: Transport,
    private readonly table: string,
  ) {}

  select(columns = '*'): this {
    if (columns !== '*') this.params.set('select', columns);
    if (this.method === 'GET') this.body = undefined;
    return this;
  }

  insert(values: Record<string, unknown> | Record<string, unknown>[]): this {
    this.method = 'POST';
    this.body = values;
    return this;
  }

  update(patch: Record<string, unknown>): this {
    this.method = 'PATCH';
    this.body = patch;
    return this;
  }

  delete(): this {
    this.method = 'DELETE';
    return this;
  }

  private filter(column: string, op: Op, value: unknown): this {
    const encoded = Array.isArray(value) ? `(${value.join(',')})` : String(value);
    this.params.append(column, `${op}.${encoded}`);
    return this;
  }

  eq(column: string, value: unknown): this { return this.filter(column, 'eq', value); }
  neq(column: string, value: unknown): this { return this.filter(column, 'neq', value); }
  gt(column: string, value: unknown): this { return this.filter(column, 'gt', value); }
  gte(column: string, value: unknown): this { return this.filter(column, 'gte', value); }
  lt(column: string, value: unknown): this { return this.filter(column, 'lt', value); }
  lte(column: string, value: unknown): this { return this.filter(column, 'lte', value); }
  like(column: string, pattern: string): this { return this.filter(column, 'like', pattern); }
  ilike(column: string, pattern: string): this { return this.filter(column, 'ilike', pattern); }
  is(column: string, value: null | boolean): this { return this.filter(column, 'is', value); }
  in(column: string, values: unknown[]): this { return this.filter(column, 'in', values); }
  contains(column: string, value: unknown): this { return this.filter(column, 'contains', JSON.stringify(value)); }

  order(column: string, opts: { ascending?: boolean; nullsFirst?: boolean } = {}): this {
    const mods = [opts.ascending === false ? 'desc' : 'asc'];
    if (opts.nullsFirst) mods.push('nullsfirst');
    this.params.append('order', `${column}.${mods.join('.')}`);
    return this;
  }

  limit(n: number): this { this.params.set('limit', String(n)); return this; }
  offset(n: number): this { this.params.set('offset', String(n)); return this; }

  range(from: number, to: number): this {
    this.params.set('offset', String(from));
    this.params.set('limit', String(to - from + 1));
    return this;
  }

  /** Requests an exact total alongside the page, available on the `count` field. */
  withCount(): this { this.params.set('count', 'exact'); return this; }

  /** Resolves to the first row, or a NOT_FOUND error when the result set is empty. */
  maybeSingle(): PromiseLike<Result<Row | null>> {
    this.single = true;
    return this as unknown as PromiseLike<Result<Row | null>>;
  }

  async run(): Promise<Result<Row[]> & { count?: number | null }> {
    const qs = this.params.toString();
    const path = `/api/v1/${encodeURIComponent(this.table)}${qs ? `?${qs}` : ''}`;
    const init: RequestInit = { method: this.method };
    if (this.body !== undefined) init.body = JSON.stringify(this.body);

    const { status, body } = await this.transport.request(path, init);
    if (status >= 400) return { data: null, error: toError(body, status) };

    const payload = body as { data?: unknown; count?: number | null };
    const rows = (Array.isArray(payload?.data) ? payload.data : Array.isArray(body) ? body : []) as Row[];

    if (this.single) {
      const first = rows[0];
      if (first === undefined) {
        return { data: null, error: { code: 'NOT_FOUND', message: 'No rows matched the query.' } } as never;
      }
      return { data: first as unknown as Row[], error: null };
    }
    return { data: rows, error: null, count: payload?.count ?? null };
  }

  then<R1 = Result<Row[]>, R2 = never>(
    onfulfilled?: ((value: Result<Row[]>) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return this.run().then(onfulfilled as never, onrejected);
  }
}
