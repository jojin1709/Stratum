import { describe, it, expect } from 'vitest';
import type { TableInfo } from '@stratum/shared';
import {
  parseListParams, buildSelect, buildInsert, buildUpdate, buildDelete, buildWhere, buildCount,
  DEFAULT_LIMIT, MAX_LIMIT,
} from '../src/query.js';
import { renderCreateTable, renderColumn, renderDefault } from '../src/ddl.js';
import { splitSections, timestampVersion } from '../src/migrations.js';

const table: TableInfo = {
  schema: 'public',
  name: 'products',
  kind: 'table',
  comment: null,
  estimatedRows: 0,
  sizeBytes: 0,
  primaryKey: ['id'],
  columns: ['id', 'name', 'price', 'created_at', 'tags'].map((name, i) => ({
    name, dataType: 'text', udtName: 'text', nullable: true, defaultValue: null,
    isPrimaryKey: name === 'id', isUnique: false, ordinalPosition: i + 1, maxLength: null, comment: null,
  })),
};
const allowed = new Set(table.columns.map((c) => c.name));
const qs = (s: string) => new URLSearchParams(s);

describe('parseListParams', () => {
  it('applies sane defaults', () => {
    const p = parseListParams(qs(''), table);
    expect(p).toMatchObject({ limit: DEFAULT_LIMIT, offset: 0, select: null, count: false });
    expect(p.filters).toEqual([]);
  });

  it('clamps limit to MAX_LIMIT instead of letting callers pull the whole table', () => {
    expect(parseListParams(qs('limit=999999'), table).limit).toBe(MAX_LIMIT);
  });

  it('rejects nonsense pagination', () => {
    expect(() => parseListParams(qs('limit=0'), table)).toThrow(/positive integer/);
    expect(() => parseListParams(qs('limit=abc'), table)).toThrow();
    expect(() => parseListParams(qs('offset=-1'), table)).toThrow(/non-negative/);
  });

  it('rejects unknown columns everywhere they can appear', () => {
    expect(() => parseListParams(qs('select=id,evil'), table)).toThrow(/does not exist/);
    expect(() => parseListParams(qs('order=evil.desc'), table)).toThrow(/does not exist/);
    expect(() => parseListParams(qs('evil=eq.1'), table)).toThrow(/does not exist/);
  });

  it('rejects unknown operators', () => {
    expect(() => parseListParams(qs('price=explode.1'), table)).toThrow(/Unsupported filter operator/);
  });

  it('parses order, select, filters and count', () => {
    const p = parseListParams(qs('select=id,name&order=created_at.desc&price=gte.100&count=exact'), table);
    expect(p.select).toEqual(['id', 'name']);
    expect(p.order).toEqual([{ column: 'created_at', ascending: false, nullsFirst: false }]);
    expect(p.filters).toEqual([{ column: 'price', operator: 'gte', value: '100' }]);
    expect(p.count).toBe(true);
  });

  it('parses in() lists and is-null', () => {
    const p = parseListParams(qs('id=in.(1,2,3)&name=is.null'), table);
    expect(p.filters[0]).toEqual({ column: 'id', operator: 'in', value: ['1', '2', '3'] });
    expect(p.filters[1]).toEqual({ column: 'name', operator: 'is', value: null });
  });
});

