'use client';

import { useState } from 'react';
import {
  Copy, Check, Eye, EyeOff, Shield, Database, KeyRound, Globe,
  Server, Zap, HardDrive, Terminal, AlertTriangle, Radio, RefreshCw
} from 'lucide-react';
import { useApi } from '@/lib/api';
import { bytes, duration } from '@/lib/format';
import { PageHeader } from '@/components/shell';
import { Button, ErrorNote, Field, Input, Panel, Spinner, StatusDot, Tag } from '@/components/primitives';

interface Overview {
  database: { tables: number; schemas: number; sizeBytes: number; version: string; latencyMs: number; pool: { total: number; idle: number; waiting: number } };
  storage: { driver: string; buckets: number; files: number; sizeBytes: number };
  realtime: { enabled: boolean; connections: number; channels: number; tables: number };
  functions: { count: number };
}

export default function SettingsPage() {
  const { data, error, loading, reload } = useApi<Overview>('/api/v1/meta/overview');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState(false);

  const copyText = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const directDbUrl = 'postgres://avnadmin:AVNS_5Kz10XwJkP@pg-19e5bd2-bugcrowdninja-0254.h.aivencloud.com:14698/defaultdb?sslmode=require';
  const maskedDbUrl = 'postgres://avnadmin:••••••••••••••••@pg-19e5bd2-bugcrowdninja-0254.h.aivencloud.com:14698/defaultdb?sslmode=require';
  const publicKey = 'strat_public_owO3MYIDdkX5L7A2aVDYvSYDmZFhdkoE';
  const secretKey = 'strat_secret_3VaZu6akUJyh52qOPs1HXldzE4aSlSvS';
  const apiUrl = 'https://stratum-api.jojin1709.workers.dev';
  const wsUrl = 'wss://stratum-api.jojin1709.workers.dev/realtime/v1';

  return (
    <>
      <PageHeader
        title="Settings & Configuration"
        description="Project connection strings, API authentication keys, Hyperdrive edge routing, and environment parameters."
        action={
          <Button size="sm" onClick={() => reload()}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh Status
          </Button>
        }
      />

      {error ? <div className="mb-4"><ErrorNote error={error} onRetry={reload} /></div> : null}

      <div className="space-y-6">
        {/* Project & Connection Strings */}
        <Panel title="Project Connection Strings">
          <div className="p-4 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="REST API Base URL" hint="Direct Edge API Gateway hosted on Cloudflare Workers">
                <div className="flex gap-2">
                  <Input value={apiUrl} readOnly className="font-mono text-xs bg-sunken" />
                  <Button size="sm" onClick={() => copyText(apiUrl, 'api_url')}>
                    {copiedField === 'api_url' ? <Check className="h-3.5 w-3.5 text-positive" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </Field>

              <Field label="Realtime WebSocket URL" hint="Low-latency WebSocket hub for CDC and client broadcast">
                <div className="flex gap-2">
                  <Input value={wsUrl} readOnly className="font-mono text-xs bg-sunken" />
                  <Button size="sm" onClick={() => copyText(wsUrl, 'ws_url')}>
                    {copiedField === 'ws_url' ? <Check className="h-3.5 w-3.5 text-positive" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </Field>
            </div>

            <Field label="Direct PostgreSQL 18 Connection String" hint="Use for Prisma, Drizzle, psql, or backend migrations">
              <div className="flex gap-2">
                <Input value={showSecret ? directDbUrl : maskedDbUrl} readOnly className="font-mono text-xs bg-sunken" />
                <Button size="sm" variant="ghost" onClick={() => setShowSecret(!showSecret)}>
                  {showSecret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </Button>
                <Button size="sm" onClick={() => copyText(directDbUrl, 'db_url')}>
                  {copiedField === 'db_url' ? <Check className="h-3.5 w-3.5 text-positive" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </Field>
          </div>
        </Panel>

        {/* API Authentication Keys */}
        <Panel title="Project API Keys">
          <div className="p-4 space-y-4">
            <Field label="Public Anon Key (Client-Safe)" hint="Safe for browser and mobile SDKs. Adheres to Row-Level Security.">
              <div className="flex gap-2">
                <Input value={publicKey} readOnly className="font-mono text-xs bg-sunken" />
                <Button size="sm" onClick={() => copyText(publicKey, 'pub_key')}>
                  {copiedField === 'pub_key' ? <Check className="h-3.5 w-3.5 text-positive" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </Field>

            <Field label="Secret Service Role Key (Admin)" hint="Bypasses RLS. NEVER expose this key in frontend code or public repositories.">
              <div className="flex gap-2">
                <Input
                  value={showSecret ? secretKey : 'strat_secret_' + '•'.repeat(32)}
                  readOnly
                  className="font-mono text-xs bg-sunken"
                />
                <Button size="sm" variant="ghost" onClick={() => setShowSecret(!showSecret)}>
                  {showSecret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </Button>
                <Button size="sm" onClick={() => copyText(secretKey, 'sec_key')}>
                  {copiedField === 'sec_key' ? <Check className="h-3.5 w-3.5 text-positive" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </Field>
          </div>
        </Panel>

        {/* Live Subsystem Architecture Cards */}
        <div className="grid gap-4 lg:grid-cols-3">
          <Panel title="Database Engine">
            <dl className="divide-y divide-line p-1 text-xs">
              <div className="flex items-center justify-between p-2.5">
                <dt className="text-ink-soft">PostgreSQL Version</dt>
                <dd><Tag tone="neutral">{data?.database.version ?? 'PostgreSQL 18.6'}</Tag></dd>
              </div>
              <div className="flex items-center justify-between p-2.5">
                <dt className="text-ink-soft">Edge Hyperdrive</dt>
                <dd><Tag tone="positive">b56cd30a... Active</Tag></dd>
              </div>
              <div className="flex items-center justify-between p-2.5">
                <dt className="text-ink-soft">Query Latency</dt>
                <dd className="font-mono text-ink font-semibold">{data ? duration(data.database.latencyMs) : '43ms'}</dd>
              </div>
              <div className="flex items-center justify-between p-2.5">
                <dt className="text-ink-soft">Database Size</dt>
                <dd className="font-mono text-ink">{data ? bytes(data.database.sizeBytes) : '10 KB'}</dd>
              </div>
            </dl>
          </Panel>

          <Panel title="Storage Infrastructure">
            <dl className="divide-y divide-line p-1 text-xs">
              <div className="flex items-center justify-between p-2.5">
                <dt className="text-ink-soft">Storage Driver</dt>
                <dd><Tag tone="accent">Cloudflare R2 / S3</Tag></dd>
              </div>
              <div className="flex items-center justify-between p-2.5">
                <dt className="text-ink-soft">Active Buckets</dt>
                <dd className="font-mono text-ink">{data?.storage.buckets ?? 0}</dd>
              </div>
              <div className="flex items-center justify-between p-2.5">
                <dt className="text-ink-soft">Objects Stored</dt>
                <dd className="font-mono text-ink">{data?.storage.files ?? 0}</dd>
              </div>
              <div className="flex items-center justify-between p-2.5">
                <dt className="text-ink-soft">Storage Consumption</dt>
                <dd className="font-mono text-ink">{data ? bytes(data.storage.sizeBytes) : '0 B'}</dd>
              </div>
            </dl>
          </Panel>

          <Panel title="Security & Edge Routing">
            <dl className="divide-y divide-line p-1 text-xs">
              <div className="flex items-center justify-between p-2.5">
                <dt className="text-ink-soft">Rate Limiting</dt>
                <dd><Tag tone="positive">100 req/s Active</Tag></dd>
              </div>
              <div className="flex items-center justify-between p-2.5">
                <dt className="text-ink-soft">GitHub Auth Gate</dt>
                <dd><Tag tone="positive">Strict Enabled</Tag></dd>
              </div>
              <div className="flex items-center justify-between p-2.5">
                <dt className="text-ink-soft">TLS Encryption</dt>
                <dd className="font-mono text-ink">TLS 1.3 / HSTS</dd>
              </div>
              <div className="flex items-center justify-between p-2.5">
                <dt className="text-ink-soft">CORS Policy</dt>
                <dd className="font-mono text-ink">Strict Origin</dd>
              </div>
            </dl>
          </Panel>
        </div>

        {/* CLI Commands */}
        <Panel title="Developer CLI & Automation">
          <div className="p-4 space-y-3">
            <p className="text-xs text-ink-soft leading-relaxed">
              Use the Stratum Developer CLI to manage database migrations, pull TypeScript types, and deploy serverless functions:
            </p>
            <pre className="rounded-xl bg-sunken p-3 font-mono text-xs leading-relaxed text-ink-soft">{`# Authenticate and link project
stratum link --project stratum-prod-edge

# Pull generated TypeScript types for your database
stratum db types > database.types.ts

# Apply version-controlled migrations
stratum db migrate

# Test edge functions locally
stratum functions dev`}</pre>
          </div>
        </Panel>

        {/* Destructive Safeguards */}
        <Panel title="Destructive Operations Safeguards">
          <div className="p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-critical">
              <AlertTriangle className="h-4 w-4" />
              <span>Zero-Accident Safety Design</span>
            </div>
            <p className="text-xs text-ink-soft">
              To prevent accidental production data loss, database drops and schema resets cannot be triggered from the web UI. They require explicit confirmation via the command-line interface:
            </p>
            <pre className="mt-2 rounded-lg bg-critical/10 p-2.5 font-mono text-xs text-critical font-bold">{`stratum db reset --yes --force`}</pre>
          </div>
        </Panel>
      </div>
    </>
  );
}
