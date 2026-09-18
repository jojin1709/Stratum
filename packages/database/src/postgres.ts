import pg from 'pg';
import { err, type QueryResult } from '@stratum/shared';
import type { DatabaseAdapter } from './adapter.js';

const { Pool, types } = pg;

// int8 arrives as a string by default; counts and ids are far more useful as numbers
types.setTypeParser(20, (v) => {
  const n = Number(v);
  return Number.isSafeInteger(n) ? n : v;
});

const CLIENT_ERROR_CLASSES = ['22', '23', '42', '2B', '40'];

function mapPgError(e: unknown): never {
  const pe = e as { code?: string; message?: string; detail?: string; hint?: string; position?: string };
  if (pe?.code) {
    const cls = pe.code.slice(0, 2);
    if (pe.code === '42P01') throw err('TABLE_NOT_FOUND', pe.message ?? 'Relation does not exist.');
    if (pe.code === '42703') throw err('COLUMN_NOT_FOUND', pe.message ?? 'Column does not exist.');
    if (pe.code === '23505') throw err('CONFLICT', pe.message ?? 'Unique constraint violated.', { detail: pe.detail });
    if (CLIENT_ERROR_CLASSES.includes(cls)) {
      throw err('SQL_ERROR', pe.message ?? 'SQL error.', {
        pgCode: pe.code,
        hint: pe.hint,
        position: pe.position ? Number(pe.position) : undefined,
      });
    }
  }
  throw err('INTERNAL_ERROR', pe?.message ?? 'Database error.');
}

export interface PostgresAdapterOptions {
  connectionString: string;
  max?: number;
  statementTimeoutMs?: number;
  applicationName?: string;
  searchPath?: string[];
}

export class PostgresAdapter implements DatabaseAdapter {
  readonly dialect = 'postgres' as const;
  private readonly pool: pg.Pool;

  constructor(opts: PostgresAdapterOptions) {
    const searchPath = (opts.searchPath ?? ['public']).map((s) => {
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(s)) throw err('VALIDATION_FAILED', `Invalid schema in searchPath: ${s}`);
      return s;
    });

    const isDirectCloud = opts.connectionString.includes('aivencloud.com') ||
      opts.connectionString.includes('neon.tech') ||
      opts.connectionString.includes('supabase.co');

    const cleanConnectionString = opts.connectionString
      .replace(/([?&])sslmode=[^&]+(&|$)/, '$1')
      .replace(/\?$/, '')
      .replace(/&$/, '');

    this.pool = new Pool({
      connectionString: cleanConnectionString,
      options: `-c search_path=${searchPath.join(',')}`,
      max: opts.max ?? 2,
      ssl: isDirectCloud ? { rejectUnauthorized: false } : undefined,
      application_name: opts.applicationName ?? 'stratum',
      statement_timeout: opts.statementTimeoutMs ?? 15_000,
      idleTimeoutMillis: 5_000,
      connectionTimeoutMillis: 5_000,
    });

    this.pool.on('error', () => {});
  }

  async query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<QueryResult<T>> {
    const started = performance.now();
    try {
      const raw = await this.pool.query({ text: sql, values: params });
      const res = Array.isArray(raw) ? (raw.at(-1) as typeof raw[number]) : raw;
      return {
        rows: (res.rows ?? []) as T[],
        rowCount: res.rowCount ?? res.rows?.length ?? 0,
        fields: (res.fields ?? []).map((f: pg.FieldDef) => ({ name: f.name, dataTypeId: f.dataTypeID })),
        command: res.command,
        durationMs: Math.round((performance.now() - started) * 100) / 100,
      };
    } catch (e) {
      mapPgError(e);
    }
  }

  async transaction<T>(fn: (tx: DatabaseAdapter) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    const tx: DatabaseAdapter = {
      dialect: 'postgres',
      query: async <R>(sql: string, params: unknown[] = []) => {
        const started = performance.now();
        try {
          const raw = await client.query({ text: sql, values: params });
          const res = Array.isArray(raw) ? (raw.at(-1) as typeof raw[number]) : raw;
          return {
            rows: (res.rows ?? []) as R[],
            rowCount: res.rowCount ?? res.rows?.length ?? 0,
            fields: (res.fields ?? []).map((f: pg.FieldDef) => ({ name: f.name, dataTypeId: f.dataTypeID })),
            command: res.command,
            durationMs: Math.round((performance.now() - started) * 100) / 100,
          };
        } catch (e) {
          mapPgError(e);
        }
      },
      transaction: async (inner) => inner(tx),
      healthcheck: () => this.healthcheck(),
      stats: () => this.stats(),
      close: async () => {},
    };

    try {
      await client.query('BEGIN');
      const result = await fn(tx);
      await client.query('COMMIT');
      return result;
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  }

  async healthcheck() {
    const started = performance.now();
    try {
      const res = await this.query<{ version: string }>('select version() as version');
      return {
        ok: true,
        latencyMs: Math.round((performance.now() - started) * 100) / 100,
        version: res.rows[0]?.version ?? 'PostgreSQL 18.6',
      };
    } catch {
      return {
        ok: false,
        latencyMs: 0,
        version: 'unknown',
      };
    }
  }

  stats() {
    return { total: this.pool.totalCount, idle: this.pool.idleCount, waiting: this.pool.waitingCount };
  }

  async close() {
    await this.pool.end();
  }
}
