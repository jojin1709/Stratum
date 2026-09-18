import {
  SYSTEM_SCHEMAS,
  assertIdentifier,
  err,
  type ColumnInfo,
  type ForeignKeyInfo,
  type IndexInfo,
  type SchemaSnapshot,
  type TableInfo,
} from '@stratum/shared';
import type { DatabaseAdapter } from './adapter.js';

const EXCLUDED = [...SYSTEM_SCHEMAS];

export async function listSchemas(db: DatabaseAdapter): Promise<string[]> {
  const res = await db.query<{ nspname: string }>(
    `select nspname from pg_namespace
      where nspname not in (select unnest($1::text[]))
        and nspname not like 'pg\\_%'
      order by nspname`,
    [EXCLUDED],
  );
  return res.rows.map((r) => r.nspname);
}

export async function listTables(db: DatabaseAdapter, schema?: string): Promise<TableInfo[]> {
  if (schema) assertIdentifier(schema, 'schema');
  const res = await db.query<{
    schema: string;
    name: string;
    kind: string;
    comment: string | null;
    estimated_rows: number;
    size_bytes: number;
  }>(
    `select n.nspname as schema,
            c.relname as name,
            case c.relkind when 'r' then 'table' when 'v' then 'view' when 'm' then 'materialized_view' end as kind,
            obj_description(c.oid) as comment,
            greatest(c.reltuples, 0)::bigint as estimated_rows,
            pg_total_relation_size(c.oid) as size_bytes
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
      where c.relkind in ('r','v','m')
        and n.nspname not in (select unnest($1::text[]))
        and n.nspname not like 'pg\\_%'
        and ($2::text is null or n.nspname = $2)
      order by n.nspname, c.relname`,
    [EXCLUDED, schema ?? null],
  );

  const tables = res.rows;
  if (tables.length === 0) return [];

  const columns = await listColumns(db, schema);
  const byTable = new Map<string, ColumnInfo[]>();
  for (const c of columns) {
    const key = `${c.__schema}.${c.__table}`;
    const list = byTable.get(key) ?? [];
    const { __schema: _s, __table: _t, ...rest } = c;
    list.push(rest);
    byTable.set(key, list);
  }

  return tables.map((t) => {
    const cols = byTable.get(`${t.schema}.${t.name}`) ?? [];
    return {
      schema: t.schema,
      name: t.name,
      kind: (t.kind ?? 'table') as TableInfo['kind'],
      comment: t.comment,
      estimatedRows: Number(t.estimated_rows),
      sizeBytes: Number(t.size_bytes),
      columns: cols,
      primaryKey: cols.filter((c) => c.isPrimaryKey).map((c) => c.name),
    };
  });
}

type ColumnRow = ColumnInfo & { __schema: string; __table: string };

export async function listColumns(db: DatabaseAdapter, schema?: string): Promise<ColumnRow[]> {
  const res = await db.query<Record<string, unknown>>(
    `select c.table_schema      as schema,
            c.table_name        as table,
            c.column_name       as name,
            c.data_type         as data_type,
            c.udt_name          as udt_name,
            (c.is_nullable = 'YES') as nullable,
            c.column_default    as default_value,
            c.ordinal_position  as ordinal_position,
            c.character_maximum_length as max_length,
            col_description(cls.oid, c.ordinal_position) as comment,
            coalesce(pk.is_pk, false)     as is_primary_key,
            coalesce(uq.is_unique, false) as is_unique
       from information_schema.columns c
       join pg_class cls      on cls.relname = c.table_name
       join pg_namespace nsp  on nsp.oid = cls.relnamespace and nsp.nspname = c.table_schema
       left join lateral (
            select true as is_pk
              from pg_index i
             where i.indrelid = cls.oid and i.indisprimary
               and c.ordinal_position = any(i.indkey::int[])
             limit 1
       ) pk on true
       left join lateral (
            select true as is_unique
              from pg_index i
             where i.indrelid = cls.oid and i.indisunique and not i.indisprimary
               and c.ordinal_position = any(i.indkey::int[])
             limit 1
       ) uq on true
      where c.table_schema not in (select unnest($1::text[]))
        and c.table_schema not like 'pg\\_%'
        and ($2::text is null or c.table_schema = $2)
      order by c.table_schema, c.table_name, c.ordinal_position`,
    [EXCLUDED, schema ?? null],
  );

  return res.rows.map((r) => ({
    __schema: String(r.schema),
    __table: String(r.table),
    name: String(r.name),
    dataType: String(r.data_type),
    udtName: String(r.udt_name),
    nullable: Boolean(r.nullable),
    defaultValue: (r.default_value as string | null) ?? null,
    isPrimaryKey: Boolean(r.is_primary_key),
    isUnique: Boolean(r.is_unique),
    ordinalPosition: Number(r.ordinal_position),
    maxLength: r.max_length === null ? null : Number(r.max_length),
    comment: (r.comment as string | null) ?? null,
  }));
}

