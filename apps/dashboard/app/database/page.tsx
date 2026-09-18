'use client';

import { useMemo, useState } from 'react';
import {
  ChevronRight, Plus, RefreshCw, Trash2, Edit2, Search, Database, Layers,
  Table as TableIcon, Network, Key, Check, X, Filter, Download, ArrowRight
} from 'lucide-react';
import { api, useApi, RequestFailed, type ApiError } from '@/lib/api';
import { bytes } from '@/lib/format';
import { PageHeader, SubNav } from '@/components/shell';
import { DataTable } from '@/components/data-table';
import { Button, Empty, ErrorNote, Field, Input, Panel, Spinner, Tag, StatusDot } from '@/components/primitives';

interface ColumnInfo {
  name: string; dataType: string; udtName: string; nullable: boolean;
  defaultValue: string | null; isPrimaryKey: boolean;
}
interface TableInfo {
  schema: string; name: string; kind: string; estimatedRows: number; sizeBytes: number;
  columns: ColumnInfo[]; primaryKey: string[];
}
interface Snapshot { tables: TableInfo[] }
interface Page { data: Record<string, unknown>[]; count: number | null; limit: number; offset: number }

const PAGE_SIZE = 50;

function NewTableForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [name, setName] = useState('');
  const [columns, setColumns] = useState([{ name: 'name', type: 'text', nullable: false }]);
  const [error, setError] = useState<ApiError | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await api('/api/v1/meta/tables', {
        method: 'POST',
        body: JSON.stringify({
          name,
          columns: [
            { name: 'id', type: 'uuid', primaryKey: true, defaultValue: 'gen_random_uuid()' },
            ...columns.filter((c) => c.name.trim()),
            { name: 'created_at', type: 'timestamptz', nullable: false, defaultValue: 'now()' },
          ],
        }),
      });
      onDone();
    } catch (e) {
      setError(e instanceof RequestFailed ? e.apiError : { code: 'UNKNOWN_ERROR', message: String(e) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel title="New table">
      <div className="space-y-3 p-4">
        <Field label="Table name" hint="Lowercase letters, digits and underscores.">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="products" autoFocus />
        </Field>

        <div>
          <p className="mb-1 text-xs font-medium text-ink-soft">Columns</p>
          <p className="mb-2 text-2xs text-ink-faint">An id primary key and created_at are added automatically.</p>
          {columns.map((col, i) => (
            <div key={i} className="mb-1.5 flex gap-1.5">
              <Input
                value={col.name}
                placeholder="column_name"
                onChange={(e) => setColumns((c) => c.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
              />
              <select
                value={col.type}
                onChange={(e) => setColumns((c) => c.map((x, j) => (j === i ? { ...x, type: e.target.value } : x)))}
                className="h-8 rounded border border-line bg-surface px-2 text-[13px]"
              >
                {['text', 'integer', 'bigint', 'numeric(10,2)', 'boolean', 'uuid', 'jsonb', 'timestamptz', 'date'].map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <label className="flex h-8 shrink-0 items-center gap-1.5 px-1 text-xs text-ink-soft">
                <input
                  type="checkbox"
                  checked={col.nullable}
                  onChange={(e) => setColumns((c) => c.map((x, j) => (j === i ? { ...x, nullable: e.target.checked } : x)))}
                />
                nullable
              </label>
              <Button variant="ghost" size="sm" onClick={() => setColumns((c) => c.filter((_, j) => j !== i))} aria-label="Remove column">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          <Button size="sm" onClick={() => setColumns((c) => [...c, { name: '', type: 'text', nullable: true }])}>
            <Plus className="h-3.5 w-3.5" /> Add column
          </Button>
        </div>

        {error ? <ErrorNote error={error} /> : null}

        <div className="flex gap-2 border-t border-line pt-3">
          <Button variant="primary" onClick={submit} disabled={!name.trim() || saving}>
            {saving ? 'Creating…' : 'Create table'}
          </Button>
          <Button onClick={onCancel}>Cancel</Button>
        </div>
      </div>
    </Panel>
  );
}

function InsertRowModal({
  table,
  onDone,
  onCancel,
}: {
  table: TableInfo;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editableColumns = table.columns.filter((c) => c.name !== 'id' && c.name !== 'created_at');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload: Record<string, unknown> = {};
    for (const col of editableColumns) {
      const raw = formData[col.name];
      if (raw === undefined || raw === '') {
        if (!col.nullable && !col.defaultValue) {
          setError(`Column "${col.name}" is required.`);
          setSaving(false);
          return;
        }
        continue;
      }

      if (col.dataType.includes('int') || col.dataType.includes('numeric')) {
        payload[col.name] = Number(raw);
      } else if (col.dataType.includes('bool')) {
        payload[col.name] = raw === 'true';
      } else if (col.dataType.includes('json')) {
        try {
          payload[col.name] = JSON.parse(raw);
        } catch {
          payload[col.name] = raw;
        }
      } else {
        payload[col.name] = raw;
      }
    }

    try {
      const res = await fetch(`/bf/api/v1/${table.name}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Failed to insert row (${res.status})`);
      }

      onDone();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-2xl border border-line bg-surface p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <h3 className="text-base font-semibold text-ink">Insert Row into {table.name}</h3>
          <button onClick={onCancel} className="text-ink-faint hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5 max-h-[60vh] overflow-y-auto pr-1">
          {editableColumns.length === 0 ? (
            <p className="text-xs text-ink-soft">This table only contains auto-generated system columns (id, created_at).</p>
          ) : (
            editableColumns.map((col) => (
              <div key={col.name} className="space-y-1">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="text-ink">{col.name}</span>
                  <span className="font-mono text-2xs text-ink-faint">
                    {col.dataType} {col.nullable ? '(optional)' : '(required)'}
                  </span>
                </div>
                <Input
                  placeholder={col.defaultValue ? `Default: ${col.defaultValue}` : `Enter ${col.dataType}`}
                  value={formData[col.name] || ''}
                  onChange={(e) => setFormData({ ...formData, [col.name]: e.target.value })}
                  className="font-mono text-xs"
                />
              </div>
            ))
          )}

          {error && <div className="rounded-lg bg-critical/10 p-2.5 text-xs text-critical">{error}</div>}

          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <Button type="button" onClick={onCancel}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? 'Inserting…' : 'Insert Row'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ErdView({ tables, onSelectTable }: { tables: TableInfo[]; onSelectTable: (id: string) => void }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-ink-soft">
          Entity Relationship Diagram generated from live PostgreSQL schema metadata.
        </p>
        <Tag tone="accent">{tables.length} Entities</Tag>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {tables.map((t) => {
          const pkSet = new Set(t.primaryKey || ['id']);
          return (
            <div
              key={`${t.schema}.${t.name}`}
              onClick={() => onSelectTable(`${t.schema}.${t.name}`)}
              className="group cursor-pointer rounded-xl border border-line bg-surface p-4 shadow-sm transition-all hover:border-blue-500/60 hover:shadow-md"
            >
              <div className="flex items-center justify-between border-b border-line pb-2.5">
                <div className="flex items-center gap-2">
                  <TableIcon className="h-4 w-4 text-blue-500" />
                  <span className="font-bold text-ink text-sm tracking-tight">{t.name}</span>
                </div>
                <span className="font-mono text-2xs text-ink-faint">{t.columns.length} cols</span>
              </div>

              <div className="mt-2.5 space-y-1.5 font-mono text-xs">
                {t.columns.map((c) => {
                  const isPk = pkSet.has(c.name) || c.isPrimaryKey;
                  return (
                    <div key={c.name} className="flex items-center justify-between py-0.5 text-2xs">
                      <div className="flex items-center gap-1.5 truncate">
                        {isPk ? <Key className="h-3 w-3 text-amber-500 shrink-0" /> : <span className="w-3" />}
                        <span className={`truncate ${isPk ? 'font-bold text-ink' : 'text-ink-soft'}`}>{c.name}</span>
                      </div>
                      <span className="shrink-0 text-ink-faint">{c.dataType}</span>
                    </div>
                  );
                })}
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-line/60 pt-2 text-2xs text-ink-faint">
                <span>{bytes(t.sizeBytes)}</span>
                <span className="inline-flex items-center gap-1 text-blue-600 group-hover:translate-x-0.5 transition-transform dark:text-blue-400">
                  Open Table <ArrowRight className="h-3 w-3" />
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function DatabasePage() {
  const [selected, setSelected] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [sort, setSort] = useState<{ column: string; ascending: boolean } | null>(null);
  const [creating, setCreating] = useState(false);
  const [insertingRow, setInsertingRow] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'schema' | 'erd'>('grid');
  const [searchQuery, setSearchQuery] = useState('');

  const schema = useApi<Snapshot>('/api/v1/meta/tables');
  const tables = schema.data?.tables ?? [];
  const active = tables.find((t) => `${t.schema}.${t.name}` === selected) ?? null;

  // Auto-select first table if none selected
  if (!selected && tables.length > 0 && viewMode !== 'erd') {
    setSelected(`${tables[0].schema}.${tables[0].name}`);
  }

  const rowsPath = useMemo(() => {
    if (!active) return null;
    const params = new URLSearchParams({
      schema: active.schema,
      limit: String(PAGE_SIZE),
      offset: String(offset),
      count: 'exact',
    });
    if (sort) params.set('order', `${sort.column}.${sort.ascending ? 'asc' : 'desc'}`);
    return `/api/v1/${active.name}?${params.toString()}`;
  }, [active, offset, sort]);

  const rows = useApi<Page>(rowsPath);

  const dropTable = async (t: TableInfo) => {
    if (!window.confirm(`Drop ${t.schema}.${t.name}? Every row in it is deleted permanently.`)) return;
    await api(`/api/v1/meta/tables/${t.schema}/${t.name}?cascade=true`, { method: 'DELETE' });
    setSelected(null);
    schema.reload();
  };

  const deleteRow = async (rowId: string) => {
    if (!active) return;
    if (!window.confirm(`Delete row ${rowId}?`)) return;
    try {
      const res = await fetch(`/bf/api/v1/${active.name}?id=eq.${rowId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        rows.reload();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const filteredRows = useMemo(() => {
    const list = rows.data?.data ?? [];
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter((r) => Object.values(r).some((v) => String(v).toLowerCase().includes(q)));
  }, [rows.data?.data, searchQuery]);

  return (
    <>
      <PageHeader
        title="Database"
        description="Browse, query, and edit your PostgreSQL schemas, rows, and relationships."
        action={
          <div className="flex gap-2">
            <Button size="sm" onClick={() => { schema.reload(); rows.reload(); }}>
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
            <Button size="sm" variant="primary" onClick={() => setCreating(true)}>
              <Plus className="h-3.5 w-3.5" /> New table
            </Button>
          </div>
        }
      />
      <SubNav
        items={[
          { href: '/database', label: 'Tables' },
          { href: '/database/sql', label: 'SQL editor' },
          { href: '/database/migrations', label: 'Migrations' },
          { href: '/database/webhooks', label: 'Webhooks' },
        ]}
      />

      {creating ? (
        <div className="mb-4">
          <NewTableForm onDone={() => { setCreating(false); schema.reload(); }} onCancel={() => setCreating(false)} />
        </div>
      ) : null}

      {insertingRow && active ? (
        <InsertRowModal
          table={active}
          onDone={() => { setInsertingRow(false); rows.reload(); }}
          onCancel={() => setInsertingRow(false)}
        />
      ) : null}

      {schema.error ? <ErrorNote error={schema.error} onRetry={schema.reload} /> : null}

      {/* View Switcher Ribbon */}
      <div className="mb-4 flex items-center justify-between border-b border-line pb-3">
        <div className="flex items-center gap-1.5 rounded-lg border border-line bg-surface p-1">
          <button
            onClick={() => setViewMode('grid')}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
              viewMode === 'grid' ? 'bg-blue-600 text-white shadow-xs' : 'text-ink-soft hover:text-ink'
            }`}
          >
            <TableIcon className="h-3.5 w-3.5" /> Data Grid
          </button>
          <button
            onClick={() => setViewMode('schema')}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
              viewMode === 'schema' ? 'bg-blue-600 text-white shadow-xs' : 'text-ink-soft hover:text-ink'
            }`}
          >
            <Layers className="h-3.5 w-3.5" /> Schema Columns
          </button>
          <button
            onClick={() => setViewMode('erd')}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
              viewMode === 'erd' ? 'bg-blue-600 text-white shadow-xs' : 'text-ink-soft hover:text-ink'
            }`}
          >
            <Network className="h-3.5 w-3.5" /> Visual ERD
          </button>
        </div>

        {viewMode === 'grid' && active && (
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" />
              <input
                type="text"
                placeholder="Filter rows..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 rounded-lg border border-line bg-surface pl-8 pr-3 text-xs text-ink outline-none placeholder:text-ink-faint focus:border-blue-500"
              />
            </div>
            <Button size="sm" variant="primary" onClick={() => setInsertingRow(true)}>
              <Plus className="h-3.5 w-3.5" /> Insert Row
            </Button>
          </div>
        )}
      </div>

      {viewMode === 'erd' ? (
        <ErdView tables={tables} onSelectTable={(id) => { setSelected(id); setViewMode('grid'); }} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
          <Panel title={`Tables (${tables.length})`}>
            {schema.loading ? (
              <Spinner />
            ) : tables.length === 0 ? (
              <Empty
                title="No tables yet. Create one here, or add it in a migration so the schema is versioned."
                action={<Button size="sm" variant="primary" onClick={() => setCreating(true)}>New table</Button>}
              />
            ) : (
              <ul className="max-h-[60vh] overflow-auto py-1">
                {tables.map((t) => {
                  const id = `${t.schema}.${t.name}`;
                  const isActive = id === selected;
                  return (
                    <li key={id}>
                      <button
                        onClick={() => { setSelected(id); setOffset(0); setSort(null); setSearchQuery(''); }}
                        aria-current={isActive ? 'true' : undefined}
                        className={`flex w-full items-center gap-1.5 px-3 py-2 text-left text-[13px] ${
                          isActive ? 'bg-blue-500/10 font-semibold text-blue-600 dark:text-blue-400' : 'text-ink-soft hover:bg-sunken hover:text-ink'
                        }`}
                      >
                        <ChevronRight className={`h-3 w-3 shrink-0 ${isActive ? 'text-blue-500' : 'text-ink-faint'}`} aria-hidden />
                        <span className="truncate font-mono text-xs">{t.name}</span>
                        <span className="nums ml-auto shrink-0 text-2xs text-ink-faint">{t.columns.length}c</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <div className="min-w-0 space-y-4">
            {!active ? (
              <Panel><Empty title="Pick a table to browse its rows and inspect its columns." /></Panel>
            ) : viewMode === 'schema' ? (
              <Panel
                title={`${active.schema}.${active.name} — Schema Definition`}
                action={
                  <div className="flex items-center gap-2 text-2xs text-ink-faint">
                    <span>{bytes(active.sizeBytes)}</span>
                    <Button size="sm" variant="danger" onClick={() => dropTable(active)}>Drop table</Button>
                  </div>
                }
              >
                <DataTable
                  maxHeight="50vh"
                  columns={[
                    { key: 'name', label: 'Column' },
                    { key: 'type', label: 'Type' },
                    { key: 'nullable', label: 'Nullable' },
                    { key: 'default', label: 'Default' },
                  ]}
                  rows={active.columns.map((c) => ({
                    name: (
                      <span className="flex items-center gap-1.5 font-medium text-ink">
                        {c.isPrimaryKey && <Key className="h-3 w-3 text-amber-500" />}
                        {c.name}
                      </span>
                    ),
                    type: <code className="font-mono text-2xs">{c.dataType}</code>,
                    nullable: c.nullable ? 'YES' : 'NO',
                    default: c.defaultValue ? <code className="font-mono text-2xs">{c.defaultValue}</code> : '—',
                  }))}
                />
              </Panel>
            ) : (
              /* Data Grid View */
              <>
                <Panel
                  title={`${active.schema}.${active.name} — Data Rows`}
                  action={
                    <div className="flex items-center gap-2">
                      <span className="nums text-2xs text-ink-faint">
                        {rows.data?.count !== null && rows.data?.count !== undefined
                          ? `${offset + 1}–${offset + (filteredRows.length || 0)} of ${rows.data.count}`
                          : `${filteredRows.length} rows`}
                      </span>
                      <Button size="sm" disabled={offset === 0} onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}>
                        Previous
                      </Button>
                      <Button
                        size="sm"
                        disabled={!rows.data || offset + PAGE_SIZE >= (rows.data.count ?? 0)}
                        onClick={() => setOffset((o) => o + PAGE_SIZE)}
                      >
                        Next
                      </Button>
                    </div>
                  }
                >
                  {rows.error ? (
                    <div className="p-3"><ErrorNote error={rows.error} onRetry={rows.reload} /></div>
                  ) : rows.loading ? (
                    <Spinner label="Loading rows from Postgres..." />
                  ) : (
                    <DataTable
                      columns={[
                        ...active.columns.map((c) => ({
                          key: c.name,
                          label: c.isPrimaryKey ? `${c.name} 🔑` : c.name,
                          render: (row: Record<string, unknown>) => {
                            const val = row[c.name];
                            if (val === null || val === undefined) return <span className="text-ink-faint italic font-mono text-2xs">null</span>;
                            if (typeof val === 'object') return <span className="font-mono text-2xs truncate max-w-xs">{JSON.stringify(val)}</span>;
                            return <span className="font-mono text-xs">{String(val)}</span>;
                          },
                        })),
                        {
                          key: '_actions',
                          label: 'Actions',
                          align: 'right' as const,
                          render: (row: Record<string, unknown>) => (
                            <button
                              onClick={() => deleteRow(String(row.id || ''))}
                              className="p-1 text-ink-faint hover:text-critical transition-colors"
                              title="Delete row"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          ),
                        },
                      ]}
                      rows={filteredRows}
                      sort={sort}
                      onSort={(column) =>
                        setSort((s) => (s?.column === column ? { column, ascending: !s.ascending } : { column, ascending: true }))
                      }
                      emptyLabel={searchQuery ? 'No matching rows found.' : 'This table has no rows yet. Click "Insert Row" above.'}
                    />
                  )}
                </Panel>

                <div className="flex items-center justify-between text-2xs text-ink-faint">
                  <span>
                    Direct Edge REST: <Tag tone="accent">GET /api/v1/{active.name}</Tag>
                  </span>
                  <span>{bytes(active.sizeBytes)} on disk</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
