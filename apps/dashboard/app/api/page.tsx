'use client';

import { useState } from 'react';
import { Copy, KeyRound, Play, RotateCw, Trash2 } from 'lucide-react';
import { api, useApi, RequestFailed, type ApiError } from '@/lib/api';
import { duration, relative, timestamp } from '@/lib/format';
import { PageHeader } from '@/components/shell';
import { DataTable } from '@/components/data-table';
import { Button, Empty, ErrorNote, Field, Input, Panel, Spinner, Tag } from '@/components/primitives';

interface KeyRecord {
  id: string; label: string; role: 'public' | 'secret';
  key_masked: string; created_at: string; last_used_at: string | null; revoked_at: string | null;
}

interface ExplorerResult {
  status: number;
  durationMs: number;
  headers: Record<string, string>;
  body: string;
}

function Explorer() {
  const [method, setMethod] = useState('GET');
  const [path, setPath] = useState('/api/v1/meta/overview');
  const [body, setBody] = useState('');
  const [result, setResult] = useState<ExplorerResult | null>(null);
  const [running, setRunning] = useState(false);

  const send = async () => {
    setRunning(true);
    const started = performance.now();
    try {
      const res = await fetch(`/bf${path.startsWith('/') ? path : `/${path}`}`, {
        method,
        headers: { 'content-type': 'application/json' },
        ...(method === 'GET' || method === 'DELETE' || !body.trim() ? {} : { body }),
      });
      const text = await res.text();
      let pretty = text;
      try { pretty = JSON.stringify(JSON.parse(text), null, 2); } catch { /* not JSON */ }

      setResult({
        status: res.status,
        durationMs: performance.now() - started,
        headers: Object.fromEntries(res.headers.entries()),
        body: pretty,
      });
    } finally {
      setRunning(false);
    }
  };

  const tone = !result ? 'neutral' : result.status < 300 ? 'positive' : result.status < 500 ? 'accent' : 'critical';

  return (
    <Panel
      title="API explorer"
      action={
        <Button size="sm" variant="primary" onClick={send} disabled={running}>
          <Play className="h-3 w-3" /> {running ? 'Sending…' : 'Send'}
        </Button>
      }
    >
      <div className="space-y-3 p-3">
        <div className="flex gap-2">
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="h-8 shrink-0 rounded border border-line bg-surface px-2 font-mono text-xs"
            aria-label="HTTP method"
          >
            {['GET', 'POST', 'PATCH', 'PUT', 'DELETE'].map((m) => <option key={m}>{m}</option>)}
          </select>
          <Input
            value={path}
            onChange={(e) => setPath(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void send(); }}
            className="font-mono text-xs"
            aria-label="Request path"
            placeholder="/api/v1/products?limit=10"
          />
        </div>

        {method !== 'GET' && method !== 'DELETE' ? (
          <Field label="Request body" hint="JSON. Sent as-is.">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              spellCheck={false}
              className="thin-scroll h-28 w-full resize-y rounded border border-line bg-surface p-2 font-mono text-xs text-ink"
              placeholder='{ "name": "Standing desk" }'
            />
          </Field>
        ) : null}

        <p className="text-2xs text-ink-faint">
          Requests go through the dashboard proxy, which attaches the project secret key. The key is never
          sent to your browser.
        </p>

        {result ? (
          <div className="rounded border border-line">
            <div className="flex items-center gap-3 border-b border-line bg-sunken px-3 py-1.5">
              <Tag tone={tone}>{result.status}</Tag>
              <span className="nums text-2xs text-ink-faint">{duration(result.durationMs)}</span>
              <span className="nums ml-auto text-2xs text-ink-faint">
                {result.headers['content-length'] ?? result.body.length} bytes
              </span>
              <button
                onClick={() => void navigator.clipboard.writeText(result.body)}
                className="text-ink-faint hover:text-accent"
                aria-label="Copy response body"
              >
                <Copy className="h-3 w-3" />
              </button>
            </div>
            <pre className="thin-scroll max-h-72 overflow-auto p-3 font-mono text-xs leading-relaxed text-ink">
              {result.body || '(empty response)'}
            </pre>
          </div>
        ) : null}
      </div>
    </Panel>
  );
}

