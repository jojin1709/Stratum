'use client';

import { useEffect, useRef, useState } from 'react';
import { Plus, Radio, Trash2 } from 'lucide-react';
import { api, useApi, RequestFailed, type ApiError } from '@/lib/api';
import { PageHeader } from '@/components/shell';
import { DataTable } from '@/components/data-table';
import { Button, Empty, ErrorNote, Input, Panel, Spinner, StatusDot, Tag } from '@/components/primitives';

interface Status {
  enabled: boolean;
  endpoint: string;
  connections: number;
  channels: { name: string; subscribers: number }[];
  tables: { schema: string; table: string }[];
}

interface TableInfo { schema: string; name: string }

/**
 * Change events are captured by a Postgres trigger and delivered over WebSocket.
 * This page enables that capture per table and shows what is currently connected.
 */
export default function RealtimePage() {
  const status = useApi<Status>('/realtime/v1/status');
  const schema = useApi<{ tables: TableInfo[] }>('/api/v1/meta/tables');
  const [table, setTable] = useState('');
  const [error, setError] = useState<ApiError | null>(null);
  const [events, setEvents] = useState<{ at: string; text: string }[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Connection counts change without any user action, so this view polls slowly.
  // Polling rather than a second socket keeps the count honest without inflating it.
  useEffect(() => {
    timer.current = setInterval(() => status.reload(), 10_000);
    return () => { if (timer.current) clearInterval(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const enable = async () => {
    setError(null);
    try {
      const res = await api<{ channel: string }>('/realtime/v1/tables', {
        method: 'POST',
        body: JSON.stringify({ table }),
      });
      setEvents((e) => [{ at: new Date().toISOString(), text: `Enabled ${res.channel}` }, ...e].slice(0, 20));
      setTable('');
      status.reload();
    } catch (e) {
      setError(e instanceof RequestFailed ? e.apiError : { code: 'UNKNOWN_ERROR', message: String(e) });
    }
  };

  const disable = async (s: string, t: string) => {
    try {
      await api(`/realtime/v1/tables/${s}/${t}`, { method: 'DELETE' });
      status.reload();
    } catch (e) {
      setError(e instanceof RequestFailed ? e.apiError : { code: 'UNKNOWN_ERROR', message: String(e) });
    }
  };

  const enabled = new Set((status.data?.tables ?? []).map((t) => `${t.schema}.${t.table}`));
  const candidates = (schema.data?.tables ?? []).filter((t) => !enabled.has(`${t.schema}.${t.name}`));

  return (
    <>
      <PageHeader
        title="Realtime"
        description="Subscribe to row changes and broadcast between clients over WebSocket."
        action={
          status.data ? (
            <span className="flex items-center gap-1.5 text-xs text-ink-soft">
              <StatusDot tone={status.data.enabled ? 'positive' : 'idle'} />
              {status.data.enabled ? 'enabled' : 'disabled'}
            </span>
          ) : null
        }
      />

      {error ? <div className="mb-4"><ErrorNote error={error} /></div> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <Panel title="Table change feeds">
            {status.loading ? (
              <Spinner />
            ) : status.error ? (
              <div className="p-3"><ErrorNote error={status.error} onRetry={status.reload} /></div>
            ) : (status.data?.tables.length ?? 0) === 0 ? (
              <Empty title="No table is publishing changes yet. Enable one below to start receiving INSERT, UPDATE and DELETE events." />
            ) : (
              <ul className="divide-y divide-line">
                {status.data?.tables.map((t) => (
                  <li key={`${t.schema}.${t.table}`} className="flex items-center gap-2 px-3 py-2">
                    <Radio className="h-3.5 w-3.5 text-positive" aria-hidden />
                    <code className="flex-1 truncate font-mono text-xs">table:{t.schema}.{t.table}</code>
                    <Button size="sm" variant="ghost" onClick={() => disable(t.schema, t.table)} aria-label={`Disable ${t.table}`}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Enable a table">
            <div className="space-y-2 p-3">
              <div className="flex gap-2">
                <select
                  value={table}
                  onChange={(e) => setTable(e.target.value)}
                  className="h-8 w-full rounded border border-line bg-surface px-2 text-[13px]"
                  aria-label="Table to enable"
                >
                  <option value="">Choose a table…</option>
                  {candidates.map((t) => (
                    <option key={`${t.schema}.${t.name}`} value={t.name}>{t.schema}.{t.name}</option>
                  ))}
                </select>
                <Button variant="primary" onClick={enable} disabled={!table}>
                  <Plus className="h-3.5 w-3.5" /> Enable
                </Button>
              </div>
              <p className="text-2xs text-ink-faint">
                Adds a row-level trigger that publishes changes. Payloads larger than the Postgres
                notification limit arrive without the row body rather than being dropped.
              </p>
            </div>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel
            title="Connections"
            action={<span className="nums text-2xs text-ink-faint">{status.data?.connections ?? 0} open</span>}
          >
            <DataTable
              maxHeight="30vh"
              columns={[
                { key: 'name', label: 'Channel' },
                { key: 'subscribers', label: 'Subscribers', align: 'right' },
              ]}
              rows={(status.data?.channels ?? []) as unknown as Record<string, unknown>[]}
              emptyLabel="No client is subscribed right now."
            />
          </Panel>

          <Panel title="Connect from the SDK">
            <pre className="thin-scroll overflow-auto p-3 font-mono text-xs leading-relaxed text-ink-soft">{`import { createClient } from "@stratum/client";

const stratum = createClient({
  url: "http://localhost:8788",
  key: "strat_public_…"
});

stratum
  .channel("products")
  .on("INSERT", event => console.log(event.record))
  .subscribe();`}</pre>
            <div className="border-t border-line px-3 py-2">
              <Tag>{status.data?.endpoint ?? '/realtime/v1'}</Tag>
            </div>
          </Panel>

          {events.length > 0 ? (
            <Panel title="Recent activity">
              <ul className="divide-y divide-line">
                {events.map((e, i) => (
                  <li key={i} className="px-3 py-1.5 text-xs text-ink-soft">
                    <span className="nums mr-2 text-ink-faint">{e.at.slice(11, 19)}</span>
                    {e.text}
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}
        </div>
      </div>
    </>
  );
}
