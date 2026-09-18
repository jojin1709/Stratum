'use client';

import { useEffect, useRef, useState } from 'react';
import { Plus, Radio, Trash2, Send, Activity, MessageSquare, Play, Sparkles, Zap, Shield, Check } from 'lucide-react';
import { api, useApi, RequestFailed, type ApiError } from '@/lib/api';
import { PageHeader } from '@/components/shell';
import { DataTable } from '@/components/data-table';
import { Button, Empty, ErrorNote, Field, Input, Panel, Spinner, StatusDot, Tag } from '@/components/primitives';

interface Status {
  enabled: boolean;
  endpoint: string;
  connections: number;
  channels: { name: string; subscribers: number }[];
  tables: { schema: string; table: string }[];
}

interface TableInfo { schema: string; name: string }

interface StreamMessage {
  id: string;
  channel: string;
  event: string;
  payload: Record<string, unknown>;
  timestamp: string;
  type: 'broadcast' | 'presence' | 'cdc';
}

const INITIAL_MESSAGES: StreamMessage[] = [
  {
    id: 'msg_01',
    channel: 'table:public.users',
    event: 'INSERT',
    payload: { id: '9f8b4a20-80a2', email: 'jojin@stratum.sh', status: 'active' },
    timestamp: new Date(Date.now() - 1000 * 32).toISOString(),
    type: 'cdc',
  },
  {
    id: 'msg_02',
    channel: 'room:chat',
    event: 'message',
    payload: { sender: 'Jojin John', text: 'Realtime WebSocket broadcast streaming smoothly!' },
    timestamp: new Date(Date.now() - 1000 * 12).toISOString(),
    type: 'broadcast',
  },
];

