'use client';

import { useState } from 'react';
import {
  BookOpen, Copy, Check, Download, ExternalLink, Play, Lock, Sparkles,
  Send, Database, Layers, Search, Code2, ChevronDown, ChevronRight, Shield, Zap,
  KeyRound, Globe, Radio, FolderGit2, HardDrive, Terminal, FileCode, ArrowRight,
  HelpCircle, AlertCircle, RefreshCw, CheckCircle2, ShieldCheck, Cpu, Hash
} from 'lucide-react';
import { useApi } from '@/lib/api';
import { PageHeader } from '@/components/shell';
import { Button, Empty, Field, Input, Panel, StatusDot, Tag } from '@/components/primitives';

interface TableMeta {
  name: string;
  schema: string;
  columns: { name: string; dataType: string; nullable: boolean; isPrimaryKey: boolean; defaultValue: string | null }[];
}

type DocSection =
  | 'overview'
  | 'auth'
  | 'rest-explorer'
  | 'filtering'
  | 'rpc'
  | 'storage'
  | 'realtime'
  | 'functions'
  | 'webhooks'
  | 'sdks'
  | 'errors';

export default function DocsPage() {
  const schema = useApi<{ tables: TableMeta[] }>('/api/v1/meta/tables');
  const [activeSection, setActiveSection] = useState<DocSection>('overview');
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<'GET' | 'POST' | 'PATCH' | 'DELETE'>('GET');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ status: number; durationMs: number; headers: Record<string, string>; body: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [requestBody, setRequestBody] = useState('{\n  "name": "Sample Item",\n  "active": true\n}');
  const [activeTab, setActiveTab] = useState<'response' | 'typescript' | 'python' | 'curl' | 'go'>('response');
  const [activeSdkTab, setActiveSdkTab] = useState<'typescript' | 'python' | 'go' | 'curl'>('typescript');

  const tables = schema.data?.tables ?? [];
  const filteredTables = tables.filter((t) => t.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const activeTable = tables.find((t) => t.name === selectedTable) ?? tables[0] ?? null;

  const endpointUrl = activeTable ? `/api/v1/${activeTable.name}` : '/api/v1/users';

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleTest = async () => {
    if (!activeTable) return;
    setTesting(true);
    setTestResult(null);
    const start = performance.now();

    try {
      const res = await fetch(`/bf${endpointUrl}?limit=5`, {
        method: selectedMethod,
        headers: { 'Content-Type': 'application/json' },
        ...(selectedMethod !== 'GET' && selectedMethod !== 'DELETE' ? { body: requestBody } : {}),
      });
      const text = await res.text();
      let pretty = text;
      try { pretty = JSON.stringify(JSON.parse(text), null, 2); } catch { /* not JSON */ }

      setTestResult({
        status: res.status,
        durationMs: Math.round(performance.now() - start),
        headers: Object.fromEntries(res.headers.entries()),
        body: pretty,
      });
      setActiveTab('response');
    } catch (e: unknown) {
      setTestResult({
        status: 500,
        durationMs: Math.round(performance.now() - start),
        headers: {},
        body: JSON.stringify({ error: String(e) }, null, 2),
      });
    } finally {
      setTesting(false);
    }
  };

  const downloadOpenApiJson = async () => {
    try {
      const res = await fetch('/bf/api/v1/openapi.json');
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `stratum-openapi-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    }
  };

  const tsCode = `import { createClient } from '@stratum/client';

const stratum = createClient({
  url: 'https://stratum-api.jojin1709.workers.dev',
  key: process.env.STRATUM_API_KEY!
});

// ${selectedMethod} ${endpointUrl}
const res = await fetch('https://stratum-api.jojin1709.workers.dev${endpointUrl}', {
  method: '${selectedMethod}',
  headers: {
    'apikey': process.env.STRATUM_API_KEY!,
    'Authorization': 'Bearer ' + process.env.STRATUM_API_KEY!,
    'Content-Type': 'application/json'
  }${selectedMethod !== 'GET' && selectedMethod !== 'DELETE' ? `,\n  body: JSON.stringify(${requestBody.replace(/\n/g, '\n  ')})` : ''}
});
const data = await res.json();
console.log(data);`;

  const pyCode = `import httpx
import os

url = "https://stratum-api.jojin1709.workers.dev${endpointUrl}"
headers = {
    "apikey": os.environ.get("STRATUM_API_KEY"),
    "Authorization": f"Bearer {os.environ.get('STRATUM_API_KEY')}",
    "Content-Type": "application/json"
}

with httpx.Client() as client:
    response = client.request(
        method="${selectedMethod}",
        url=url,
        headers=headers${selectedMethod !== 'GET' && selectedMethod !== 'DELETE' ? `,\n        json=${requestBody}` : ''}
    )
    print("Status:", response.status_code)
    print("Response:", response.json())`;

  const curlCode = `curl -X ${selectedMethod} "https://stratum-api.jojin1709.workers.dev${endpointUrl}?limit=10" \\
  -H "apikey: $STRATUM_API_KEY" \\
  -H "Authorization: Bearer $STRATUM_API_KEY" \\
  -H "Content-Type: application/json"${selectedMethod !== 'GET' && selectedMethod !== 'DELETE' ? ` \\\n  -d '${requestBody.replace(/\n/g, '')}'` : ''}`;

  const goCode = `package main

import (
	"fmt"
	"io"
	"net/http"
	"os"${selectedMethod !== 'GET' && selectedMethod !== 'DELETE' ? '\n\t"strings"' : ''}
)

func main() {
	url := "https://stratum-api.jojin1709.workers.dev${endpointUrl}"
	req, _ := http.NewRequest("${selectedMethod}", url, ${selectedMethod !== 'GET' && selectedMethod !== 'DELETE' ? `strings.NewReader(\`${requestBody}\`)` : 'nil'})
	req.Header.Set("apikey", os.Getenv("STRATUM_API_KEY"))
	req.Header.Set("Authorization", "Bearer "+os.Getenv("STRATUM_API_KEY"))
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, _ := client.Do(req)
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	fmt.Println(string(body))
}`;

  const navItems: { id: DocSection; label: string; icon: any; badge?: string }[] = [
    { id: 'overview', label: 'Getting Started', icon: BookOpen },
    { id: 'auth', label: 'Auth & API Keys', icon: ShieldCheck, badge: 'Crucial' },
    { id: 'rest-explorer', label: 'Live REST Explorer', icon: Terminal, badge: `${tables.length} tables` },
    { id: 'filtering', label: 'Filtering & Operators', icon: Hash },
    { id: 'rpc', label: 'Raw SQL & RPC', icon: Cpu },
    { id: 'storage', label: 'Storage & S3 API', icon: HardDrive },
    { id: 'realtime', label: 'Realtime WebSockets', icon: Radio },
    { id: 'functions', label: 'Edge Functions', icon: Zap },
    { id: 'webhooks', label: 'Webhooks & Events', icon: Globe },
    { id: 'sdks', label: 'Client SDKs', icon: Code2 },
    { id: 'errors', label: 'Errors & Status Codes', icon: AlertCircle },
  ];

  return (
    <>
      <PageHeader
        title="Developer Documentation & API Reference"
        description="Comprehensive architecture guides, live interactive REST explorer, WebSocket events, and multi-language client SDKs."
        action={
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={downloadOpenApiJson}>
              <Download className="h-3.5 w-3.5" /> Download OpenAPI 3.1 JSON
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        {/* Navigation Sidebar */}
        <div className="space-y-4">
          <Panel title="Documentation">
            <nav className="p-2 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveSection(item.id)}
                    className={`flex w-full items-center justify-between px-3 py-2 text-xs font-semibold rounded-xl transition-all ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-xs font-bold'
                        : 'text-ink-soft hover:bg-sunken hover:text-ink'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-white' : 'text-ink-faint'}`} />
                      <span>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className={`text-3xs px-1.5 py-0.5 rounded-md font-mono ${
                        isActive ? 'bg-white/20 text-white' : 'bg-surface border border-line text-ink-faint'
                      }`}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </Panel>

          {/* Table quick-jump when on rest-explorer */}
          {activeSection === 'rest-explorer' && tables.length > 0 && (
            <Panel title="Introspected Tables">
              <div className="p-2 border-b border-line">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" />
                  <input
                    type="text"
                    placeholder="Filter tables..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-8 w-full rounded-lg border border-line bg-surface pl-8 pr-2 text-xs text-ink outline-none focus:border-blue-500"
                  />
                </div>
              </div>
              <ul className="divide-y divide-line max-h-60 overflow-y-auto">
                {filteredTables.map((t) => (
                  <li key={t.name}>
                    <button
                      onClick={() => { setSelectedTable(t.name); setTestResult(null); }}
                      className={`flex w-full items-center justify-between p-2.5 text-left transition-colors ${
                        activeTable?.name === t.name
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
          )}

          {/* Base URL info panel */}
          <div className="rounded-2xl border border-line bg-surface p-4 space-y-2">
            <div className="flex items-center gap-2 text-2xs font-bold uppercase tracking-wider text-ink-faint">
              <Globe className="h-3.5 w-3.5 text-blue-500" /> Edge Base URL
            </div>
            <code className="block break-all rounded-lg border border-line bg-sunken p-2 font-mono text-2xs text-ink">
              https://stratum-api.jojin1709.workers.dev
            </code>
            <p className="text-3xs text-ink-faint">
              Globally distributed across 330+ Cloudflare edge PoPs with automatic Hyperdrive connection pooling.
            </p>
          </div>
        </div>

        {/* Main Documentation Area */}
        <div className="space-y-6 min-w-0">

          {/* SECTION 1: OVERVIEW & ARCHITECTURE */}
          {activeSection === 'overview' && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-line bg-gradient-to-br from-blue-500/10 via-surface to-surface p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-ink">Stratum API Platform Overview</h2>
                    <p className="text-xs text-ink-soft">The High-Performance Cloudflare Workers BaaS & Real-Time Engine</p>
                  </div>
                </div>
                <p className="text-xs text-ink leading-relaxed mb-4">
                  Stratum transforms any PostgreSQL database into an instant, high-speed, edge-cached REST and WebSocket API. 
                  Every schema modification is introspected automatically at sub-millisecond latency, generating fully type-safe endpoints, Row-Level Security enforcement, realtime pub/sub feeds, serverless edge compute, and object storage.
                </p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-line bg-surface p-3 space-y-1">
                    <div className="flex items-center gap-2 text-xs font-bold text-ink">
                      <Zap className="h-4 w-4 text-amber-500" /> &lt;25ms P95 Latency
                    </div>
                    <p className="text-2xs text-ink-soft">Sub-millisecond query routing with Hyperdrive transaction pooling.</p>
                  </div>
                  <div className="rounded-xl border border-line bg-surface p-3 space-y-1">
                    <div className="flex items-center gap-2 text-xs font-bold text-ink">
                      <ShieldCheck className="h-4 w-4 text-emerald-500" /> Native RLS Security
                    </div>
                    <p className="text-2xs text-ink-soft">Direct PostgreSQL Row-Level Security integration with JWT claims.</p>
                  </div>
                  <div className="rounded-xl border border-line bg-surface p-3 space-y-1">
                    <div className="flex items-center gap-2 text-xs font-bold text-ink">
                      <Radio className="h-4 w-4 text-purple-500" /> Full CDC Realtime
                    </div>
                    <p className="text-2xs text-ink-soft">Durable Objects WebSockets with broadcast and Postgres notify.</p>
                  </div>
                </div>
              </div>

              {/* Quickstart 3-Step Guide */}
              <Panel title="Quick Start Guide">
                <div className="p-5 space-y-6">
                  <div className="flex gap-4">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">1</div>
                    <div className="space-y-2 flex-1">
                      <h4 className="text-xs font-bold text-ink">Install the Official Stratum Client</h4>
                      <div className="relative">
                        <pre className="rounded-xl border border-line bg-sunken p-3 font-mono text-xs text-ink">
                          npm install @stratum/client
                        </pre>
                        <button
                          onClick={() => copyToClipboard('npm install @stratum/client', 'npm-install')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg border border-line bg-surface p-1 text-ink-soft hover:text-ink"
                        >
                          {copiedCode === 'npm-install' ? <Check className="h-3.5 w-3.5 text-positive" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">2</div>
                    <div className="space-y-2 flex-1">
                      <h4 className="text-xs font-bold text-ink">Initialize the Client with your API Key</h4>
                      <p className="text-2xs text-ink-soft">Use your public key in frontend browsers, or your service secret key on secure backend servers.</p>
                      <div className="relative">
                        <pre className="rounded-xl border border-line bg-sunken p-3 font-mono text-xs text-ink leading-relaxed">
{`import { createClient } from '@stratum/client';

const stratum = createClient({
  url: 'https://stratum-api.jojin1709.workers.dev',
  key: process.env.STRATUM_API_KEY!
});`}
                        </pre>
                        <button
                          onClick={() => copyToClipboard(`import { createClient } from '@stratum/client';\nconst stratum = createClient({ url: 'https://stratum-api.jojin1709.workers.dev', key: process.env.STRATUM_API_KEY! });`, 'init-client')}
                          className="absolute right-3 top-3 rounded-lg border border-line bg-surface p-1 text-ink-soft hover:text-ink"
                        >
                          {copiedCode === 'init-client' ? <Check className="h-3.5 w-3.5 text-positive" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">3</div>
                    <div className="space-y-2 flex-1">
                      <h4 className="text-xs font-bold text-ink">Query and Stream Live Data</h4>
                      <div className="relative">
                        <pre className="rounded-xl border border-line bg-sunken p-3 font-mono text-xs text-ink leading-relaxed">
{`// 1. Type-safe Database Query
const { data, error } = await stratum
  .from('users')
  .select('id, name, email')
  .eq('active', true)
  .order('created_at', { ascending: false })
  .limit(10);

// 2. Realtime Subscription
const channel = stratum.channel('users')
  .on('INSERT', (payload) => console.log('New user created:', payload.new))
  .subscribe();`}
                        </pre>
                        <button
                          onClick={() => copyToClipboard(`const { data, error } = await stratum.from('users').select('*').eq('active', true);\nconst channel = stratum.channel('users').on('INSERT', (p) => console.log(p.new)).subscribe();`, 'query-demo')}
                          className="absolute right-3 top-3 rounded-lg border border-line bg-surface p-1 text-ink-soft hover:text-ink"
                        >
                          {copiedCode === 'query-demo' ? <Check className="h-3.5 w-3.5 text-positive" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </Panel>
            </div>
          )}

          {/* SECTION 2: AUTH & API KEYS */}
          {activeSection === 'auth' && (
            <div className="space-y-6">
              <Panel title="Authentication & Key Architecture">
                <div className="p-5 space-y-4">
                  <p className="text-xs text-ink leading-relaxed">
                    Stratum uses two key tiers to balance client-side frontend safety and administrative backend control. All HTTP requests require an authentication token passed in either the <code className="text-blue-500 font-mono">apikey</code> header or <code className="text-blue-500 font-mono">Authorization: Bearer &lt;token&gt;</code> header.
                  </p>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-2">
                      <div className="flex items-center gap-2 font-bold text-xs text-emerald-600 dark:text-emerald-400">
                        <KeyRound className="h-4 w-4" /> Public Anon Key (strat_public_...)
                      </div>
                      <p className="text-2xs text-ink-soft">
                        Safe to bundle in client browsers, mobile applications, and SPAs. All queries executed with this key strictly obey PostgreSQL Row-Level Security (RLS) policies.
                      </p>
                      <div className="font-mono text-2xs rounded bg-surface border border-line p-2 text-ink">
                        apikey: strat_public_98a76d...
                      </div>
                    </div>

                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-2">
                      <div className="flex items-center gap-2 font-bold text-xs text-amber-600 dark:text-amber-400">
                        <Lock className="h-4 w-4" /> Secret Service Role Key (strat_secret_...)
                      </div>
                      <p className="text-2xs text-ink-soft">
                        Full root administrative access. <strong>Never expose this key in client-side code</strong>. Bypasses all Row-Level Security policies for server tasks, cron jobs, and internal microservices.
                      </p>
                      <div className="font-mono text-2xs rounded bg-surface border border-line p-2 text-ink">
                        apikey: strat_secret_12f8e4...
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-line pt-4 space-y-3">
                    <h4 className="text-xs font-bold text-ink">Standard Headers Reference</h4>
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-line text-2xs uppercase tracking-wider text-ink-faint">
                          <th className="pb-2 font-semibold">Header</th>
                          <th className="pb-2 font-semibold">Description</th>
                          <th className="pb-2 font-semibold">Example</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line text-2xs">
                        <tr>
                          <td className="py-2.5 font-mono font-bold text-blue-500">apikey</td>
                          <td className="py-2.5 text-ink-soft">Your platform public or secret key</td>
                          <td className="py-2.5 font-mono text-ink-faint">strat_public_...</td>
                        </tr>
                        <tr>
                          <td className="py-2.5 font-mono font-bold text-blue-500">Authorization</td>
                          <td className="py-2.5 text-ink-soft">Bearer authentication token or user JWT</td>
                          <td className="py-2.5 font-mono text-ink-faint">Bearer eyJhbGciOi...</td>
                        </tr>
                        <tr>
                          <td className="py-2.5 font-mono font-bold text-blue-500">Content-Type</td>
                          <td className="py-2.5 text-ink-soft">Payload MIME type</td>
                          <td className="py-2.5 font-mono text-ink-faint">application/json</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </Panel>
            </div>
          )}

          {/* SECTION 3: LIVE REST EXPLORER */}
          {activeSection === 'rest-explorer' && (
            <div className="space-y-6">
              {activeTable ? (
                <>
                  <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`rounded-lg px-3 py-1 font-mono text-xs font-bold text-white uppercase shadow-xs ${
                            selectedMethod === 'GET' ? 'bg-blue-600' :
                            selectedMethod === 'POST' ? 'bg-emerald-600' :
                            selectedMethod === 'PATCH' ? 'bg-amber-600' : 'bg-rose-600'
                          }`}
                        >
                          {selectedMethod}
                        </span>
                        <code className="font-mono text-sm font-bold text-ink">
                          https://stratum-api.jojin1709.workers.dev{endpointUrl}
                        </code>
                      </div>

                      <Button size="sm" variant="primary" onClick={handleTest} disabled={testing}>
                        <Send className="h-3 w-3" /> {testing ? 'Executing…' : 'Send Live Request'}
                      </Button>
                    </div>

                    {/* Method Switcher */}
                    <div className="flex items-center gap-2 pt-2 border-t border-line">
                      {(['GET', 'POST', 'PATCH', 'DELETE'] as const).map((m) => (
                        <button
                          key={m}
                          onClick={() => { setSelectedMethod(m); setTestResult(null); }}
                          className={`rounded-lg px-3 py-1.5 text-xs font-bold font-mono transition-all ${
                            selectedMethod === m
                              ? m === 'GET' ? 'bg-blue-500/15 text-blue-600 border border-blue-500/30' :
                                m === 'POST' ? 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/30' :
                                m === 'PATCH' ? 'bg-amber-500/15 text-amber-600 border border-amber-500/30' :
                                'bg-rose-500/15 text-rose-600 border border-rose-500/30'
                              : 'text-ink-soft hover:text-ink border border-transparent'
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>

                    {selectedMethod !== 'GET' && selectedMethod !== 'DELETE' && (
                      <Field label="Request Body (JSON)">
                        <textarea
                          value={requestBody}
                          onChange={(e) => setRequestBody(e.target.value)}
                          spellCheck={false}
                          rows={4}
                          className="thin-scroll w-full rounded-xl border border-line bg-surface p-3 font-mono text-xs text-ink focus:border-blue-500 outline-none"
                        />
                      </Field>
                    )}
                  </div>

                  {/* Tabs for Live Response & Multi-Language Code Snippets */}
                  <Panel
                    title="Response & Code Snippets"
                    action={
                      activeTab !== 'response' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            const code =
                              activeTab === 'typescript' ? tsCode :
                              activeTab === 'python' ? pyCode :
                              activeTab === 'curl' ? curlCode : goCode;
                            copyToClipboard(code, 'tab-code');
                          }}
                        >
                          {copiedCode === 'tab-code' ? <Check className="h-3 w-3 text-positive" /> : <Copy className="h-3 w-3" />}
                          {copiedCode === 'tab-code' ? 'Copied' : 'Copy Code'}
                        </Button>
                      )
                    }
                  >
                    <div className="p-4 space-y-3">
                      <div className="flex items-center gap-1.5 rounded-lg border border-line bg-surface p-1 w-fit">
                        <button
                          onClick={() => setActiveTab('response')}
                          className={`px-3 py-1 text-2xs font-semibold rounded-md transition-colors ${
                            activeTab === 'response' ? 'bg-blue-600 text-white' : 'text-ink-soft hover:text-ink'
                          }`}
                        >
                          Live Response {testResult ? `(${testResult.status})` : ''}
                        </button>
                        <button
                          onClick={() => setActiveTab('typescript')}
                          className={`px-3 py-1 text-2xs font-semibold rounded-md transition-colors ${
                            activeTab === 'typescript' ? 'bg-blue-600 text-white' : 'text-ink-soft hover:text-ink'
                          }`}
                        >
                          TypeScript
                        </button>
                        <button
                          onClick={() => setActiveTab('python')}
                          className={`px-3 py-1 text-2xs font-semibold rounded-md transition-colors ${
                            activeTab === 'python' ? 'bg-blue-600 text-white' : 'text-ink-soft hover:text-ink'
                          }`}
                        >
                          Python
                        </button>
                        <button
                          onClick={() => setActiveTab('curl')}
                          className={`px-3 py-1 text-2xs font-semibold rounded-md transition-colors ${
                            activeTab === 'curl' ? 'bg-blue-600 text-white' : 'text-ink-soft hover:text-ink'
                          }`}
                        >
                          cURL
                        </button>
                        <button
                          onClick={() => setActiveTab('go')}
                          className={`px-3 py-1 text-2xs font-semibold rounded-md transition-colors ${
                            activeTab === 'go' ? 'bg-blue-600 text-white' : 'text-ink-soft hover:text-ink'
                          }`}
                        >
                          Go
                        </button>
                      </div>

                      {activeTab === 'response' ? (
                        testResult ? (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-2xs font-mono">
                              <span className={`inline-flex items-center gap-1 font-bold ${testResult.status < 300 ? 'text-positive' : 'text-critical'}`}>
                                <StatusDot tone={testResult.status < 300 ? 'positive' : 'critical'} /> HTTP {testResult.status} OK
                              </span>
                              <span className="text-ink-faint">{testResult.durationMs}ms</span>
                            </div>
                            <pre className="thin-scroll max-h-72 overflow-auto rounded-xl border border-line bg-sunken p-3 font-mono text-xs text-ink leading-relaxed">
                              {testResult.body}
                            </pre>
                          </div>
                        ) : (
                          <div className="rounded-xl border border-dashed border-line p-8 text-center text-xs text-ink-faint">
                            Click &quot;Send Live Request&quot; above to execute this endpoint and inspect the live JSON payload.
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
                  </Panel>

                  {/* Schema Fields */}
                  <Panel title={`Resource Schema: ${activeTable.name}`}>
                    <div className="p-4">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-line text-2xs uppercase tracking-wider text-ink-faint">
                            <th className="pb-2 font-semibold">Column</th>
                            <th className="pb-2 font-semibold">Data Type</th>
                            <th className="pb-2 font-semibold">Nullability</th>
                            <th className="pb-2 font-semibold">Default</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                          {activeTable.columns.map((c) => (
                            <tr key={c.name} className="py-2.5">
                              <td className="py-2 font-mono font-bold text-ink">
                                {c.name} {c.isPrimaryKey && <span className="text-amber-500 font-normal">🔑</span>}
                              </td>
                              <td className="py-2 font-mono text-blue-600 dark:text-blue-400">{c.dataType}</td>
                              <td className="py-2 text-ink-soft">{c.nullable ? 'nullable' : 'not null'}</td>
                              <td className="py-2 font-mono text-2xs text-ink-faint">{c.defaultValue || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Panel>
                </>
              ) : (
                <Panel><Empty title="No tables discovered in PostgreSQL database." /></Panel>
              )}
            </div>
          )}

          {/* SECTION 4: FILTERING & OPERATORS */}
          {activeSection === 'filtering' && (
            <div className="space-y-6">
              <Panel title="Query Parameters & Filter Operators">
                <div className="p-5 space-y-4">
                  <p className="text-xs text-ink leading-relaxed">
                    Stratum REST endpoints support PostgREST-compliant query filter operators in URL query strings. Multiple filters are combined with <code className="font-mono text-blue-500">AND</code> logic.
                  </p>

                  <div className="border border-line rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-sunken border-b border-line">
                        <tr className="text-2xs uppercase tracking-wider text-ink-faint">
                          <th className="p-3 font-semibold">Operator</th>
                          <th className="p-3 font-semibold">Meaning</th>
                          <th className="p-3 font-semibold">Example Query URL</th>
                          <th className="p-3 font-semibold">Client SDK Method</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line text-2xs">
                        <tr>
                          <td className="p-3 font-mono font-bold text-blue-500">eq</td>
                          <td className="p-3 text-ink">Equals</td>
                          <td className="p-3 font-mono text-ink-faint">?status=eq.active</td>
                          <td className="p-3 font-mono text-emerald-600 dark:text-emerald-400">.eq(&apos;status&apos;, &apos;active&apos;)</td>
                        </tr>
                        <tr>
                          <td className="p-3 font-mono font-bold text-blue-500">neq</td>
                          <td className="p-3 text-ink">Not equal</td>
                          <td className="p-3 font-mono text-ink-faint">?status=neq.deleted</td>
                          <td className="p-3 font-mono text-emerald-600 dark:text-emerald-400">.neq(&apos;status&apos;, &apos;deleted&apos;)</td>
                        </tr>
                        <tr>
                          <td className="p-3 font-mono font-bold text-blue-500">gt / gte</td>
                          <td className="p-3 text-ink">Greater than / Greater than or equal</td>
                          <td className="p-3 font-mono text-ink-faint">?price=gte.100</td>
                          <td className="p-3 font-mono text-emerald-600 dark:text-emerald-400">.gte(&apos;price&apos;, 100)</td>
                        </tr>
                        <tr>
                          <td className="p-3 font-mono font-bold text-blue-500">lt / lte</td>
                          <td className="p-3 text-ink">Less than / Less than or equal</td>
                          <td className="p-3 font-mono text-ink-faint">?age=lt.30</td>
                          <td className="p-3 font-mono text-emerald-600 dark:text-emerald-400">.lt(&apos;age&apos;, 30)</td>
                        </tr>
                        <tr>
                          <td className="p-3 font-mono font-bold text-blue-500">like / ilike</td>
                          <td className="p-3 text-ink">Pattern match (ilike = case-insensitive)</td>
                          <td className="p-3 font-mono text-ink-faint">?email=ilike.*@gmail.com</td>
                          <td className="p-3 font-mono text-emerald-600 dark:text-emerald-400">.ilike(&apos;email&apos;, &apos;%@gmail.com&apos;)</td>
                        </tr>
                        <tr>
                          <td className="p-3 font-mono font-bold text-blue-500">is</td>
                          <td className="p-3 text-ink">Null checking (null, not.null, true, false)</td>
                          <td className="p-3 font-mono text-ink-faint">?deleted_at=is.null</td>
                          <td className="p-3 font-mono text-emerald-600 dark:text-emerald-400">.is(&apos;deleted_at&apos;, null)</td>
                        </tr>
                        <tr>
                          <td className="p-3 font-mono font-bold text-blue-500">in</td>
                          <td className="p-3 text-ink">One of a list of values</td>
                          <td className="p-3 font-mono text-ink-faint">?role=in.(admin,manager)</td>
                          <td className="p-3 font-mono text-emerald-600 dark:text-emerald-400">.in(&apos;role&apos;, [&apos;admin&apos;, &apos;manager&apos;])</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 pt-2">
                    <div className="rounded-xl border border-line bg-surface p-4 space-y-2">
                      <h4 className="text-xs font-bold text-ink">Pagination & Limits</h4>
                      <p className="text-2xs text-ink-soft">
                        Control paging with <code className="font-mono text-blue-500">limit</code> and <code className="font-mono text-blue-500">offset</code> parameters.
                      </p>
                      <pre className="rounded-lg bg-sunken p-2.5 font-mono text-2xs text-ink">
                        GET /api/v1/users?limit=25&offset=50
                      </pre>
                    </div>

                    <div className="rounded-xl border border-line bg-surface p-4 space-y-2">
                      <h4 className="text-xs font-bold text-ink">Sorting & Ordering</h4>
                      <p className="text-2xs text-ink-soft">
                        Sort columns ascending or descending with <code className="font-mono text-blue-500">order=column.asc|desc</code>.
                      </p>
                      <pre className="rounded-lg bg-sunken p-2.5 font-mono text-2xs text-ink">
                        GET /api/v1/orders?order=created_at.desc
                      </pre>
                    </div>
                  </div>
                </div>
              </Panel>
            </div>
          )}

          {/* SECTION 5: RPC & RAW SQL */}
          {activeSection === 'rpc' && (
            <div className="space-y-6">
              <Panel title="Raw SQL & Stored Procedures (RPC)">
                <div className="p-5 space-y-4">
                  <p className="text-xs text-ink leading-relaxed">
                    Execute parameterized SQL queries or invoke stored database procedures over HTTPS with instant Hyperdrive pooling.
                  </p>

                  <div className="rounded-xl border border-line bg-surface p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="rounded-md bg-emerald-600 px-2 py-0.5 text-3xs font-mono font-bold text-white">POST</span>
                        <code className="font-mono text-xs font-bold text-ink">/api/v1/rpc/query</code>
                      </div>
                      <Tag tone="accent">Parameterized SQL</Tag>
                    </div>

                    <p className="text-2xs text-ink-soft">
                      Execute parameterized SQL queries safely with positional arguments (<code className="font-mono text-blue-500">$1, $2</code>) to prevent SQL injection vulnerabilities.
                    </p>

                    <pre className="rounded-xl border border-line bg-sunken p-3 font-mono text-xs text-ink leading-relaxed">
{`// Client SDK Usage
const { data, error } = await stratum.rpc(
  'SELECT id, name, count(*) as orders_count FROM users JOIN orders ON users.id = orders.user_id WHERE users.active = $1 GROUP BY users.id',
  [true]
);`}
                    </pre>
                  </div>
                </div>
              </Panel>
            </div>
          )}

          {/* SECTION 6: STORAGE & S3 */}
          {activeSection === 'storage' && (
            <div className="space-y-6">
              <Panel title="Object Storage & S3/R2 API">
                <div className="p-5 space-y-4">
                  <p className="text-xs text-ink leading-relaxed">
                    Stratum Storage provides high-speed binary and asset hosting backed by Cloudflare R2 and AWS S3 with edge-caching and presigned uploads.
                  </p>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-line bg-surface p-3 space-y-1">
                      <div className="flex items-center gap-2 text-xs font-bold text-ink">
                        <HardDrive className="h-4 w-4 text-blue-500" /> Upload File
                      </div>
                      <pre className="rounded-lg bg-sunken p-2 font-mono text-2xs text-ink">
                        POST /api/v1/storage/upload
                      </pre>
                    </div>

                    <div className="rounded-xl border border-line bg-surface p-3 space-y-1">
                      <div className="flex items-center gap-2 text-xs font-bold text-ink">
                        <Globe className="h-4 w-4 text-emerald-500" /> Presigned Upload URL
                      </div>
                      <pre className="rounded-lg bg-sunken p-2 font-mono text-2xs text-ink">
                        GET /api/v1/storage/presigned-url
                      </pre>
                    </div>
                  </div>

                  <div className="border-t border-line pt-3 space-y-2">
                    <h4 className="text-xs font-bold text-ink">TypeScript Storage SDK Example</h4>
                    <pre className="rounded-xl border border-line bg-sunken p-3 font-mono text-xs text-ink leading-relaxed">
{`const avatarFile = document.querySelector('input[type="file"]').files[0];

// Upload directly to 'avatars' bucket
const { data, error } = await stratum
  .storage('avatars')
  .upload(\`user-123/\${avatarFile.name}\`, avatarFile);

// Get Public CDN URL
const publicUrl = stratum.storage('avatars').getPublicUrl('user-123/avatar.png');`}
                    </pre>
                  </div>
                </div>
              </Panel>
            </div>
          )}

          {/* SECTION 7: REALTIME & WEBSOCKETS */}
          {activeSection === 'realtime' && (
            <div className="space-y-6">
              <Panel title="Realtime WebSockets & Change Data Capture (CDC)">
                <div className="p-5 space-y-4">
                  <p className="text-xs text-ink leading-relaxed">
                    Connect directly to Stratum Realtime over WebSocket (<code className="font-mono text-blue-500">wss://stratum-api.jojin1709.workers.dev/realtime/v1</code>) to receive instant database CDC events, broadcast messages, and peer presence tracking.
                  </p>

                  <div className="rounded-xl border border-line bg-surface p-4 space-y-3">
                    <h4 className="text-xs font-bold text-ink">Subscribing to Table Changes & Broadcasts</h4>
                    <pre className="rounded-xl border border-line bg-sunken p-3 font-mono text-xs text-ink leading-relaxed">
{`// 1. Subscribe to PostgreSQL table updates
const channel = stratum.channel('users')
  .on('INSERT', (payload) => console.log('New User:', payload.new))
  .on('UPDATE', (payload) => console.log('User Updated:', payload.new))
  .on('DELETE', (payload) => console.log('User Deleted ID:', payload.old.id))
  .subscribe();

// 2. Broadcast Room (Multiplayer / Chat)
const room = stratum.room('chat-lobby')
  .on('broadcast', { event: 'message' }, (payload) => {
    console.log('Incoming chat message:', payload);
  })
  .subscribe();

// Send broadcast event
await room.send('message', { text: 'Hello Stratum!', sender: 'jojin1709' });`}
                    </pre>
                  </div>
                </div>
              </Panel>
            </div>
          )}

          {/* SECTION 8: EDGE FUNCTIONS */}
          {activeSection === 'functions' && (
            <div className="space-y-6">
              <Panel title="Serverless Edge Functions">
                <div className="p-5 space-y-4">
                  <p className="text-xs text-ink leading-relaxed">
                    Stratum Edge Functions are isolated TypeScript microservices that execute with 0ms cold starts across Cloudflare&apos;s global network.
                  </p>

                  <div className="rounded-xl border border-line bg-surface p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="rounded-md bg-purple-600 px-2 py-0.5 text-3xs font-mono font-bold text-white">POST</span>
                        <code className="font-mono text-xs font-bold text-ink">/functions/v1/:function_name</code>
                      </div>
                      <Tag tone="positive">Edge Deployed</Tag>
                    </div>

                    <pre className="rounded-xl border border-line bg-sunken p-3 font-mono text-xs text-ink leading-relaxed">
{`// Calling an edge function with Stratum SDK
const { data, error } = await stratum.functions().invoke('process-stripe-checkout', {
  priceId: 'price_1N234567',
  userId: 'usr_89234'
});

console.log('Checkout session:', data.sessionId);`}
                    </pre>
                  </div>
                </div>
              </Panel>
            </div>
          )}

          {/* SECTION 9: WEBHOOKS */}
          {activeSection === 'webhooks' && (
            <div className="space-y-6">
              <Panel title="Webhooks & Signature Verification">
                <div className="p-5 space-y-4">
                  <p className="text-xs text-ink leading-relaxed">
                    Stratum dispatches HTTP POST webhooks for database lifecycle events. All webhook payloads include an HMAC SHA-256 signature in the <code className="font-mono text-blue-500">X-Stratum-Signature</code> header for cryptographic verification.
                  </p>

                  <div className="rounded-xl border border-line bg-surface p-4 space-y-3">
                    <h4 className="text-xs font-bold text-ink">Verifying Webhook Signatures in Node.js</h4>
                    <pre className="rounded-xl border border-line bg-sunken p-3 font-mono text-xs text-ink leading-relaxed">
{`import crypto from 'crypto';

export function verifyStratumWebhook(rawBody: string, signatureHeader: string, secret: string): boolean {
  const hmac = crypto.createHmac('sha256', secret);
  const digest = 'sha256=' + hmac.update(rawBody).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(digest));
}`}
                    </pre>
                  </div>
                </div>
              </Panel>
            </div>
          )}

          {/* SECTION 10: CLIENT SDKS */}
          {activeSection === 'sdks' && (
            <div className="space-y-6">
              <Panel title="Official Client SDKs">
                <div className="p-5 space-y-4">
                  <div className="flex items-center gap-2 border-b border-line pb-3">
                    {(['typescript', 'python', 'go', 'curl'] as const).map((lang) => (
                      <button
                        key={lang}
                        onClick={() => setActiveSdkTab(lang)}
                        className={`rounded-lg px-3 py-1 text-xs font-bold capitalize transition-colors ${
                          activeSdkTab === lang ? 'bg-blue-600 text-white' : 'text-ink-soft hover:text-ink'
                        }`}
                      >
                        {lang}
                      </button>
                    ))}
                  </div>

                  {activeSdkTab === 'typescript' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <code className="font-mono text-xs font-bold text-ink">npm install @stratum/client</code>
                        <Button size="sm" variant="ghost" onClick={() => copyToClipboard('npm install @stratum/client', 'sdk-npm')}>
                          {copiedCode === 'sdk-npm' ? <Check className="h-3 w-3 text-positive" /> : <Copy className="h-3 w-3" />}
                        </Button>
                      </div>
                      <pre className="rounded-xl border border-line bg-sunken p-3 font-mono text-xs text-ink leading-relaxed">
{`import { createClient } from '@stratum/client';

const stratum = createClient({
  url: 'https://stratum-api.jojin1709.workers.dev',
  key: process.env.STRATUM_API_KEY!
});

// Query items
const { data, error } = await stratum.from('products').select('*').limit(10);`}
                      </pre>
                    </div>
                  )}

                  {activeSdkTab === 'python' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <code className="font-mono text-xs font-bold text-ink">pip install httpx</code>
                        <Button size="sm" variant="ghost" onClick={() => copyToClipboard('pip install httpx', 'sdk-pip')}>
                          {copiedCode === 'sdk-pip' ? <Check className="h-3 w-3 text-positive" /> : <Copy className="h-3 w-3" />}
                        </Button>
                      </div>
                      <pre className="rounded-xl border border-line bg-sunken p-3 font-mono text-xs text-ink leading-relaxed">
{`import httpx
import os

headers = {"apikey": os.environ["STRATUM_API_KEY"]}
resp = httpx.get("https://stratum-api.jojin1709.workers.dev/api/v1/products?limit=10", headers=headers)
print(resp.json())`}
                      </pre>
                    </div>
                  )}

                  {activeSdkTab === 'go' && (
                    <div className="space-y-3">
                      <pre className="rounded-xl border border-line bg-sunken p-3 font-mono text-xs text-ink leading-relaxed">
{`package main

import (
	"fmt"
	"io"
	"net/http"
	"os"
)

func main() {
	req, _ := http.NewRequest("GET", "https://stratum-api.jojin1709.workers.dev/api/v1/products?limit=10", nil)
	req.Header.Set("apikey", os.Getenv("STRATUM_API_KEY"))
	client := &http.Client{}
	resp, _ := client.Do(req)
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	fmt.Println(string(body))
}`}
                      </pre>
                    </div>
                  )}

                  {activeSdkTab === 'curl' && (
                    <div className="space-y-3">
                      <pre className="rounded-xl border border-line bg-sunken p-3 font-mono text-xs text-ink leading-relaxed">
{`curl -X GET "https://stratum-api.jojin1709.workers.dev/api/v1/products?limit=10" \\
  -H "apikey: $STRATUM_API_KEY" \\
  -H "Content-Type: application/json"`}
                      </pre>
                    </div>
                  )}
                </div>
              </Panel>
            </div>
          )}

          {/* SECTION 11: ERRORS & STATUS CODES */}
          {activeSection === 'errors' && (
            <div className="space-y-6">
              <Panel title="Error Handling & HTTP Status Codes">
                <div className="p-5 space-y-4">
                  <p className="text-xs text-ink leading-relaxed">
                    Stratum returns standard RFC 7807 compliant error payloads containing machine-readable error codes and human-readable messages.
                  </p>

                  <div className="border border-line rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-sunken border-b border-line">
                        <tr className="text-2xs uppercase tracking-wider text-ink-faint">
                          <th className="p-3 font-semibold">Status Code</th>
                          <th className="p-3 font-semibold">Error Name</th>
                          <th className="p-3 font-semibold">Description</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line text-2xs">
                        <tr>
                          <td className="p-3 font-mono font-bold text-positive">200 / 201</td>
                          <td className="p-3 text-ink">Success</td>
                          <td className="p-3 text-ink-soft">Request completed successfully.</td>
                        </tr>
                        <tr>
                          <td className="p-3 font-mono font-bold text-amber-500">400 Bad Request</td>
                          <td className="p-3 font-mono text-ink">INVALID_PARAMETER</td>
                          <td className="p-3 text-ink-soft">Malformed JSON payload or invalid filter operator syntax.</td>
                        </tr>
                        <tr>
                          <td className="p-3 font-mono font-bold text-amber-500">401 Unauthorized</td>
                          <td className="p-3 font-mono text-ink">AUTH_REQUIRED</td>
                          <td className="p-3 text-ink-soft">Missing or invalid API key or expired JWT token.</td>
                        </tr>
                        <tr>
                          <td className="p-3 font-mono font-bold text-amber-500">403 Forbidden</td>
                          <td className="p-3 font-mono text-ink">PERMISSION_DENIED</td>
                          <td className="p-3 text-ink-soft">Violates PostgreSQL Row-Level Security (RLS) policy.</td>
                        </tr>
                        <tr>
                          <td className="p-3 font-mono font-bold text-amber-500">404 Not Found</td>
                          <td className="p-3 font-mono text-ink">NOT_FOUND</td>
                          <td className="p-3 text-ink-soft">Specified table, function, or record does not exist.</td>
                        </tr>
                        <tr>
                          <td className="p-3 font-mono font-bold text-amber-500">409 Conflict</td>
                          <td className="p-3 font-mono text-ink">UNIQUE_VIOLATION</td>
                          <td className="p-3 text-ink-soft">Unique constraint or primary key collision in PostgreSQL.</td>
                        </tr>
                        <tr>
                          <td className="p-3 font-mono font-bold text-critical">429 Too Many Requests</td>
                          <td className="p-3 font-mono text-ink">RATE_LIMITED</td>
                          <td className="p-3 text-ink-soft">Exceeded platform rate limits (default 500 req/sec).</td>
                        </tr>
                        <tr>
                          <td className="p-3 font-mono font-bold text-critical">500 Internal Error</td>
                          <td className="p-3 font-mono text-ink">INTERNAL_ERROR</td>
                          <td className="p-3 text-ink-soft">Database connection timeout or internal engine error.</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </Panel>
            </div>
          )}

        </div>
      </div>
    </>
  );
}
