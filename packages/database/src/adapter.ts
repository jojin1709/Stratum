import type { QueryResult } from '@stratum/shared';

/**
 * The single seam between Stratum and a database engine.
 *
 * All SQL generation, introspection, and migration logic runs through this interface.
 * Today the implementation is PostgresAdapter; an SQLite adapter (for local zero-Docker
 * dev) or Cloudflare Hyperdrive / Neon serverless adapter implements this same seam.
 */
export interface DatabaseAdapter {
  readonly dialect: 'postgres' | 'sqlite';

  /** Executes parameterized SQL. Multi-statement scripts return the last statement's result. */
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;

  /** Runs `fn` inside a transaction. Automatically rolls back on any thrown error. */
  transaction<T>(fn: (tx: DatabaseAdapter) => Promise<T>): Promise<T>;

  /** Pings the database and returns latency and engine version. Never throws. */
  healthcheck(): Promise<{ ok: boolean; latencyMs: number; version: string }>;

  /** Connection pool metrics. */
  stats(): { total: number; idle: number; waiting: number };

  /** Closes all connections. */
  close(): Promise<void>;
}
