/** Shape produced by `stratum types generate`. */
export interface GenericDatabase {
  public: { Tables: Record<string, { Row: Record<string, unknown>; Insert?: Record<string, unknown>; Update?: Record<string, unknown> }> };
}

export type TableNames<D extends GenericDatabase> = keyof D['public']['Tables'] & string;
export type RowOf<D extends GenericDatabase, T extends TableNames<D>> = D['public']['Tables'][T]['Row'];
export type InsertOf<D extends GenericDatabase, T extends TableNames<D>> =
  D['public']['Tables'][T] extends { Insert: infer I } ? I : Partial<RowOf<D, T>>;
export type UpdateOf<D extends GenericDatabase, T extends TableNames<D>> =
  D['public']['Tables'][T] extends { Update: infer U } ? U : Partial<RowOf<D, T>>;

export interface StratumErrorShape {
  code: string;
  message: string;
  details?: unknown;
}

// Backwards compatibility alias
export type BaseForgeErrorShape = StratumErrorShape;

/**
 * Every SDK call resolves — it never rejects on an API error. Callers check `error`,
 * which makes failure handling explicit instead of dependent on try/catch placement.
 */
export type Result<T> = { data: T; error: null } | { data: null; error: StratumErrorShape };

export interface ClientOptions {
  url: string;
  key: string;
  /** Extra headers merged into every request. */
  headers?: Record<string, string>;
  fetch?: typeof globalThis.fetch;
  /** Overrides the derived ws:// URL, e.g. behind a proxy. */
  realtimeUrl?: string;
}
