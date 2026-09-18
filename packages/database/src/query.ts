import {
  assertIdentifier,
  err,
  quoteIdent,
  quoteQualified,
  type Filter,
  type FilterOperator,
  type ListParams,
  type Paginated,
  type TableInfo,
} from '@stratum/shared';
import type { DatabaseAdapter } from './adapter.js';
import { getTable } from './introspect.js';

export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 1000;

const OPERATORS: Record<FilterOperator, true> = {
  eq: true, neq: true, gt: true, gte: true, lte: true, lt: true,
  like: true, ilike: true, is: true, in: true, contains: true,
};

/**
 * Parses PostgREST-style query strings into a validated ListParams.
 *   ?limit=20&offset=0&select=id,name&order=created_at.desc&price=gte.100
 * Column names are checked against the live table; values always become bound parameters.
 */
export function parseListParams(
  searchParams: URLSearchParams,
  table: TableInfo,
): ListParams {
  const columnNames = new Set(table.columns.map((c) => c.name));
  const assertColumn = (name: string): string => {
    assertIdentifier(name, 'column');
    if (!columnNames.has(name)) {
      throw err('COLUMN_NOT_FOUND', `Column "${name}" does not exist on ${table.schema}.${table.name}.`);
    }
    return name;
  };

  const rawLimit = searchParams.get('limit');
  let limit = rawLimit === null ? DEFAULT_LIMIT : Number(rawLimit);
  if (!Number.isInteger(limit) || limit < 1) {
    throw err('VALIDATION_FAILED', '`limit` must be a positive integer.');
  }
  limit = Math.min(limit, MAX_LIMIT);

  const rawOffset = searchParams.get('offset');
  const offset = rawOffset === null ? 0 : Number(rawOffset);
  if (!Number.isInteger(offset) || offset < 0) {
    throw err('VALIDATION_FAILED', '`offset` must be a non-negative integer.');
  }

  const rawSelect = searchParams.get('select');
  const select =
    rawSelect === null || rawSelect.trim() === '' || rawSelect.trim() === '*'
      ? null
      : rawSelect.split(',').map((c) => assertColumn(c.trim()));

  const order: ListParams['order'] = [];
  for (const spec of searchParams.getAll('order')) {
    for (const part of spec.split(',')) {
      const [col, ...mods] = part.split('.');
      if (!col) continue;
      order.push({
        column: assertColumn(col.trim()),
        ascending: !mods.includes('desc'),
        nullsFirst: mods.includes('nullsfirst'),
      });
    }
  }

  const reserved = new Set(['limit', 'offset', 'select', 'order', 'count']);
  const filters: Filter[] = [];
  for (const [key, raw] of searchParams.entries()) {
    if (reserved.has(key)) continue;
    const column = assertColumn(key);
    const idx = raw.indexOf('.');
    const op = (idx === -1 ? 'eq' : raw.slice(0, idx)) as FilterOperator;
    const rawValue = idx === -1 ? raw : raw.slice(idx + 1);
    if (!OPERATORS[op]) {
      throw err('VALIDATION_FAILED', `Unsupported filter operator "${op}" on column "${column}".`);
    }
    filters.push({ column, operator: op, value: coerceFilterValue(op, rawValue) });
  }

  return { limit, offset, order, select, filters, count: searchParams.get('count') === 'exact' };
}

function coerceFilterValue(op: FilterOperator, raw: string): unknown {
  if (op === 'in') return raw.replace(/^\(|\)$/g, '').split(',').map((v) => v.trim());
  if (op === 'is') {
    const v = raw.toLowerCase();
    if (v === 'null') return null;
    if (v === 'true') return true;
    if (v === 'false') return false;
    throw err('VALIDATION_FAILED', '`is` accepts only null, true, or false.');
  }
  return raw;
}

interface Built {
  text: string;
  params: unknown[];
}

/** Builds the WHERE clause. Every user value is bound; only validated identifiers are inlined. */
export function buildWhere(filters: Filter[], startIndex = 1): Built {
  if (filters.length === 0) return { text: '', params: [] };
  const params: unknown[] = [];
  const clauses: string[] = [];
  let i = startIndex;

  for (const f of filters) {
    const col = quoteIdent(f.column, 'column');
    switch (f.operator) {
      case 'eq': clauses.push(`${col} = $${i++}`); params.push(f.value); break;
      case 'neq': clauses.push(`${col} <> $${i++}`); params.push(f.value); break;
      case 'gt': clauses.push(`${col} > $${i++}`); params.push(f.value); break;
      case 'gte': clauses.push(`${col} >= $${i++}`); params.push(f.value); break;
      case 'lt': clauses.push(`${col} < $${i++}`); params.push(f.value); break;
      case 'lte': clauses.push(`${col} <= $${i++}`); params.push(f.value); break;
      case 'like': clauses.push(`${col}::text LIKE $${i++}`); params.push(f.value); break;
      case 'ilike': clauses.push(`${col}::text ILIKE $${i++}`); params.push(f.value); break;
      case 'contains': clauses.push(`${col} @> $${i++}`); params.push(f.value); break;
      case 'in': clauses.push(`${col} = ANY($${i++})`); params.push(f.value); break;
      case 'is':
        if (f.value === null) clauses.push(`${col} IS NULL`);
        else clauses.push(`${col} IS ${f.value === true ? 'TRUE' : 'FALSE'}`);
        break;
      default:
        throw err('VALIDATION_FAILED', `Unsupported operator: ${String(f.operator)}`);
    }
  }
  return { text: ` WHERE ${clauses.join(' AND ')}`, params };
}

