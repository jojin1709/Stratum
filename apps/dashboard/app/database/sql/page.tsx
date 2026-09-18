'use client';

import { useState } from 'react';
import { Download, Play } from 'lucide-react';
import { api, RequestFailed, type ApiError } from '@/lib/api';
import { duration } from '@/lib/format';
import { PageHeader, SubNav } from '@/components/shell';
import { DataTable } from '@/components/data-table';
import { Button, ErrorNote, Panel, Tag } from '@/components/primitives';

interface Result { rows: Record<string, unknown>[]; rowCount: number; columns: string[]; command: string; durationMs: number }
interface HistoryEntry { sql: string; at: string; durationMs: number; rowCount: number }

const STARTER = 'select *\nfrom information_schema.tables\nwhere table_schema = \'public\'\norder by table_name;';

function toCsv(columns: string[], rows: Record<string, unknown>[]): string {
  const escape = (v: unknown) => {
    if (v === null || v === undefined) return '';
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [columns.join(','), ...rows.map((r) => columns.map((c) => escape(r[c])).join(','))].join('\n');
}

export default function SqlEditorPage() {
  const [sql, setSql] = useState(STARTER);
  const [readOnly, setReadOnly] = useState(true);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const execute = async () => {
    if (!sql.trim() || running) return;
    setRunning(true);
    setError(null);
    try {
      const res = await api<Result>('/api/v1/rpc/query', {
        method: 'POST',
        body: JSON.stringify({ sql, readOnly }),
      });
      setResult(res);
      setHistory((h) => [{ sql, at: new Date().toISOString(), durationMs: res.durationMs, rowCount: res.rowCount }, ...h].slice(0, 20));
    } catch (e) {
      setResult(null);
      setError(e instanceof RequestFailed ? e.apiError : { code: 'UNKNOWN_ERROR', message: String(e) });
    } finally {
      setRunning(false);
    }
  };

  const download = () => {
    if (!result) return;
    const blob = new Blob([toCsv(result.columns, result.rows)], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `stratum-query-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHeader title="Database" description="Run SQL against your project database." />
      <SubNav
        items={[
          { href: '/database', label: 'Tables' },
          { href: '/database/sql', label: 'SQL editor' },
          { href: '/database/migrations', label: 'Migrations' },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px]">
        <div className="min-w-0 space-y-4">
          <Panel
            title="Query"
            action={
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-xs text-ink-soft">
                  <input type="checkbox" checked={readOnly} onChange={(e) => setReadOnly(e.target.checked)} />
                  Read only
                </label>
                <Button size="sm" variant="primary" onClick={execute} disabled={running}>
                  <Play className="h-3 w-3" /> {running ? 'Running…' : 'Run'}
                </Button>
              </div>
            }
          >
            <textarea
              value={sql}
              onChange={(e) => setSql(e.target.value)}
              onKeyDown={(e) => {
                // Ctrl/Cmd+Enter is the expected way to run a query in every SQL console.
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); void execute(); }
              }}
              spellCheck={false}
              aria-label="SQL query"
              className="thin-scroll h-48 w-full resize-y bg-surface p-3 font-mono text-[13px] leading-relaxed text-ink outline-none"
            />
            <div className="flex items-center justify-between border-t border-line px-3 py-1.5 text-2xs text-ink-faint">
              <span>Cmd/Ctrl + Enter to run</span>
              <span>
                {readOnly
                  ? 'Read-only runs inside a transaction that cannot write.'
                  : 'Writes are enabled — this runs with full database privileges.'}
              </span>
            </div>
          </Panel>

          {error ? <ErrorNote error={error} /> : null}

          {result ? (
            <Panel
              title="Result"
              action={
                <div className="flex items-center gap-2">
                  <Tag>{result.command}</Tag>
                  <span className="nums text-2xs text-ink-faint">
                    {result.rowCount} row{result.rowCount === 1 ? '' : 's'} · {duration(result.durationMs)}
                  </span>
                  {result.rows.length > 0 ? (
                    <Button size="sm" onClick={download}><Download className="h-3 w-3" /> CSV</Button>
                  ) : null}
                </div>
              }
            >
              <DataTable
                columns={result.columns.map((c) => ({ key: c }))}
                rows={result.rows}
                emptyLabel={`${result.command} affected ${result.rowCount} row${result.rowCount === 1 ? '' : 's'} and returned none.`}
              />
            </Panel>
          ) : null}
        </div>

        <Panel title="History">
          {history.length === 0 ? (
            <p className="px-3 py-6 text-[13px] text-ink-faint">Queries you run appear here.</p>
          ) : (
            <ul className="max-h-[60vh] overflow-auto divide-y divide-line">
              {history.map((h, i) => (
                <li key={i}>
                  <button
                    onClick={() => setSql(h.sql)}
                    className="w-full px-3 py-2 text-left hover:bg-sunken"
                    title="Load this query into the editor"
                  >
                    <code className="block truncate font-mono text-2xs text-ink">{h.sql.replace(/\s+/g, ' ')}</code>
                    <span className="nums mt-0.5 block text-2xs text-ink-faint">
                      {h.rowCount} rows · {duration(h.durationMs)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
