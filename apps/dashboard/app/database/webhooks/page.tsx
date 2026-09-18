'use client';

import { useState } from 'react';
import { Bell, Check, Copy, Globe, Play, Plus, Radio, RefreshCw, Send, Shield, Trash2, Zap } from 'lucide-react';
import { PageHeader, SubNav } from '@/components/shell';
import { Button, Empty, Field, Input, Panel, StatusDot, Tag } from '@/components/primitives';

interface Webhook {
  id: string;
  name: string;
  url: string;
  events: ('INSERT' | 'UPDATE' | 'DELETE')[];
  table: string;
  enabled: boolean;
  secret: string;
  created_at: string;
  last_triggered_at: string | null;
  last_status: number | null;
}

const INITIAL_WEBHOOKS: Webhook[] = [
  {
    id: 'wh_auth_sync_01',
    name: 'Customer Sync Webhook',
    url: 'https://api.myapp.com/webhooks/stratum-users',
    events: ['INSERT', 'UPDATE'],
    table: 'users',
    enabled: true,
    secret: 'whsec_7x9Q8mN2vP4kL1wR6tY0',
    created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
    last_triggered_at: new Date(Date.now() - 1000 * 60 * 14).toISOString(),
    last_status: 200,
  },
  {
    id: 'wh_audit_log_02',
    name: 'Audit Log Dispatcher',
    url: 'https://logs.stratum.internal/ingest',
    events: ['INSERT', 'DELETE'],
    table: '*',
    enabled: true,
    secret: 'whsec_3bV8cK9xZ1pL0wM4nQ7r',
    created_at: new Date(Date.now() - 86400000 * 7).toISOString(),
    last_triggered_at: new Date(Date.now() - 1000 * 60 * 42).toISOString(),
    last_status: 200,
  },
];

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<Webhook[]>(INITIAL_WEBHOOKS);
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // New webhook form state
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [table, setTable] = useState('*');
  const [events, setEvents] = useState<('INSERT' | 'UPDATE' | 'DELETE')[]>(['INSERT', 'UPDATE']);
  const [secret, setSecret] = useState(() => 'whsec_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15));

  // Test dispatch state
  const [testTarget, setTestTarget] = useState<Webhook | null>(null);
  const [testResult, setTestResult] = useState<{ status: number; durationMs: number; payload: string } | null>(null);
  const [dispatching, setDispatching] = useState(false);

  const toggleEvent = (ev: 'INSERT' | 'UPDATE' | 'DELETE') => {
    setEvents((prev) => (prev.includes(ev) ? prev.filter((e) => e !== ev) : [...prev, ev]));
  };

  const createWebhook = () => {
    if (!name.trim() || !url.trim() || events.length === 0) return;
    const newWh: Webhook = {
      id: 'wh_' + Math.random().toString(36).substring(2, 10),
      name: name.trim(),
      url: url.trim(),
      table,
      events,
      enabled: true,
      secret,
      created_at: new Date().toISOString(),
      last_triggered_at: null,
      last_status: null,
    };
    setWebhooks([newWh, ...webhooks]);
    setCreating(false);
    setName('');
    setUrl('');
    setSecret('whsec_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15));
  };

  const deleteWebhook = (id: string) => {
    setWebhooks(webhooks.filter((w) => w.id !== id));
  };

  const toggleEnabled = (id: string) => {
    setWebhooks(webhooks.map((w) => (w.id === id ? { ...w, enabled: !w.enabled } : w)));
  };

  const copySecret = (sec: string, id: string) => {
    navigator.clipboard.writeText(sec);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const sendTestDispatch = async (wh: Webhook) => {
    setTestTarget(wh);
    setDispatching(true);
    setTestResult(null);

    const testPayload = {
      type: 'webhook.test',
      event: 'INSERT',
      schema: 'public',
      table: wh.table === '*' ? 'users' : wh.table,
      timestamp: new Date().toISOString(),
      record: {
        id: '9f8b4a20-80a2-4a1c-8e4d-90c746d0a312',
        email: 'developer@stratum.sh',
        status: 'active',
        created_at: new Date().toISOString(),
      },
      signature: 'sha256=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    };

    // Simulate edge delivery with realistic network latency
    await new Promise((r) => setTimeout(r, 600));

    setTestResult({
      status: 200,
      durationMs: 46,
      payload: JSON.stringify(testPayload, null, 2),
    });
    setDispatching(false);

    // Update webhook last triggered
    setWebhooks((prev) =>
      prev.map((w) => (w.id === wh.id ? { ...w, last_triggered_at: new Date().toISOString(), last_status: 200 } : w))
    );
  };

  return (
    <>
      <PageHeader
        title="Database"
        description="Configure outgoing event webhooks triggered on PostgreSQL INSERT, UPDATE, and DELETE operations."
        action={
          <Button size="sm" variant="primary" onClick={() => setCreating(true)}>
            <Plus className="h-3.5 w-3.5" /> Add Webhook
          </Button>
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
        <Panel title="Add Database Event Webhook" className="mb-6">
          <div className="space-y-4 p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Webhook Name" hint="Descriptive label for this integration">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Slack Notifications" autoFocus />
              </Field>
              <Field label="Target Table" hint="Table to monitor (* for all tables)">
                <Input value={table} onChange={(e) => setTable(e.target.value)} placeholder="*" />
              </Field>
            </div>

            <Field label="Endpoint URL" hint="Must be a valid HTTPS URL accepting POST requests">
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://api.example.com/webhooks/stratum" />
            </Field>

            <div>
              <p className="mb-2 text-xs font-medium text-ink-soft">Trigger Events</p>
              <div className="flex flex-wrap gap-2">
                {(['INSERT', 'UPDATE', 'DELETE'] as const).map((ev) => {
                  const active = events.includes(ev);
                  return (
                    <button
                      key={ev}
                      type="button"
                      onClick={() => toggleEvent(ev)}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all ${
                        active
                          ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400'
                          : 'border-line bg-surface text-ink-soft hover:border-line-hover'
                      }`}
                    >
                      <Zap className={`h-3.5 w-3.5 ${active ? 'text-blue-500' : 'text-ink-faint'}`} />
                      <span>{ev}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <Field label="HMAC Signing Secret" hint="Used in X-Stratum-Signature to verify authenticity">
              <div className="flex gap-2">
                <Input value={secret} readOnly className="font-mono text-xs bg-sunken" />
                <Button size="sm" onClick={() => copySecret(secret, 'new')}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </Field>

            <div className="flex gap-2 border-t border-line pt-3">
              <Button variant="primary" onClick={createWebhook} disabled={!name.trim() || !url.trim() || events.length === 0}>
                Create Webhook
              </Button>
              <Button onClick={() => setCreating(false)}>Cancel</Button>
            </div>
          </div>
        </Panel>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Panel title={`Configured Webhooks (${webhooks.length})`}>
            {webhooks.length === 0 ? (
              <Empty
                title="No webhooks configured. Create one to stream PostgreSQL events to external endpoints."
                action={<Button size="sm" variant="primary" onClick={() => setCreating(true)}>Add Webhook</Button>}
              />
            ) : (
              <ul className="divide-y divide-line">
                {webhooks.map((w) => (
                  <li key={w.id} className="p-4 transition-colors hover:bg-surface-hover/30">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <StatusDot tone={w.enabled ? 'positive' : 'idle'} />
                          <h4 className="font-semibold text-ink text-sm">{w.name}</h4>
                          <span className="font-mono text-2xs text-ink-faint">({w.id})</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs font-mono text-ink-soft">
                          <Globe className="h-3.5 w-3.5 text-blue-500" />
                          <span className="truncate max-w-md">{w.url}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => sendTestDispatch(w)}
                          disabled={dispatching && testTarget?.id === w.id}
                        >
                          <Send className="h-3 w-3" /> Test
                        </Button>
                        <Button
                          size="sm"
                          variant={w.enabled ? 'ghost' : 'primary'}
                          onClick={() => toggleEnabled(w.id)}
                        >
                          {w.enabled ? 'Pause' : 'Enable'}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => deleteWebhook(w.id)} aria-label="Delete webhook">
                          <Trash2 className="h-3.5 w-3.5 text-critical" />
                        </Button>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2 pt-2 border-t border-line/60 text-2xs text-ink-soft">
                      <span className="font-medium text-ink">Table:</span>
                      <Tag tone="neutral">{w.table}</Tag>
                      <span className="font-medium text-ink ml-2">Events:</span>
                      {w.events.map((ev) => (
                        <Tag key={ev} tone="accent">{ev}</Tag>
                      ))}
                      {w.last_status ? (
                        <span className="ml-auto inline-flex items-center gap-1 font-mono text-positive">
                          <Check className="h-3 w-3" /> Last 200 OK
                        </span>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div>
          <Panel title="Webhook Test Console">
            <div className="p-4 space-y-3">
              <p className="text-xs text-ink-soft leading-relaxed">
                Click <strong>Test</strong> on any webhook to simulate an immediate PostgreSQL row modification event delivered over Cloudflare Edge.
              </p>

              {dispatching ? (
                <div className="rounded-xl border border-line bg-sunken p-4 text-center text-xs text-ink-soft">
                  <RefreshCw className="h-4 w-4 animate-spin mx-auto mb-2 text-blue-500" />
                  Dispatching payload to target...
                </div>
              ) : testResult ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-positive">
                      <StatusDot tone="positive" /> HTTP {testResult.status} OK
                    </span>
                    <span className="font-mono text-2xs text-ink-faint">{testResult.durationMs}ms</span>
                  </div>
                  <pre className="thin-scroll max-h-64 overflow-auto rounded-xl border border-line bg-sunken p-3 font-mono text-[11px] leading-relaxed text-ink">
                    {testResult.payload}
                  </pre>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-line p-6 text-center text-xs text-ink-faint">
                  No active test dispatch. Click "Test" on any webhook above.
                </div>
              )}

              <div className="rounded-xl border border-line bg-blue-500/5 p-3 text-2xs text-ink-soft space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-blue-600 dark:text-blue-400">
                  <Shield className="h-3 w-3" /> Security Verification
                </div>
                <p>
                  Every payload includes an HMAC-SHA256 signature in the <code className="font-mono font-bold">X-Stratum-Signature</code> header generated using your webhook secret.
                </p>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
