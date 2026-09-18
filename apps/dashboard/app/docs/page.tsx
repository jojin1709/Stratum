'use client';

import { useState } from 'react';
import { BookOpen, Copy, Check, ExternalLink, Play, Lock, Sparkles, Send, Database, Layers } from 'lucide-react';
import { useApi } from '@/lib/api';
import { PageHeader } from '@/components/shell';
import { Button, Empty, Field, Input, Panel, StatusDot, Tag } from '@/components/primitives';

interface TableMeta {
  name: string;
  schema: string;
  columns: { name: string; dataType: string; nullable: boolean; isPrimaryKey: boolean }[];
}

export default function DocsPage() {
  const schema = useApi<{ tables: TableMeta[] }>('/api/v1/meta/tables');
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<'GET' | 'POST' | 'PATCH' | 'DELETE'>('GET');
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [testResult, setTestResult] = useState<{ status: number; durationMs: number; body: string } | null>(null);
  const [testing, setTesting] = useState(false);

  const tables = schema.data?.tables ?? [];
  const activeTable = tables.find((t) => t.name === selectedTable) ?? tables[0] ?? null;

  const endpointUrl = activeTable ? `/api/v1/${activeTable.name}` : '/api/v1/users';

  const handleTest = async () => {
    if (!activeTable) return;
    setTesting(true);
    setTestResult(null);
    const start = performance.now();

    try {
      const res = await fetch(`/bf${endpointUrl}?limit=5`, {
        method: selectedMethod,
        headers: { 'Content-Type': 'application/json' },
      });
      const text = await res.text();
      let pretty = text;
      try { pretty = JSON.stringify(JSON.parse(text), null, 2); } catch { /* not JSON */ }

      setTestResult({
        status: res.status,
        durationMs: Math.round(performance.now() - start),
        body: pretty,
      });
    } catch (e: unknown) {
      setTestResult({
        status: 500,
        durationMs: Math.round(performance.now() - start),
        body: JSON.stringify({ error: String(e) }, null, 2),
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <>
      <PageHeader
        title="API Documentation"
        description="Interactive OpenAPI 3.1 specification for all introspected PostgreSQL REST endpoints."
        action={
          <div className="flex items-center gap-2">
            <a
              href="/bf/api/v1/openapi.json"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink hover:bg-sunken transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" /> OpenAPI JSON
            </a>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        {/* Table Endpoints Sidebar */}
        <div className="space-y-4">
          <Panel title="Database Resources">
            <ul className="divide-y divide-line max-h-[70vh] overflow-y-auto">
              {tables.map((t) => (
                <li key={t.name}>
                  <button
                    onClick={() => { setSelectedTable(t.name); setTestResult(null); }}
                    className={`flex w-full items-center justify-between p-3 text-left transition-colors ${
                      (activeTable?.name === t.name)
                        ? 'bg-blue-500/10 font-bold text-blue-600 dark:text-blue-400'
                        : 'text-ink-soft hover:bg-sunken hover:text-ink'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Database className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                      <span className="font-mono text-xs truncate">/{t.name}</span>
                    </div>
                    <Tag tone="neutral">{t.columns.length} cols</Tag>
                  </button>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        {/* Documentation Content */}
        <div className="space-y-6 min-w-0">
          {activeTable ? (
            <>
              {/* Endpoint Header */}
              <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-blue-600 px-2.5 py-1 font-mono text-xs font-bold text-white uppercase">
                      {selectedMethod}
                    </span>
                    <code className="font-mono text-sm font-bold text-ink">
                      https://stratum-api.jojin1709.workers.dev{endpointUrl}
                    </code>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="primary" onClick={handleTest} disabled={testing}>
                      <Send className="h-3 w-3" /> {testing ? 'Sending…' : 'Try it live'}
                    </Button>
                  </div>
                </div>

                {/* HTTP Methods Tabs */}
                <div className="flex items-center gap-1.5 pt-2 border-t border-line">
                  {(['GET', 'POST', 'PATCH', 'DELETE'] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => { setSelectedMethod(m); setTestResult(null); }}
                      className={`rounded-lg px-3 py-1 text-xs font-bold font-mono transition-colors ${
                        selectedMethod === m
                          ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30'
                          : 'text-ink-soft hover:text-ink border border-transparent'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Live Test Console */}
              {testResult && (
                <Panel title={`Live Response (${testResult.status})`}>
                  <div className="p-4 space-y-2">
                    <div className="flex items-center justify-between text-2xs font-mono">
                      <span className={`inline-flex items-center gap-1 font-semibold ${testResult.status < 300 ? 'text-positive' : 'text-critical'}`}>
                        <StatusDot tone={testResult.status < 300 ? 'positive' : 'critical'} /> HTTP {testResult.status} OK
                      </span>
                      <span className="text-ink-faint">{testResult.durationMs}ms</span>
                    </div>
                    <pre className="thin-scroll max-h-64 overflow-auto rounded-xl border border-line bg-sunken p-3 font-mono text-xs text-ink leading-relaxed">
                      {testResult.body}
                    </pre>
                  </div>
                </Panel>
              )}

              {/* Schema Fields Table */}
              <Panel title={`Schema Model: ${activeTable.name}`}>
                <div className="p-4">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-line text-2xs uppercase tracking-wider text-ink-faint">
                        <th className="pb-2 font-semibold">Field</th>
                        <th className="pb-2 font-semibold">Type</th>
                        <th className="pb-2 font-semibold">Requirement</th>
                        <th className="pb-2 font-semibold">Attributes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {activeTable.columns.map((c) => (
                        <tr key={c.name} className="py-2.5">
                          <td className="py-2 font-mono font-bold text-ink">{c.name}</td>
                          <td className="py-2 font-mono text-blue-600 dark:text-blue-400">{c.dataType}</td>
                          <td className="py-2 text-ink-soft">{c.nullable ? 'Optional' : 'Required'}</td>
                          <td className="py-2">
                            {c.isPrimaryKey && <Tag tone="accent">Primary Key</Tag>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>

              {/* Query Parameters */}
              <Panel title="Supported Query Filters">
                <div className="p-4 space-y-2 text-xs">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="rounded-xl border border-line bg-sunken p-3">
                      <code className="font-bold text-blue-600 dark:text-blue-400">?select=id,name,price</code>
                      <p className="mt-1 text-2xs text-ink-soft">Select specific columns only.</p>
                    </div>
                    <div className="rounded-xl border border-line bg-sunken p-3">
                      <code className="font-bold text-blue-600 dark:text-blue-400">?order=created_at.desc</code>
                      <p className="mt-1 text-2xs text-ink-soft">Sort records ascending or descending.</p>
                    </div>
                    <div className="rounded-xl border border-line bg-sunken p-3">
                      <code className="font-bold text-blue-600 dark:text-blue-400">?limit=25&offset=50</code>
                      <p className="mt-1 text-2xs text-ink-soft">Pagination parameters.</p>
                    </div>
                    <div className="rounded-xl border border-line bg-sunken p-3">
                      <code className="font-bold text-blue-600 dark:text-blue-400">?status=eq.active</code>
                      <p className="mt-1 text-2xs text-ink-soft">Column value filter matching.</p>
                    </div>
                  </div>
                </div>
              </Panel>
            </>
          ) : (
            <Panel><Empty title="No tables discovered in database schema." /></Panel>
          )}
        </div>
      </div>
    </>
  );
}
