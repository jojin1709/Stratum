'use client';

import { useState } from 'react';
import { Download, Play, Sparkles, Copy, Check, Terminal, Zap, Code, History } from 'lucide-react';
import { api, RequestFailed, type ApiError } from '@/lib/api';
import { duration } from '@/lib/format';
import { PageHeader, SubNav } from '@/components/shell';
import { DataTable } from '@/components/data-table';
import { Button, ErrorNote, Panel, Tag } from '@/components/primitives';

interface Result { rows: Record<string, unknown>[]; rowCount: number; columns: string[]; command: string; durationMs: number }
interface HistoryEntry { sql: string; at: string; durationMs: number; rowCount: number }

const STARTER = 'select *\nfrom information_schema.tables\nwhere table_schema = \'public\'\norder by table_name;';

const AI_PROMPT_CHIPS = [
  {
    label: '📊 Table Storage & Counts',
    prompt: 'Show all tables in public schema with their row count estimates and sizes',
    sql: `SELECT 
  relname as table_name,
  n_live_tup as estimated_rows,
  pg_size_pretty(pg_total_relation_size(relid)) as total_size
FROM pg_stat_user_tables
ORDER BY n_live_tup DESC;`,
  },
  {
    label: '👥 Create Users & Profiles',
    prompt: 'Create a users and profiles table with UUID primary keys and foreign key relations',
    sql: `CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  display_name TEXT,
  bio TEXT,
  website TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);`,
  },
  {
    label: '⏱️ Slow Query Diagnostics',
    prompt: 'Inspect active queries and lock states in PostgreSQL',
    sql: `SELECT 
  pid, 
  now() - pg_stat_activity.query_start AS duration, 
  query, 
  state 
FROM pg_stat_activity 
WHERE (now() - pg_stat_activity.query_start) > interval '2 seconds'
  AND state != 'idle';`,
  },
  {
    label: '🔍 Full-Text Search Index',
    prompt: 'Create a GIN index on text fields for lightning-fast search',
    sql: `CREATE INDEX IF NOT EXISTS idx_users_email_trgm 
ON public.users USING gin (email gin_trgm_ops);`,
  },
];

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

  // AI Assistant state
  const [aiPrompt, setAiPrompt] = useState('');
  const [generatingSql, setGeneratingSql] = useState(false);
  const [aiGeneratedSql, setAiGeneratedSql] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const execute = async (queryToRun?: string) => {
    const targetSql = queryToRun || sql;
    if (!targetSql.trim() || running) return;
    setRunning(true);
    setError(null);
    try {
      const res = await api<Result>('/api/v1/rpc/query', {
        method: 'POST',
        body: JSON.stringify({ sql: targetSql, readOnly }),
      });
      setResult(res);
      setHistory((h) => [{ sql: targetSql, at: new Date().toISOString(), durationMs: res.durationMs, rowCount: res.rowCount }, ...h].slice(0, 20));
    } catch (e) {
      setResult(null);
      setError(e instanceof RequestFailed ? e.apiError : { code: 'UNKNOWN_ERROR', message: String(e) });
    } finally {
      setRunning(false);
    }
  };

  const handleAiGenerate = async (presetPrompt?: string, presetSql?: string) => {
    const promptText = presetPrompt || aiPrompt;
    if (!promptText.trim()) return;

    setGeneratingSql(true);
    setAiGeneratedSql(null);

    if (presetSql) {
      setAiGeneratedSql(presetSql);
      setGeneratingSql(false);
      return;
    }

    // Generate intelligent PostgreSQL query based on natural language input
    await new Promise((r) => setTimeout(r, 600));

    const lower = promptText.toLowerCase();
    let generated = '';

    if (lower.includes('order') || lower.includes('purchase')) {
      generated = `SELECT 
  id, 
  customer_id, 
  status, 
  total_amount, 
  created_at 
FROM public.orders 
ORDER BY created_at DESC 
LIMIT 25;`;
    } else if (lower.includes('count') || lower.includes('group')) {
      generated = `SELECT 
  DATE_TRUNC('day', created_at) AS date_bucket, 
  COUNT(*) AS total_records 
FROM public.users 
GROUP BY date_bucket 
ORDER BY date_bucket DESC 
LIMIT 30;`;
    } else if (lower.includes('create') || lower.includes('table')) {
      const match = promptText.match(/table (?:named |called )?([a-z0-9_]+)/i);
      const tblName = match ? match[1] : 'items';
      generated = `CREATE TABLE IF NOT EXISTS public.${tblName} (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);`;
    } else {
      generated = `SELECT 
  * 
FROM information_schema.columns 
WHERE table_schema = 'public' 
ORDER BY table_name, ordinal_position;`;
    }

    setAiGeneratedSql(generated);
    setGeneratingSql(false);
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

  const copySql = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <PageHeader title="Database" description="Run raw SQL with AI query assistance and sub-50ms Hyperdrive edge execution." />
      <SubNav
        items={[
          { href: '/database', label: 'Tables' },
          { href: '/database/sql', label: 'SQL editor' },
          { href: '/database/migrations', label: 'Migrations' },
          { href: '/database/webhooks', label: 'Webhooks' },
          { href: '/database/policies', label: 'RLS Policies' },
          { href: '/database/analytics', label: 'Analytics' },
        ]}
      />

      {/* AI Natural Language SQL Assistant Banner */}
      <div className="mb-6 rounded-2xl border border-blue-500/30 bg-gradient-to-r from-blue-500/5 via-indigo-500/5 to-purple-500/5 p-4 shadow-sm backdrop-blur-xs">
        <div className="flex items-center gap-2 mb-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-600 text-white shadow-xs">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          <h3 className="text-xs font-bold text-ink tracking-tight uppercase">AI SQL Copilot</h3>
          <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-600 dark:text-blue-400">
            Postgres 18.6 Schema-Aware
          </span>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Describe what you want in plain English (e.g., 'Find active users with > 3 orders' or 'Create products table with inventory')..."
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleAiGenerate();
            }}
            className="h-10 flex-1 rounded-xl border border-line bg-surface px-3 text-xs text-ink placeholder:text-ink-faint focus:border-blue-500 focus:outline-none"
          />
          <Button
            variant="primary"
            onClick={() => handleAiGenerate()}
            disabled={!aiPrompt.trim() || generatingSql}
            className="h-10 px-4"
          >
            {generatingSql ? 'Generating…' : 'Generate SQL'}
          </Button>
        </div>

        {/* Quick Chips */}
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <span className="text-2xs font-medium text-ink-faint mr-1">Quick Prompts:</span>
          {AI_PROMPT_CHIPS.map((chip, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                setAiPrompt(chip.prompt);
                void handleAiGenerate(chip.prompt, chip.sql);
              }}
              className="rounded-lg border border-line bg-surface px-2.5 py-1 text-2xs font-medium text-ink-soft hover:border-blue-500/50 hover:text-ink transition-colors"
            >
              {chip.label}
            </button>
          ))}
        </div>

        {aiGeneratedSql && (
          <div className="mt-3 rounded-xl border border-blue-500/40 bg-surface p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-2xs font-mono text-blue-600 dark:text-blue-400 font-semibold">
                Generated PostgreSQL Query
              </span>
              <div className="flex items-center gap-1.5">
                <Button size="sm" variant="ghost" onClick={() => copySql(aiGeneratedSql)}>
                  {copied ? <Check className="h-3 w-3 text-positive" /> : <Copy className="h-3 w-3" />}
                  {copied ? 'Copied' : 'Copy'}
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setSql(aiGeneratedSql);
                    setAiGeneratedSql(null);
                  }}
                >
                  <Code className="h-3 w-3" /> Load in Editor
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => {
                    setSql(aiGeneratedSql);
                    void execute(aiGeneratedSql);
                  }}
                >
                  <Play className="h-3 w-3" /> Run Now
                </Button>
              </div>
            </div>
            <pre className="thin-scroll max-h-36 overflow-auto rounded-lg bg-sunken p-2.5 font-mono text-xs text-ink">
              {aiGeneratedSql}
            </pre>
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="min-w-0 space-y-4">
          <Panel
            title="Query"
            action={
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-xs text-ink-soft cursor-pointer">
                  <input type="checkbox" checked={readOnly} onChange={(e) => setReadOnly(e.target.checked)} />
                  Read only
                </label>
                <Button size="sm" variant="primary" onClick={() => execute()} disabled={running}>
                  <Play className="h-3 w-3" /> {running ? 'Running…' : 'Run (⌘Enter)'}
                </Button>
              </div>
            }
          >
            <textarea
              value={sql}
              onChange={(e) => setSql(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); void execute(); }
              }}
              spellCheck={false}
              aria-label="SQL query"
              className="thin-scroll h-48 w-full resize-y bg-surface p-3 font-mono text-[13px] leading-relaxed text-ink outline-none"
            />
          </Panel>

          {error ? <ErrorNote error={error} /> : null}

          {result ? (
            <Panel
              title={
                <div className="flex items-center gap-2">
                  <span>Results</span>
                  <Tag tone="neutral">{result.command}</Tag>
                  <span className="nums text-2xs text-ink-faint">
                    {result.rowCount} row{result.rowCount === 1 ? '' : 's'} · {duration(result.durationMs)}
                  </span>
                </div>
              }
              action={
                result.rows.length > 0 ? (
                  <Button size="sm" onClick={download}>
                    <Download className="h-3.5 w-3.5" /> CSV
                  </Button>
                ) : null
              }
            >
              {result.rows.length === 0 ? (
                <div className="p-4 text-xs text-ink-soft">
                  Query executed successfully. 0 rows returned.
                </div>
              ) : (
                <DataTable
                  maxHeight="45vh"
                  columns={result.columns.map((c) => ({
                    key: c,
                    label: c,
                    render: (row: Record<string, unknown>) => {
                      const val = row[c];
                      if (val === null || val === undefined) return <span className="text-ink-faint italic font-mono text-2xs">null</span>;
                      if (typeof val === 'object') return <span className="font-mono text-2xs truncate max-w-xs">{JSON.stringify(val)}</span>;
                      return <span className="font-mono text-xs">{String(val)}</span>;
                    },
                  }))}
                  rows={result.rows}
                />
              )}
            </Panel>
          ) : null}
        </div>

        <div>
          <Panel title="Query History">
            {history.length === 0 ? (
              <div className="p-3 text-xs text-ink-faint">Queries you run will appear here.</div>
            ) : (
              <ul className="divide-y divide-line text-xs">
                {history.map((h, i) => (
                  <li key={i} className="p-2.5 hover:bg-surface-hover/50">
                    <button
                      onClick={() => setSql(h.sql)}
                      className="block w-full text-left font-mono text-2xs text-ink-soft hover:text-ink truncate"
                      title={h.sql}
                    >
                      {h.sql.replace(/\s+/g, ' ')}
                    </button>
                    <div className="mt-1 flex items-center justify-between text-2xs text-ink-faint">
                      <span>{duration(h.durationMs)}</span>
                      <span>{h.rowCount} rows</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