function Keys() {
  const { data, error, loading, reload } = useApi<{ data: KeyRecord[] }>('/api/v1/keys');
  const [label, setLabel] = useState('');
  const [role, setRole] = useState<'public' | 'secret'>('public');
  const [issued, setIssued] = useState<{ key: string; role: string } | null>(null);
  const [formError, setFormError] = useState<ApiError | null>(null);

  const create = async () => {
    setFormError(null);
    try {
      const res = await api<{ key: string; role: string }>('/api/v1/keys', {
        method: 'POST',
        body: JSON.stringify({ label: label || undefined, role }),
      });
      setIssued(res);
      setLabel('');
      reload();
    } catch (e) {
      setFormError(e instanceof RequestFailed ? e.apiError : { code: 'UNKNOWN_ERROR', message: String(e) });
    }
  };

  const act = async (id: string, action: 'revoke' | 'rotate') => {
    if (action === 'revoke' && !window.confirm('Revoke this key? Clients using it stop working immediately.')) return;
    try {
      const res = await api<{ key?: string; role?: string }>(`/api/v1/keys/${id}/${action}`, { method: 'POST' });
      if (res.key) setIssued({ key: res.key, role: res.role ?? '' });
      reload();
    } catch (e) {
      setFormError(e instanceof RequestFailed ? e.apiError : { code: 'UNKNOWN_ERROR', message: String(e) });
    }
  };

  const keys = data?.data ?? [];

  return (
    <div className="space-y-4">
      <Panel title="API keys">
        {error ? (
          <div className="p-3"><ErrorNote error={error} onRetry={reload} /></div>
        ) : loading ? (
          <Spinner />
        ) : keys.length === 0 ? (
          <Empty title="No keys yet." />
        ) : (
          <DataTable
            maxHeight="40vh"
            columns={[
              { key: 'label', label: 'Label' },
              { key: 'role', label: 'Role', render: (r) => <Tag tone={r.role === 'secret' ? 'critical' : 'accent'}>{String(r.role)}</Tag> },
              { key: 'key_masked', label: 'Key' },
              { key: 'last_used_at', label: 'Last used', render: (r) => <span className="text-xs text-ink-soft">{r.last_used_at ? relative(String(r.last_used_at)) : 'never'}</span> },
              { key: 'created_at', label: 'Created', render: (r) => <span className="nums text-xs text-ink-soft">{timestamp(String(r.created_at))}</span> },
              {
                key: 'actions',
                label: '',
                align: 'right',
                render: (r) =>
                  r.revoked_at ? (
                    <Tag>revoked</Tag>
                  ) : (
                    <span className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => act(String(r.id), 'rotate')} aria-label="Rotate key">
                        <RotateCw className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => act(String(r.id), 'revoke')} aria-label="Revoke key">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </span>
                  ),
              },
            ]}
            rows={keys as unknown as Record<string, unknown>[]}
          />
        )}
      </Panel>

      {issued ? (
        <div className="rounded border border-accent/40 bg-accent-soft p-3">
          <p className="text-[13px] font-medium text-ink">Save this key now — it is not shown again.</p>
          <code className="mt-2 block break-all rounded border border-line bg-surface p-2 font-mono text-xs text-ink">
            {issued.key}
          </code>
          <div className="mt-2 flex gap-2">
            <Button size="sm" onClick={() => void navigator.clipboard.writeText(issued.key)}>
              <Copy className="h-3 w-3" /> Copy
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setIssued(null)}>Done</Button>
          </div>
        </div>
      ) : null}

      <Panel title="Create a key">
        <div className="space-y-3 p-3">
          <Field label="Label"><Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="web client" /></Field>
          <Field
            label="Role"
            hint={role === 'public' ? 'Safe for browsers. Reads and writes table data.' : 'Server only. Also allows schema changes, raw SQL and key management.'}
          >
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'public' | 'secret')}
              className="h-8 w-full rounded border border-line bg-surface px-2 text-[13px]"
            >
              <option value="public">public</option>
              <option value="secret">secret</option>
            </select>
          </Field>
          {formError ? <ErrorNote error={formError} /> : null}
          <Button variant="primary" onClick={create}><KeyRound className="h-3.5 w-3.5" /> Create key</Button>
        </div>
      </Panel>
    </div>
  );
}

export default function ApiPage() {
  return (
    <>
      <PageHeader
        title="API"
        description="Test endpoints and manage the keys that reach them."
        action={
          <a href="/bf/api/v1/openapi.json" target="_blank" rel="noreferrer">
            <Button size="sm">OpenAPI spec</Button>
          </a>
        }
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Explorer />
        <Keys />
      </div>
    </>
  );
}