function buildOrder(order: ListParams['order']): string {
  if (order.length === 0) return '';
  const parts = order.map(
    (o) => `${quoteIdent(o.column, 'column')} ${o.ascending ? 'ASC' : 'DESC'} NULLS ${o.nullsFirst ? 'FIRST' : 'LAST'}`,
  );
  return ` ORDER BY ${parts.join(', ')}`;
}

export function buildSelect(schema: string, table: string, params: ListParams): Built {
  const cols = params.select === null ? '*' : params.select.map((c) => quoteIdent(c, 'column')).join(', ');
  const where = buildWhere(params.filters);
  const limitIdx = where.params.length + 1;
  return {
    text:
      `SELECT ${cols} FROM ${quoteQualified(schema, table)}${where.text}${buildOrder(params.order)}` +
      ` LIMIT $${limitIdx} OFFSET $${limitIdx + 1}`,
    params: [...where.params, params.limit, params.offset],
  };
}

export function buildCount(schema: string, table: string, filters: Filter[]): Built {
  const where = buildWhere(filters);
  return { text: `SELECT count(*)::bigint AS count FROM ${quoteQualified(schema, table)}${where.text}`, params: where.params };
}

export function buildInsert(
  schema: string,
  table: string,
  rows: Record<string, unknown>[],
  allowedColumns: Set<string>,
): Built {
  if (rows.length === 0) throw err('VALIDATION_FAILED', 'No rows supplied.');
  const columns = Object.keys(rows[0] as Record<string, unknown>);
  if (columns.length === 0) throw err('VALIDATION_FAILED', 'Row objects must contain at least one column.');
  for (const c of columns) {
    assertIdentifier(c, 'column');
    if (!allowedColumns.has(c)) throw err('COLUMN_NOT_FOUND', `Column "${c}" does not exist on ${schema}.${table}.`);
  }

  const params: unknown[] = [];
  const tuples = rows.map((row) => {
    const keys = Object.keys(row);
    if (keys.length !== columns.length || keys.some((k) => !columns.includes(k))) {
      throw err('VALIDATION_FAILED', 'All inserted rows must share the same set of columns.');
    }
    return `(${columns.map((c) => { params.push(row[c]); return `$${params.length}`; }).join(', ')})`;
  });

  return {
    text:
      `INSERT INTO ${quoteQualified(schema, table)} (${columns.map((c) => quoteIdent(c, 'column')).join(', ')})` +
      ` VALUES ${tuples.join(', ')} RETURNING *`,
    params,
  };
}

export function buildUpdate(
  schema: string,
  table: string,
  patch: Record<string, unknown>,
  filters: Filter[],
  allowedColumns: Set<string>,
): Built {
  const columns = Object.keys(patch);
  if (columns.length === 0) throw err('VALIDATION_FAILED', 'Update body must contain at least one column.');
  if (filters.length === 0) {
    throw err('VALIDATION_FAILED', 'Refusing to update every row: supply at least one filter.');
  }

  const params: unknown[] = [];
  const sets = columns.map((c) => {
    assertIdentifier(c, 'column');
    if (!allowedColumns.has(c)) throw err('COLUMN_NOT_FOUND', `Column "${c}" does not exist on ${schema}.${table}.`);
    params.push(patch[c]);
    return `${quoteIdent(c, 'column')} = $${params.length}`;
  });

  const where = buildWhere(filters, params.length + 1);
  return {
    text: `UPDATE ${quoteQualified(schema, table)} SET ${sets.join(', ')}${where.text} RETURNING *`,
    params: [...params, ...where.params],
  };
}

export function buildDelete(schema: string, table: string, filters: Filter[]): Built {
  if (filters.length === 0) {
    throw err('VALIDATION_FAILED', 'Refusing to delete every row: supply at least one filter.');
  }
  const where = buildWhere(filters);
  return { text: `DELETE FROM ${quoteQualified(schema, table)}${where.text} RETURNING *`, params: where.params };
}

export async function selectRows(
  db: DatabaseAdapter,
  schema: string,
  table: string,
  searchParams: URLSearchParams,
): Promise<Paginated<Record<string, unknown>>> {
  const info = await getTable(db, schema, table);
  const params = parseListParams(searchParams, info);
  const q = buildSelect(schema, table, params);
  const rows = await db.query(q.text, q.params);

  let count: number | null = null;
  if (params.count) {
    const c = buildCount(schema, table, params.filters);
    const res = await db.query<{ count: number }>(c.text, c.params);
    count = Number(res.rows[0]?.count ?? 0);
  }

  return { data: rows.rows, count, limit: params.limit, offset: params.offset };
}
