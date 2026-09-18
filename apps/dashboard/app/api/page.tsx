'use client';

import { useState } from 'react';
import { Copy, KeyRound, Play, RotateCw, Trash2, Code2, Check, Send, Sparkles, Database } from 'lucide-react';
import { api, useApi, RequestFailed, type ApiError } from '@/lib/api';
import { duration, relative, timestamp } from '@/lib/format';
import { PageHeader } from '@/components/shell';
import { DataTable } from '@/components/data-table';
import { Button, Empty, ErrorNote, Field, Input, Panel, Spinner, Tag, StatusDot } from '@/components/primitives';

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

interface Snapshot { tables: { schema: string; name: string; columns: { name: string }[] }[] }

function ApiPlayground() {
  const [method, setMethod] = useState('GET');
  const [path, setPath] = useState('/api/v1/meta/overview');
  const [body, setBody] = useState('');
  const [result, setResult] = useState<ExplorerResult | null>(null);
  const [running, setRunning] = useState(false);
  const [activeTab, setActiveTab] = useState<'response' | 'typescript' | 'python' | 'curl' | 'go'>('response');
  const [copied, setCopied] = useState(false);

  const tablesMeta = useApi<Snapshot>('/api/v1/meta/tables');
  const tableList = tablesMeta.data?.tables ?? [];

  const send = async () => {
    setRunning(true);
    const started = performance.now();
    try {
      const cleanPath = path.startsWith('/') ? path : `/${path}`;
      const res = await fetch(`/bf${cleanPath}`, {
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
      setActiveTab('response');
    } catch (e: unknown) {
      setResult({
        status: 500,
        durationMs: performance.now() - started,
        headers: {},
        body: JSON.stringify({ error: String(e) }, null, 2),
      });
    } finally {
      setRunning(false);
    }
  };

  const copyCode = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const tsCode = `// TypeScript / Node.js
import { createClient } from '@stratum/client';

const stratum = createClient('https://stratum-api.jojin1709.workers.dev', {
  apiKey: process.env.STRATUM_API_KEY
});

async function main() {
  const response = await fetch('https://stratum-api.jojin1709.workers.dev${path}', {
    method: '${method}',
    headers: {
      'Authorization': 'Bearer ' + process.env.STRATUM_API_KEY,
      'Content-Type': 'application/json'
    }${method !== 'GET' && body.trim() ? `,\n    body: JSON.stringify(${body.trim()})` : ''}
  });

  const data = await response.json();
  console.log('Stratum Data:', data);
}

main();`;

  const pyCode = `# Python (httpx)
import httpx
import os

url = "https://stratum-api.jojin1709.workers.dev${path}"
headers = {
    "Authorization": f"Bearer {os.environ.get('STRATUM_API_KEY')}",
    "Content-Type": "application/json"
}
${method !== 'GET' && body.trim() ? `payload = ${body.trim()}\n` : ''}
with httpx.Client() as client:
    response = client.request(
        method="${method}",
        url=url,
        headers=headers${method !== 'GET' && body.trim() ? ',\n        json=payload' : ''}
    )
    print("Status:", response.status_code)
    print("Data:", response.json())`;

  const curlCode = `# cURL CLI
curl -X ${method} "https://stratum-api.jojin1709.workers.dev${path}" \\
  -H "Authorization: Bearer $STRATUM_API_KEY" \\
  -H "Content-Type: application/json"${method !== 'GET' && body.trim() ? ` \\\n  -d '${body.trim()}'` : ''}`;

  const goCode = `// Go (net/http)
package main

import (
	"fmt"
	"io"
	"net/http"
	"os"${method !== 'GET' && body.trim() ? '\n\t"strings"' : ''}
)

func main() {
	url := "https://stratum-api.jojin1709.workers.dev${path}"
	req, err := http.NewRequest("${method}", url, ${method !== 'GET' && body.trim() ? `strings.NewReader(\`${body.trim()}\`)` : 'nil'})
	if err != nil {
		panic(err)
	}

	req.Header.Set("Authorization", "Bearer "+os.Getenv("STRATUM_API_KEY"))
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		panic(err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	fmt.Println("Status:", resp.Status)
	fmt.Println("Response:", string(body))
}`;

  return (
    <div className="space-y-4">
      <Panel
        title="Interactive REST API Playground & Code Generator"
        action={
          <Button size="sm" variant="primary" onClick={send} disabled={running}>
            <Send className="h-3 w-3" /> {running ? 'Dispatching…' : 'Send Request'}
          </Button>
        }
      >
        <div className="space-y-4 p-4">
          {/* Quick Table Endpoints */}
          {tableList.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pb-2 border-b border-line">
              <span className="text-2xs font-medium text-ink-faint mr-1 flex items-center gap-1">
                <Database className="h-3 w-3" /> Table Endpoints:
              </span>
              {tableList.map((t) => (
                <button
                  key={t.name}
                  onClick={() => {
                    setPath(`/api/v1/${t.name}?limit=10`);
                    setMethod('GET');
                  }}
                  className="rounded-md border border-line bg-surface px-2 py-0.5 text-2xs font-mono text-ink-soft hover:border-blue-500 hover:text-ink transition-colors"
                >
                  /api/v1/{t.name}
                </button>
              ))}
            </div>
          )}

          {/* Request Bar */}
          <div className="flex gap-2">
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="h-9 shrink-0 rounded-xl border border-line bg-surface px-3 font-mono text-xs font-bold text-ink"
              aria-label="HTTP method"
            >
              {['GET', 'POST', 'PATCH', 'PUT', 'DELETE'].map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
            <Input
              value={path}
              onChange={(e) => setPath(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void send(); }}
              className="h-9 font-mono text-xs"
              placeholder="/api/v1/users?limit=10"
            />
          </div>

          {method !== 'GET' && method !== 'DELETE' && (
            <Field label="JSON Request Body">
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                spellCheck={false}
                className="thin-scroll h-28 w-full resize-y rounded-xl border border-line bg-surface p-3 font-mono text-xs text-ink focus:border-blue-500 outline-none"
                placeholder='{ "name": "Sample Record", "active": true }'
              />
            </Field>
          )}

          {/* Tabs for Live Response & Multi-Language SDK Snippets */}
          <div className="border-t border-line pt-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1 rounded-lg border border-line bg-surface p-1">
                <button
                  onClick={() => setActiveTab('response')}
                  className={`px-2.5 py-1 text-2xs font-semibold rounded-md transition-colors ${
                    activeTab === 'response' ? 'bg-blue-600 text-white' : 'text-ink-soft hover:text-ink'
                  }`}
                >
                  Live Response {result ? `(${result.status})` : ''}
                </button>
                <button
                  onClick={() => setActiveTab('typescript')}
                  className={`px-2.5 py-1 text-2xs font-semibold rounded-md transition-colors ${
                    activeTab === 'typescript' ? 'bg-blue-600 text-white' : 'text-ink-soft hover:text-ink'
                  }`}
                >
                  TypeScript
                </button>
                <button
                  onClick={() => setActiveTab('python')}
                  className={`px-2.5 py-1 text-2xs font-semibold rounded-md transition-colors ${
                    activeTab === 'python' ? 'bg-blue-600 text-white' : 'text-ink-soft hover:text-ink'
                  }`}
                >
                  Python
                </button>
                <button
                  onClick={() => setActiveTab('curl')}
                  className={`px-2.5 py-1 text-2xs font-semibold rounded-md transition-colors ${
                    activeTab === 'curl' ? 'bg-blue-600 text-white' : 'text-ink-soft hover:text-ink'
                  }`}
                >
                  cURL
                </button>
                <button
                  onClick={() => setActiveTab('go')}
                  className={`px-2.5 py-1 text-2xs font-semibold rounded-md transition-colors ${
                    activeTab === 'go' ? 'bg-blue-600 text-white' : 'text-ink-soft hover:text-ink'
                  }`}
                >
                  Go
                </button>
              </div>

              {activeTab !== 'response' && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    const code =
                      activeTab === 'typescript' ? tsCode :
                      activeTab === 'python' ? pyCode :
                      activeTab === 'curl' ? curlCode : goCode;
                    copyCode(code);
                  }}
                >
                  {copied ? <Check className="h-3 w-3 text-positive" /> : <Copy className="h-3 w-3" />}
                  {copied ? 'Copied' : 'Copy Snippet'}
                </Button>
              )}
            </div>

            {activeTab === 'response' ? (
              result ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-2xs font-mono">
                    <span className={`inline-flex items-center gap-1 font-semibold ${result.status < 300 ? 'text-positive' : 'text-critical'}`}>
                      <StatusDot tone={result.status < 300 ? 'positive' : 'critical'} /> HTTP {result.status}
                    </span>
                    <span className="text-ink-faint">{Math.round(result.durationMs)}ms</span>
                  </div>
                  <pre className="thin-scroll max-h-64 overflow-auto rounded-xl border border-line bg-sunken p-3 font-mono text-xs text-ink leading-relaxed">
                    {result.body}
                  </pre>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-line p-8 text-center text-xs text-ink-faint">
                  Send a request to inspect live JSON response, status code, and latency.
                </div>
              )
            ) : (
              <pre className="thin-scroll max-h-72 overflow-auto rounded-xl border border-line bg-sunken p-3 font-mono text-xs text-ink leading-relaxed">
                {activeTab === 'typescript' ? tsCode :
                 activeTab === 'python' ? pyCode :
                 activeTab === 'curl' ? curlCode : goCode}
              </pre>
            )}
          </div>
        </div>
      </Panel>
    </div>
  );
}

function CreateKeyForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [label, setLabel] = useState('');
  const [role, setRole] = useState<'public' | 'secret'>('secret');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await api<{ key: string }>('/api/v1/keys', {
        method: 'POST',
        body: JSON.stringify({ label, role }),
      });
      setCreatedKey(res.key);
    } catch (e) {
      setError(e instanceof RequestFailed ? e.apiError : { code: 'UNKNOWN_ERROR', message: String(e) });
    } finally {
      setSaving(false);
    }
  };

  if (createdKey) {
    return (
      <Panel title="API key created">
        <div className="space-y-3 p-4">
          <p className="text-xs text-positive font-semibold">Copy this key now. It cannot be displayed again.</p>
          <div className="flex gap-2">
            <Input value={createdKey} readOnly className="font-mono text-xs bg-sunken" />
            <Button
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(createdKey);
                alert('Copied key to clipboard');
              }}
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
          <Button variant="primary" onClick={onDone}>Done</Button>
        </div>
      </Panel>
    );
  }

  return (
    <Panel title="New API key">
      <div className="space-y-3 p-4">
        <Field label="Label" hint="e.g. Production Web Client, NextJS Server Backend">
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Production Web Client" autoFocus />
        </Field>

        <Field label="Role">
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs text-ink cursor-pointer">
              <input type="radio" name="role" value="secret" checked={role === 'secret'} onChange={() => setRole('secret')} />
              <span><strong>Secret Key</strong> — full administrative access (server-side only)</span>
            </label>
            <label className="flex items-center gap-2 text-xs text-ink cursor-pointer">
              <input type="radio" name="role" value="public" checked={role === 'public'} onChange={() => setRole('public')} />
              <span><strong>Public Key</strong> — read and row-level access (safe for browser)</span>
            </label>
          </div>
        </Field>

        {error && <ErrorNote error={error} />}

        <div className="flex gap-2 border-t border-line pt-3">
          <Button variant="primary" onClick={submit} disabled={!label.trim() || saving}>
            {saving ? 'Generating…' : 'Generate Key'}
          </Button>
          <Button onClick={onCancel}>Cancel</Button>
        </div>
      </div>
    </Panel>
  );
}

export default function ApiPage() {
  const keys = useApi<{ keys: KeyRecord[] }>('/api/v1/keys');
  const [creating, setCreating] = useState(false);

  const revoke = async (id: string) => {
    if (!window.confirm('Revoke this key? Applications using it will lose access immediately.')) return;
    await api(`/api/v1/keys/${id}`, { method: 'DELETE' });
    keys.reload();
  };

  const rows = keys.data?.keys ?? [];

  return (
    <>
      <PageHeader
        title="API"
        description="Edge REST endpoints, authentication keys, and multi-language client code generators."
        action={
          <div className="flex gap-2">
            <Button size="sm" onClick={keys.reload}><RotateCw className="h-3.5 w-3.5" /> Refresh</Button>
            <Button size="sm" variant="primary" onClick={() => setCreating(true)}><KeyRound className="h-3.5 w-3.5" /> New Key</Button>
          </div>
        }
      />

      {creating ? (
        <div className="mb-6">
          <CreateKeyForm onDone={() => { setCreating(false); keys.reload(); }} onCancel={() => setCreating(false)} />
        </div>
      ) : null}

      <div className="space-y-6">
        <ApiPlayground />

        <Panel title={`API Keys (${rows.length})`}>
          {keys.loading ? (
            <Spinner />
          ) : keys.error ? (
            <div className="p-3"><ErrorNote error={keys.error} onRetry={keys.reload} /></div>
          ) : rows.length === 0 ? (
            <Empty title="No API keys provisioned yet." action={<Button size="sm" variant="primary" onClick={() => setCreating(true)}>New Key</Button>} />
          ) : (
            <DataTable
              columns={[
                {
                  key: 'label',
                  label: 'Label',
                  render: (r) => (
                    <div className="space-y-0.5">
                      <p className="font-semibold text-ink text-xs">{String(r.label)}</p>
                      <p className="font-mono text-2xs text-ink-faint">{String(r.key_masked)}</p>
                    </div>
                  ),
                },
                {
                  key: 'role',
                  label: 'Role',
                  render: (r) => <Tag tone={r.role === 'secret' ? 'accent' : 'neutral'}>{String(r.role)}</Tag>,
                },
                {
                  key: 'created_at',
                  label: 'Created',
                  render: (r) => <span className="text-2xs text-ink-soft">{relative(String(r.created_at))}</span>,
                },
                {
                  key: '_actions',
                  label: 'Actions',
                  align: 'right',
                  render: (r) => (
                    <Button size="sm" variant="ghost" onClick={() => revoke(String(r.id))} aria-label="Revoke key">
                      <Trash2 className="h-3.5 w-3.5 text-critical" />
                    </Button>
                  ),
                },
              ]}
              rows={rows as unknown as Record<string, unknown>[]}
            />
          )}
        </Panel>
      </div>
    </>
  );
}
