'use client';

import { useState } from 'react';
import {
  BookOpen, Copy, Check, Download, ExternalLink, Play, Lock, Sparkles,
  Send, Database, Layers, Search, Code2, ChevronDown, ChevronRight, Shield, Zap
} from 'lucide-react';
import { useApi } from '@/lib/api';
import { PageHeader } from '@/components/shell';
import { Button, Empty, Field, Input, Panel, StatusDot, Tag } from '@/components/primitives';

interface TableMeta {
  name: string;
  schema: string;
  columns: { name: string; dataType: string; nullable: boolean; isPrimaryKey: boolean; defaultValue: string | null }[];
}

export default function DocsPage() {
  const schema = useApi<{ tables: TableMeta[] }>('/api/v1/meta/tables');
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<'GET' | 'POST' | 'PATCH' | 'DELETE'>('GET');
  const [copiedCode, setCopiedCode] = useState(false);
  const [testResult, setTestResult] = useState<{ status: number; durationMs: number; headers: Record<string, string>; body: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [requestBody, setRequestBody] = useState('{\n  "name": "Sample Item",\n  "active": true\n}');
  const [activeTab, setActiveTab] = useState<'response' | 'typescript' | 'python' | 'curl' | 'go'>('response');

  const tables = schema.data?.tables ?? [];
  const filteredTables = tables.filter((t) => t.name.toLowerCase().includes(searchQuery.toLowerCase()));
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

const stratum = createClient('https://stratum-api.jojin1709.workers.dev', {
  apiKey: process.env.STRATUM_API_KEY
});

// ${selectedMethod} ${endpointUrl}
const res = await fetch('https://stratum-api.jojin1709.workers.dev${endpointUrl}', {
  method: '${selectedMethod}',
  headers: {
    'Authorization': 'Bearer ' + process.env.STRATUM_API_KEY,
    'Content-Type': 'application/json'
  }${selectedMethod !== 'GET' && selectedMethod !== 'DELETE' ? `,\n  body: JSON.stringify(${requestBody.replace(/\n/g, '\n  ')})` : ''}
});
const data = await res.json();
console.log(data);`;

  const pyCode = `import httpx
import os

url = "https://stratum-api.jojin1709.workers.dev${endpointUrl}"
headers = {
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
	req.Header.Set("Authorization", "Bearer "+os.Getenv("STRATUM_API_KEY"))
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, _ := client.Do(req)
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	fmt.Println(string(body))
}`;

  return (
    <>
      <PageHeader
        title="Interactive OpenAPI Documentation"
        description="Interactive API explorer and live request runner for all auto-generated PostgreSQL endpoints."
        action={
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={downloadOpenApiJson}>
              <Download className="h-3.5 w-3.5" /> Download OpenAPI 3.1 JSON
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        {/* Table Endpoints Sidebar */}
        <div className="space-y-4">
          <Panel title="Endpoints">
            <div className="p-2 border-b border-line">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" />
                <input
                  type="text"
                  placeholder="Filter resources..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 w-full rounded-lg border border-line bg-surface pl-8 pr-2 text-xs text-ink outline-none focus:border-blue-500"
                />
              </div>
            </div>
            <ul className="divide-y divide-line max-h-[65vh] overflow-y-auto">
              {filteredTables.map((t) => (
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

        {/* Documentation Content Area */}
        <div className="space-y-6 min-w-0">
          {activeTable ? (
            <>
              {/* Endpoint Card */}
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
                    <Send className="h-3 w-3" /> {testing ? 'Executing…' : 'Send Request'}
                  </Button>
                </div>

                {/* HTTP Method Switcher */}
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
                        navigator.clipboard.writeText(code);
                        setCopiedCode(true);
                        setTimeout(() => setCopiedCode(false), 2000);
                      }}
                    >
                      {copiedCode ? <Check className="h-3 w-3 text-positive" /> : <Copy className="h-3 w-3" />}
                      {copiedCode ? 'Copied' : 'Copy Code'}
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
                        Click "Send Request" above to execute this endpoint and inspect the live JSON payload.
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
            <Panel><Empty title="Select a resource endpoint to view interactive documentation." /></Panel>
          )}
        </div>
      </div>
    </>
  );
}
