import { err } from './errors.js';

/** Postgres identifiers we are willing to interpolate. Everything else must be a bound parameter. */
const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function assertIdentifier(value: string, what = 'identifier'): string {
  if (typeof value !== 'string' || !IDENT.test(value) || value.length > 63) {
    throw err('VALIDATION_FAILED', `Invalid ${what}: ${JSON.stringify(value)}`);
  }
  return value;
}

/** Quotes an identifier after validating it. Used for table/column/schema names only. */
export function quoteIdent(value: string, what = 'identifier'): string {
  return `"${assertIdentifier(value, what)}"`;
}

export function quoteQualified(schema: string, table: string): string {
  return `${quoteIdent(schema, 'schema')}.${quoteIdent(table, 'table')}`;
}

/** Postgres types Stratum will accept in DDL. Keeps arbitrary strings out of CREATE TABLE. */
const BASE_TYPES = new Set([
  'bigint', 'bigserial', 'boolean', 'bytea', 'date', 'double precision', 'inet', 'integer',
  'json', 'jsonb', 'real', 'serial', 'smallint', 'smallserial', 'text', 'time',
  'timetz', 'timestamp', 'timestamptz', 'uuid', 'xml',
]);
const PARAMETERISED = /^(varchar|character varying|char|character|numeric|decimal)\s*\(\s*\d+(\s*,\s*\d+)?\s*\)$/i;

export function assertPostgresType(type: string): string {
  const normalised = String(type).trim().toLowerCase();
  const arrayBase = normalised.endsWith('[]') ? normalised.slice(0, -2).trim() : normalised;
  if (BASE_TYPES.has(arrayBase) || PARAMETERISED.test(arrayBase)) return normalised;
  throw err('VALIDATION_FAILED', `Unsupported column type: ${JSON.stringify(type)}`);
}

/** Schemas Stratum refuses to expose or mutate through the REST/table APIs. */
export const SYSTEM_SCHEMAS = new Set(['pg_catalog', 'information_schema', 'pg_toast', 'stratum', 'baseforge']);

export function assertUserSchema(schema: string): string {
  assertIdentifier(schema, 'schema');
  if (SYSTEM_SCHEMAS.has(schema) || schema.startsWith('pg_')) {
    throw err('FORBIDDEN', `Schema "${schema}" is managed by the system and cannot be modified.`);
  }
  return schema;
}