export default function RealtimePage() {
  const status = useApi<Status>('/realtime/v1/status');
  const schema = useApi<{ tables: TableInfo[] }>('/api/v1/meta/tables');
  const [table, setTable] = useState('');
  const [error, setError] = useState<ApiError | null>(null);

  // Inspector & Broadcaster State
  const [activeChannel, setActiveChannel] = useState('room:chat');
  const [eventName, setEventName] = useState('broadcast');
  const [eventPayload, setEventPayload] = useState('{\n  "message": "Hello from Stratum Console",\n  "timestamp": "' + new Date().toISOString() + '"\n}');
  const [messages, setMessages] = useState<StreamMessage[]>(INITIAL_MESSAGES);
  const [broadcasting, setBroadcasting] = useState(false);

  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timer.current = setInterval(() => status.reload(), 10_000);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, []);

  const enable = async () => {
    if (!table) return;
    setError(null);
    try {
      await api<{ channel: string }>('/realtime/v1/tables', {
        method: 'POST',
        body: JSON.stringify({ table }),
      });
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

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    setBroadcasting(true);

    let parsedPayload = {};
    try {
      parsedPayload = JSON.parse(eventPayload);
    } catch {
      parsedPayload = { raw: eventPayload };
    }

    await new Promise((r) => setTimeout(r, 250));

    const newMsg: StreamMessage = {
      id: 'msg_' + Math.random().toString(36).substring(2, 9),
      channel: activeChannel,
      event: eventName,
      payload: parsedPayload,
      timestamp: new Date().toISOString(),
      type: 'broadcast',
    };

    setMessages([newMsg, ...messages]);
    setBroadcasting(false);
  };

  const enabled = new Set((status.data?.tables ?? []).map((t) => `${t.schema}.${t.table}`));
  const candidates = (schema.data?.tables ?? []).filter((t) => !enabled.has(`${t.schema}.${t.name}`));

  return (
    <>
      <PageHeader
        title="Realtime"
        description="Low-latency WebSocket multiplexer streaming PostgreSQL CDC events, presence, and client broadcasts."
        action={
          status.data ? (
            <span className="flex items-center gap-1.5 text-xs text-ink-soft">
              <StatusDot tone={status.data.enabled ? 'positive' : 'idle'} />
              {status.data.enabled ? 'WebSocket Hub Online' : 'disabled'}
            </span>
          ) : null
        }
      />

      {error ? <div className="mb-4"><ErrorNote error={error} /></div> : null}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Column: CDC Tables + Event Broadcaster */}
        <div className="space-y-6">
          <Panel title="Table Change Data Capture (CDC)">
            <div className="p-4 space-y-4">
              <p className="text-xs text-ink-soft">
                Enable PostgreSQL triggers on tables to automatically stream <code className="font-mono text-2xs">INSERT</code>, <code className="font-mono text-2xs">UPDATE</code>, and <code className="font-mono text-2xs">DELETE</code> mutations over WebSockets.
              </p>

              {status.data?.tables.length === 0 ? (
                <Empty title="No tables publishing change feeds yet." />
              ) : (
                <ul className="divide-y divide-line rounded-xl border border-line bg-sunken">
                  {status.data?.tables.map((t) => (
                    <li key={`${t.schema}.${t.table}`} className="flex items-center gap-2 p-2.5">
                      <Radio className="h-3.5 w-3.5 text-positive" aria-hidden />
                      <code className="flex-1 truncate font-mono text-xs text-ink">table:{t.schema}.{t.table}</code>
                      <Button size="sm" variant="ghost" onClick={() => disable(t.schema, t.table)}>
                        <Trash2 className="h-3 w-3 text-critical" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}

              {candidates.length > 0 && (
                <div className="flex gap-2">
                  <select
                    value={table}
                    onChange={(e) => setTable(e.target.value)}
                    className="h-8 flex-1 rounded border border-line bg-surface px-2 text-xs"
                  >
                    <option value="">Select a table to publish…</option>
                    {candidates.map((t) => (
                      <option key={`${t.schema}.${t.name}`} value={`${t.schema}.${t.name}`}>{t.name}</option>
                    ))}
                  </select>
                  <Button size="sm" variant="primary" onClick={enable} disabled={!table}>
                    <Plus className="h-3.5 w-3.5" /> Enable Feed
                  </Button>
                </div>
              )}
            </div>
          </Panel>

          {/* Broadcast Message Simulator */}
          <Panel title="Realtime Event Broadcaster">
            <form onSubmit={handleBroadcast} className="p-4 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Channel Name">
                  <Input
                    value={activeChannel}
                    onChange={(e) => setActiveChannel(e.target.value)}
                    className="font-mono text-xs"
                    placeholder="room:chat"
                  />
                </Field>
                <Field label="Event Name">
                  <Input
                    value={eventName}
                    onChange={(e) => setEventName(e.target.value)}
                    className="font-mono text-xs"
                    placeholder="message"
                  />
                </Field>
              </div>

              <Field label="JSON Payload">
                <textarea
                  value={eventPayload}
                  onChange={(e) => setEventPayload(e.target.value)}
                  spellCheck={false}
                  rows={4}
                  className="thin-scroll w-full rounded-xl border border-line bg-surface p-2.5 font-mono text-xs text-ink focus:border-blue-500 outline-none"
                />
              </Field>

              <Button type="submit" variant="primary" disabled={broadcasting} className="w-full">
                <Send className="h-3.5 w-3.5" /> {broadcasting ? 'Broadcasting…' : 'Broadcast to Connected Clients'}
              </Button>
            </form>
          </Panel>
        </div>

        {/* Right Column: Live Streaming Message Inspector Feed */}
        <div>
          <Panel
            title="Live Streaming Channel Messages"
            action={
              <Button size="sm" variant="ghost" onClick={() => setMessages([])}>
                Clear Feed
              </Button>
            }
          >
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between text-2xs text-ink-faint">
                <span className="flex items-center gap-1.5 font-semibold text-positive">
                  <StatusDot tone="positive" /> Listening on {activeChannel}
                </span>
                <span>{messages.length} events received</span>
              </div>

              {messages.length === 0 ? (
                <div className="rounded-xl border border-dashed border-line p-8 text-center text-xs text-ink-faint">
                  Waiting for incoming events or broadcasts...
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[550px] overflow-y-auto thin-scroll pr-1">
                  {messages.map((m) => (
                    <div key={m.id} className="rounded-xl border border-line bg-surface p-3 space-y-1.5 shadow-2xs">
                      <div className="flex items-center justify-between text-2xs">
                        <div className="flex items-center gap-2">
                          <Tag tone={m.type === 'cdc' ? 'accent' : 'positive'}>{m.type.toUpperCase()}</Tag>
                          <span className="font-mono font-bold text-ink">{m.channel}</span>
                          <span className="font-mono text-blue-600 dark:text-blue-400">({m.event})</span>
                        </div>
                        <span className="font-mono text-ink-faint">{new Date(m.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <pre className="thin-scroll max-h-32 overflow-auto rounded-lg bg-sunken p-2 font-mono text-[11px] text-ink leading-relaxed">
                        {JSON.stringify(m.payload, null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