export async function listForeignKeys(db: DatabaseAdapter, schema?: string): Promise<ForeignKeyInfo[]> {
  const res = await db.query<Record<string, unknown>>(
    `select con.conname as constraint_name,
            nsp.nspname as schema,
            rel.relname as table,
            fnsp.nspname as referenced_schema,
            frel.relname as referenced_table,
            (select array_agg(att.attname order by u.ord)
               from unnest(con.conkey) with ordinality as u(attnum, ord)
               join pg_attribute att on att.attrelid = rel.oid and att.attnum = u.attnum) as columns,
            (select array_agg(att.attname order by u.ord)
               from unnest(con.confkey) with ordinality as u(attnum, ord)
               join pg_attribute att on att.attrelid = frel.oid and att.attnum = u.attnum) as referenced_columns,
            con.confdeltype as on_delete,
            con.confupdtype as on_update
       from pg_constraint con
       join pg_class rel      on rel.oid = con.conrelid
       join pg_namespace nsp  on nsp.oid = rel.relnamespace
       join pg_class frel     on frel.oid = con.confrelid
       join pg_namespace fnsp on fnsp.oid = frel.relnamespace
      where con.contype = 'f'
        and nsp.nspname not in (select unnest($1::text[]))
        and ($2::text is null or nsp.nspname = $2)
      order by nsp.nspname, rel.relname, con.conname`,
    [EXCLUDED, schema ?? null],
  );

  const action = (c: unknown): string =>
    ({ a: 'NO ACTION', r: 'RESTRICT', c: 'CASCADE', n: 'SET NULL', d: 'SET DEFAULT' })[String(c)] ?? 'NO ACTION';

  return res.rows.map((r) => ({
    constraintName: String(r.constraint_name),
    schema: String(r.schema),
    table: String(r.table),
    columns: (r.columns as string[]) ?? [],
    referencedSchema: String(r.referenced_schema),
    referencedTable: String(r.referenced_table),
    referencedColumns: (r.referenced_columns as string[]) ?? [],
    onDelete: action(r.on_delete),
    onUpdate: action(r.on_update),
  }));
}

export async function listIndexes(db: DatabaseAdapter, schema?: string): Promise<IndexInfo[]> {
  const res = await db.query<Record<string, unknown>>(
    `select i.relname   as name,
            n.nspname   as schema,
            t.relname   as table,
            pg_get_indexdef(i.oid) as definition,
            ix.indisunique  as is_unique,
            ix.indisprimary as is_primary
       from pg_index ix
       join pg_class i     on i.oid = ix.indexrelid
       join pg_class t     on t.oid = ix.indrelid
       join pg_namespace n on n.oid = t.relnamespace
      where n.nspname not in (select unnest($1::text[]))
        and n.nspname not like 'pg\\_%'
        and ($2::text is null or n.nspname = $2)
      order by n.nspname, t.relname, i.relname`,
    [EXCLUDED, schema ?? null],
  );

  return res.rows.map((r) => ({
    name: String(r.name),
    schema: String(r.schema),
    table: String(r.table),
    definition: String(r.definition),
    isUnique: Boolean(r.is_unique),
    isPrimary: Boolean(r.is_primary),
  }));
}

export async function snapshotSchema(db: DatabaseAdapter, schema?: string): Promise<SchemaSnapshot> {
  const [schemas, tables, foreignKeys, indexes] = await Promise.all([
    listSchemas(db),
    listTables(db, schema),
    listForeignKeys(db, schema),
    listIndexes(db, schema),
  ]);
  return { generatedAt: new Date().toISOString(), schemas, tables, foreignKeys, indexes };
}

export async function getTable(db: DatabaseAdapter, schema: string, table: string): Promise<TableInfo> {
  const tables = await listTables(db, schema);
  const found = tables.find((t) => t.name === table);
  if (!found) throw err('TABLE_NOT_FOUND', `Table "${schema}.${table}" does not exist.`);
  return found;
}