describe('SQL generation', () => {
  it('binds every user value and never inlines it', () => {
    const p = parseListParams(qs("name=eq.'; DROP TABLE products;--&limit=10"), table);
    const q = buildSelect('public', 'products', p);
    expect(q.text).not.toContain('DROP TABLE');
    expect(q.params).toContain("'; DROP TABLE products;--");
    expect(q.text).toBe('SELECT * FROM "public"."products" WHERE "name" = $1 LIMIT $2 OFFSET $3');
  });

  it('quotes identifiers', () => {
    const q = buildSelect('public', 'products', parseListParams(qs('select=id,name&order=price.asc'), table));
    expect(q.text).toContain('SELECT "id", "name"');
    expect(q.text).toContain('ORDER BY "price" ASC NULLS LAST');
  });

  it('renders IS NULL without a parameter', () => {
    const w = buildWhere([{ column: 'name', operator: 'is', value: null }]);
    expect(w.text).toBe(' WHERE "name" IS NULL');
    expect(w.params).toEqual([]);
  });

  it('counts with the same filters', () => {
    const c = buildCount('public', 'products', [{ column: 'price', operator: 'gt', value: 5 }]);
    expect(c.text).toBe('SELECT count(*)::bigint AS count FROM "public"."products" WHERE "price" > $1');
    expect(c.params).toEqual([5]);
  });

  it('builds multi-row inserts', () => {
    const q = buildInsert('public', 'products', [{ name: 'a', price: 1 }, { name: 'b', price: 2 }], allowed);
    expect(q.text).toContain('VALUES ($1, $2), ($3, $4)');
    expect(q.text.endsWith('RETURNING *')).toBe(true);
    expect(q.params).toEqual(['a', 1, 'b', 2]);
  });

  it('rejects inserts into unknown columns and ragged batches', () => {
    expect(() => buildInsert('public', 'products', [{ nope: 1 }], allowed)).toThrow(/does not exist/);
    expect(() => buildInsert('public', 'products', [{ name: 'a' }, { price: 1 }], allowed)).toThrow(/same set of columns/);
  });

  it('refuses unfiltered updates and deletes', () => {
    expect(() => buildUpdate('public', 'products', { name: 'x' }, [], allowed)).toThrow(/at least one filter/);
    expect(() => buildDelete('public', 'products', [])).toThrow(/at least one filter/);
  });

  it('offsets update parameters past the SET clause', () => {
    const q = buildUpdate('public', 'products', { name: 'x' }, [{ column: 'id', operator: 'eq', value: 7 }], allowed);
    expect(q.text).toBe('UPDATE "public"."products" SET "name" = $1 WHERE "id" = $2 RETURNING *');
    expect(q.params).toEqual(['x', 7]);
  });
});

describe('DDL rendering', () => {
  it('renders a create table statement', () => {
    const sql = renderCreateTable('public', 'profiles', [
      { name: 'id', type: 'uuid', primaryKey: true, defaultValue: 'gen_random_uuid()' },
      { name: 'email', type: 'text', nullable: false, unique: true },
      { name: 'created_at', type: 'timestamptz', nullable: false, defaultValue: 'now()' },
    ]);
    expect(sql).toContain('CREATE TABLE "public"."profiles"');
    expect(sql).toContain('"id" uuid PRIMARY KEY DEFAULT gen_random_uuid()');
    expect(sql).toContain('"email" text NOT NULL UNIQUE');
  });

  it('renders foreign keys', () => {
    const sql = renderColumn({
      name: 'owner_id', type: 'uuid',
      references: { table: 'profiles', column: 'id', onDelete: 'CASCADE' },
    });
    expect(sql).toBe('"owner_id" uuid REFERENCES "public"."profiles" ("id") ON DELETE CASCADE');
  });

  it('rejects injected types, names and defaults', () => {
    expect(() => renderColumn({ name: 'x', type: 'text; DROP TABLE y' })).toThrow();
    expect(() => renderColumn({ name: 'x"; --', type: 'text' })).toThrow();
    expect(() => renderDefault("(select password from users)")).toThrow(/Unsupported default/);
    expect(() => renderCreateTable('pg_catalog', 't', [{ name: 'a', type: 'text' }])).toThrow(/managed by the system/);
  });

  it('allows safe defaults', () => {
    expect(renderDefault('now()')).toBe('now()');
    expect(renderDefault("'draft'")).toBe("'draft'");
    expect(renderDefault('0')).toBe('0');
  });
});

describe('adapter configuration', () => {
  it('rejects an injected schema name in searchPath', async () => {
    const { PostgresAdapter } = await import('../src/postgres.js');
    expect(() => new PostgresAdapter({ connectionString: 'postgres://x/y', searchPath: ['public; drop schema public'] }))
      .toThrow(/Invalid schema in searchPath/);
  });
});

describe('migrations', () => {
  it('splits up and down sections', () => {
    const { up, down } = splitSections('-- +stratum up\ncreate table a();\n-- +stratum down\ndrop table a;');
    expect(up).toBe('create table a();');
    expect(down).toBe('drop table a;');
  });

  it('treats marker-less files as up-only', () => {
    expect(splitSections('create table a();').down).toBeNull();
  });

  it('produces sortable UTC versions down to the second, so two migrations made in the same minute do not collide', () => {
    const v = timestampVersion(new Date('2026-09-15T15:30:07Z'));
    expect(v).toBe('20260915153007');
  });
});
