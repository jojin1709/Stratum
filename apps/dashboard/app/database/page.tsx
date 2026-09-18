'use client';

import { useMemo, useState } from 'react';
import { ChevronRight, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { api, useApi, RequestFailed, type ApiError } from '@/lib/api';
import { bytes } from '@/lib/format';
import { PageHeader, SubNav } from '@/components/shell';
import { DataTable } from '@/components/data-table';
import { Button, Empty, ErrorNote, Field, Input, Panel, Spinner, Tag } from '@/components/primitives';

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
          // Every new table gets a uuid primary key and created_at, because a table with
          // neither has no /:id route and no natural ordering.
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
      <div className="space-y-3 p-3">
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

export default function DatabasePage() {
  const [selected, setSelected] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [sort, setSort] = useState<{ column: string; ascending: boolean } | null>(null);
  const [creating, setCreating] = useState(false);

  const schema = useApi<Snapshot>('/api/v1/meta/tables');
  const tables = schema.data?.tables ?? [];
  const active = tables.find((t) => `${t.schema}.${t.name}` === selected) ?? null;

  const rowsPath = useMemo(() => {
    if (!active) return null;
    const params = new URLSearchParams({
      schema: active.schema, limit: String(PAGE_SIZE), offset: String(offset), count: 'exact',
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

  return (
    <>
      <PageHeader
        title="Database"
        description="Browse and edit your Postgres schema and data."
        action={
          <div className="flex gap-2">
            <Button size="sm" onClick={schema.reload}><RefreshCw className="h-3.5 w-3.5" /> Refresh</Button>
            <Button size="sm" variant="primary" onClick={() => setCreating(true)}><Plus className="h-3.5 w-3.5" /> New table</Button>
          </div>
        }
      />
      <SubNav
        items={[
          { href: '/database', label: 'Tables' },
          { href: '/database/sql', label: 'SQL editor' },
          { href: '/database/migrations', label: 'Migrations' },
        ]}
      />

      {creating ? (
        <div className="mb-4">
          <NewTableForm onDone={() => { setCreating(false); schema.reload(); }} onCancel={() => setCreating(false)} />
        </div>
      ) : null}

      {schema.error ? <ErrorNote error={schema.error} onRetry={schema.reload} /> : null}

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
                      onClick={() => { setSelected(id); setOffset(0); setSort(null); }}
                      aria-current={isActive ? 'true' : undefined}
                      className={`flex w-full items-center gap-1.5 px-3 py-1.5 text-left text-[13px] ${
                        isActive ? 'bg-accent-soft font-medium text-accent' : 'text-ink-soft hover:bg-sunken hover:text-ink'
                      }`}
                    >
                      <ChevronRight className={`h-3 w-3 shrink-0 ${isActive ? 'text-accent' : 'text-ink-faint'}`} aria-hidden />
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
          ) : (
            <>
              <Panel
                title={`${active.schema}.${active.name}`}
                action={
                  <div className="flex items-center gap-2 text-2xs text-ink-faint">
                    <span>{bytes(active.sizeBytes)}</span>
                    <Button size="sm" variant="danger" onClick={() => dropTable(active)}>Drop table</Button>
                  </div>
                }
              >
                <DataTable
                  maxHeight="18vh"
                  columns={[
                    { key: 'name', label: 'Column' },
                    { key: 'type', label: 'Type' },
                    { key: 'nullable', label: 'Nullable' },
                    { key: 'default', label: 'Default' },
                  ]}
                  rows={active.columns.map((c) => ({
                    name: c.name,
                    type: c.dataType,
                    nullable: c.nullable ? 'yes' : 'no',
                    default: c.defaultValue,
                  }))}
                />
              </Panel>

              <Panel
                title="Rows"
                action={
                  <div className="flex items-center gap-2">
                    <span className="nums text-2xs text-ink-faint">
                      {rows.data?.count !== null && rows.data?.count !== undefined
                        ? `${offset + 1}–${offset + (rows.data.data.length || 0)} of ${rows.data.count}`
                        : ''}
                    </span>
                    <Button size="sm" disabled={offset === 0} onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}>Previous</Button>
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
                  <Spinner label="Loading rows" />
                ) : (
                  <DataTable
                    columns={active.columns.map((c) => ({
                      key: c.name,
                      label: c.isPrimaryKey ? `${c.name} ·pk` : c.name,
                    }))}
                    rows={rows.data?.data ?? []}
                    sort={sort}
                    onSort={(column) =>
                      setSort((s) => (s?.column === column ? { column, ascending: !s.ascending } : { column, ascending: true }))
                    }
                    emptyLabel="This table has no rows yet."
                  />
                )}
              </Panel>

              <p className="text-2xs text-ink-faint">
                Exposed as <Tag tone="accent">GET /api/v1/{active.name}</Tag> with filtering, ordering and pagination.
              </p>
            </>
          )}
        </div>
      </div>
    </>
  );
}
