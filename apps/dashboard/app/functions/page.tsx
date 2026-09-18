'use client';

import { useState } from 'react';
import { AlertTriangle, Play } from 'lucide-react';
import { api, useApi, RequestFailed, type ApiError } from '@/lib/api';
import { duration, relative } from '@/lib/format';
import { PageHeader } from '@/components/shell';
import { DataTable } from '@/components/data-table';
import { Button, Empty, ErrorNote, Panel, Spinner, Tag } from '@/components/primitives';

interface CompatIssue { api: string; line: number; message: string }
interface FunctionRecord {
  name: string; entrypoint: string; workerCompatible: boolean;
  compatIssues: CompatIssue[]; target: string; deployedAt: string | null; invocations: number;
}
interface LogRow { at: string; level: string; message: string; duration_ms: number | null }

export default function FunctionsPage() {
  const functions = useApi<{ dir: string; data: FunctionRecord[] }>('/functions/v1');
  const [selected, setSelected] = useState<string | null>(null);
  const [output, setOutput] = useState<{ status: number; body: string } | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  const logs = useApi<{ data: LogRow[] }>(selected ? `/functions/v1/${selected}/logs?limit=50` : null);

  const invoke = async (name: string) => {
    setError(null);
    setSelected(name);
    try {
      const res = await fetch(`/bf/functions/v1/${name}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
      const text = await res.text();
      let pretty = text;
      try { pretty = JSON.stringify(JSON.parse(text), null, 2); } catch { /* not JSON */ }
      setOutput({ status: res.status, body: pretty });
      logs.reload();
      functions.reload();
    } catch (e) {
      setError(e instanceof RequestFailed ? e.apiError : { code: 'UNKNOWN_ERROR', message: String(e) });
    }
  };

  const list = functions.data?.data ?? [];

  return (
    <>
      <PageHeader
        title="Functions"
        description="Server functions discovered on disk, invoked through the API."
        action={functions.data ? <Tag>{functions.data.dir}</Tag> : null}
      />

      {error ? <div className="mb-4"><ErrorNote error={error} /></div> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={`Functions (${list.length})`}>
          {functions.loading ? (
            <Spinner />
          ) : functions.error ? (
            <div className="p-3"><ErrorNote error={functions.error} onRetry={functions.reload} /></div>
          ) : list.length === 0 ? (
            <Empty title="No functions yet. Create one with: stratum functions new hello" />
          ) : (
            <ul className="divide-y divide-line">
              {list.map((f) => (
                <li key={f.name} className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <code className="flex-1 truncate font-mono text-xs text-ink">{f.name}</code>
                    <span className="nums text-2xs text-ink-faint">{f.invocations} call{f.invocations === 1 ? '' : 's'}</span>
                    <Button size="sm" onClick={() => invoke(f.name)}><Play className="h-3 w-3" /> Run</Button>
                  </div>
                  <p className="mt-1 font-mono text-2xs text-ink-faint">POST /functions/v1/{f.name}</p>

                  {f.workerCompatible ? (
                    <p className="mt-1 text-2xs text-positive">Runs on Cloudflare Workers.</p>
                  ) : (
                    <details className="mt-1.5 rounded border border-caution/30 bg-caution/5 px-2 py-1.5">
                      <summary className="flex cursor-pointer items-center gap-1.5 text-2xs text-caution">
                        <AlertTriangle className="h-3 w-3" aria-hidden />
                        Uses {f.compatIssues.length} API that Workers do not provide
                      </summary>
                      <ul className="mt-1.5 space-y-0.5">
                        {f.compatIssues.map((issue, i) => (
                          <li key={i} className="font-mono text-2xs text-ink-soft">line {issue.line}: {issue.message}</li>
                        ))}
                      </ul>
                      <p className="mt-1.5 text-2xs text-ink-faint">
                        It still runs locally and when self-hosted. Deploying it to Workers is blocked rather than left to fail at runtime.
                      </p>
                    </details>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <div className="space-y-4">
          {output ? (
            <Panel
              title="Response"
              action={<Tag tone={output.status < 400 ? 'positive' : 'critical'}>{output.status}</Tag>}
            >
              <pre className="thin-scroll max-h-56 overflow-auto p-3 font-mono text-xs leading-relaxed text-ink">
                {output.body || '(empty response)'}
              </pre>
            </Panel>
          ) : null}

          <Panel title={selected ? `${selected} · logs` : 'Logs'}>
            {!selected ? (
              <Empty title="Run a function to see what it logged." />
            ) : logs.loading ? (
              <Spinner />
            ) : (
              <DataTable
                maxHeight="40vh"
                columns={[
                  { key: 'at', label: 'When', render: (r) => <span className="nums text-xs text-ink-faint">{relative(String(r.at))}</span> },
                  { key: 'level', label: 'Level', render: (r) => <Tag tone={r.level === 'error' ? 'critical' : 'neutral'}>{String(r.level)}</Tag> },
                  { key: 'message', label: 'Message' },
                  { key: 'duration_ms', label: 'Took', align: 'right', render: (r) => <span className="nums text-xs">{duration(r.duration_ms as number)}</span> },
                ]}
                rows={(logs.data?.data ?? []) as unknown as Record<string, unknown>[]}
                emptyLabel="Nothing logged yet."
              />
            )}
          </Panel>

          <Panel title="Deploy to Cloudflare">
            <pre className="p-3 font-mono text-xs leading-relaxed text-ink-soft">{`stratum functions deploy hello
cd .stratum/workers/hello
npx wrangler deploy`}</pre>
            <p className="border-t border-line px-3 py-2 text-2xs text-ink-faint">
              Stratum bundles the function and writes a wrangler config. Deployment uses your own
              Cloudflare credentials — the platform never holds them.
            </p>
          </Panel>
        </div>
      </div>
    </>
  );
}
