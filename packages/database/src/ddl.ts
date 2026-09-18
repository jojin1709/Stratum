import {
  assertIdentifier,
  assertPostgresType,
  assertUserSchema,
  err,
  quoteIdent,
  quoteQualified,
  type ColumnDefinition,
  type ForeignKeyAction,
} from '@stratum/shared';
import type { DatabaseAdapter } from './adapter.js';

const FK_ACTIONS: ForeignKeyAction[] = ['NO ACTION', 'RESTRICT', 'CASCADE', 'SET NULL', 'SET DEFAULT'];

/**
 * Default expressions are the one place a raw SQL fragment has to reach the server,
 * so the allowlist is deliberately narrow. Anything else must be set by a migration.
 */
const SAFE_DEFAULT =
  /^(now\(\)|current_timestamp|current_date|gen_random_uuid\(\)|true|false|null|-?\d+(\.\d+)?|'[^'\\;]*'(::[a-z_ ]+(\[\])?)?)$/i;

export function renderDefault(expr: string): string {
  const trimmed = expr.trim();
  if (!SAFE_DEFAULT.test(trimmed)) {
    throw err(
      'VALIDATION_FAILED',
      `Unsupported default expression: ${JSON.stringify(expr)}. Use a literal, now(), or gen_random_uuid(), or set it in a migration.`,
    );
  }
  return trimmed;
}

export function renderColumn(col: ColumnDefinition): string {
  const parts = [quoteIdent(col.name, 'column'), assertPostgresType(col.type)];
  if (col.primaryKey) parts.push('PRIMARY KEY');
  else if (col.nullable === false) parts.push('NOT NULL');
  if (col.unique && !col.primaryKey) parts.push('UNIQUE');
  if (col.defaultValue !== undefined && col.defaultValue !== null) {
    parts.push(`DEFAULT ${renderDefault(col.defaultValue)}`);
  }
  if (col.references) {
    const refSchema = col.references.schema ?? 'public';
    const onDelete = col.references.onDelete ?? 'NO ACTION';
    if (!FK_ACTIONS.includes(onDelete)) {
      throw err('VALIDATION_FAILED', `Unsupported ON DELETE action: ${onDelete}`);
    }
    parts.push(
      `REFERENCES ${quoteQualified(refSchema, col.references.table)} (${quoteIdent(col.references.column, 'column')}) ON DELETE ${onDelete}`,
    );
  }
  return parts.join(' ');
}

export function renderCreateTable(schema: string, table: string, columns: ColumnDefinition[]): string {
  assertUserSchema(schema);
  assertIdentifier(table, 'table');
  if (columns.length === 0) throw err('VALIDATION_FAILED', 'A table needs at least one column.');
  const pkCount = columns.filter((c) => c.primaryKey).length;
  if (pkCount > 1) {
    throw err('VALIDATION_FAILED', 'Composite primary keys must be created through a migration.');
  }
  return `CREATE TABLE ${quoteQualified(schema, table)} (\n  ${columns.map(renderColumn).join(',\n  ')}\n)`;
}

export async function createTable(
  db: DatabaseAdapter,
  schema: string,
  table: string,
  columns: ColumnDefinition[],
): Promise<void> {
  await db.query(renderCreateTable(schema, table, columns));
}

export async function dropTable(
  db: DatabaseAdapter,
  schema: string,
  table: string,
  opts: { cascade?: boolean } = {},
): Promise<void> {
  assertUserSchema(schema);
  await db.query(`DROP TABLE ${quoteQualified(schema, table)}${opts.cascade ? ' CASCADE' : ' RESTRICT'}`);
}

export async function renameTable(
  db: DatabaseAdapter,
  schema: string,
  table: string,
  newName: string,
): Promise<void> {
  assertUserSchema(schema);
  await db.query(`ALTER TABLE ${quoteQualified(schema, table)} RENAME TO ${quoteIdent(newName, 'table')}`);
}

export async function addColumn(
  db: DatabaseAdapter,
  schema: string,
  table: string,
  column: ColumnDefinition,
): Promise<void> {
  assertUserSchema(schema);
  await db.query(`ALTER TABLE ${quoteQualified(schema, table)} ADD COLUMN ${renderColumn(column)}`);
}

export async function dropColumn(
  db: DatabaseAdapter,
  schema: string,
  table: string,
  column: string,
  opts: { cascade?: boolean } = {},
): Promise<void> {
  assertUserSchema(schema);
  await db.query(
    `ALTER TABLE ${quoteQualified(schema, table)} DROP COLUMN ${quoteIdent(column, 'column')}${opts.cascade ? ' CASCADE' : ''}`,
  );
}

export interface ColumnChange {
  rename?: string;
  type?: string;
  nullable?: boolean;
  defaultValue?: string | null;
}

export async function alterColumn(
  db: DatabaseAdapter,
  schema: string,
  table: string,
  column: string,
  change: ColumnChange,
): Promise<void> {
  assertUserSchema(schema);
  const qualified = quoteQualified(schema, table);
  const col = quoteIdent(column, 'column');

  await db.transaction(async (tx) => {
    if (change.type !== undefined) {
      const type = assertPostgresType(change.type);
      await tx.query(`ALTER TABLE ${qualified} ALTER COLUMN ${col} TYPE ${type} USING ${col}::${type}`);
    }
    if (change.nullable !== undefined) {
      await tx.query(`ALTER TABLE ${qualified} ALTER COLUMN ${col} ${change.nullable ? 'DROP NOT NULL' : 'SET NOT NULL'}`);
    }
    if (change.defaultValue !== undefined) {
      await tx.query(
        change.defaultValue === null
          ? `ALTER TABLE ${qualified} ALTER COLUMN ${col} DROP DEFAULT`
          : `ALTER TABLE ${qualified} ALTER COLUMN ${col} SET DEFAULT ${renderDefault(change.defaultValue)}`,
      );
    }
    if (change.rename !== undefined) {
      await tx.query(`ALTER TABLE ${qualified} RENAME COLUMN ${col} TO ${quoteIdent(change.rename, 'column')}`);
    }
  });
}

export async function createIndex(
  db: DatabaseAdapter,
  schema: string,
  table: string,
  opts: { name?: string; columns: string[]; unique?: boolean },
): Promise<string> {
  assertUserSchema(schema);
  if (opts.columns.length === 0) throw err('VALIDATION_FAILED', 'An index needs at least one column.');
  const name = opts.name ?? `idx_${table}_${opts.columns.join('_')}`;
  const cols = opts.columns.map((c) => quoteIdent(c, 'column')).join(', ');
  await db.query(
    `CREATE ${opts.unique ? 'UNIQUE ' : ''}INDEX ${quoteIdent(name, 'index')} ON ${quoteQualified(schema, table)} (${cols})`,
  );
  return name;
}

export async function dropIndex(db: DatabaseAdapter, schema: string, name: string): Promise<void> {
  assertUserSchema(schema);
  await db.query(`DROP INDEX ${quoteQualified(schema, name)}`);
}
