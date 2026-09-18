'use client';

import { useState } from 'react';
import { Activity, BarChart3, Clock, Database, Gauge, Layers, RefreshCw, Zap, ArrowUpRight } from 'lucide-react';
import { PageHeader, SubNav } from '@/components/shell';
import { DataTable } from '@/components/data-table';
import { Button, Panel, StatusDot, Tag } from '@/components/primitives';

interface QueryStat {
  query: string;
  calls: number;
  total_time_ms: number;
  mean_time_ms: number;
  rows: number;
  status: 'optimal' | 'index_recommended' | 'slow';
}

const SAMPLE_QUERIES: QueryStat[] = [
  {
    query: 'SELECT * FROM public.users WHERE id = $1',
    calls: 14205,
    total_time_ms: 17046,
    mean_time_ms: 1.2,
    rows: 14205,
    status: 'optimal',
  },
  {
    query: 'SELECT * FROM public.orders WHERE status = $1 ORDER BY created_at DESC LIMIT 50',
    calls: 4820,
    total_time_ms: 21690,
    mean_time_ms: 4.5,
    rows: 241000,
    status: 'optimal',
  },
  {
    query: 'SELECT count(*) FROM public.logs WHERE timestamp >= $1',
    calls: 620,
    total_time_ms: 17360,
    mean_time_ms: 28.0,
    rows: 620,
    status: 'index_recommended',
  },
  {
    query: 'SELECT * FROM information_schema.tables WHERE table_schema = $1',
    calls: 1140,
    total_time_ms: 2394,
    mean_time_ms: 2.1,
    rows: 4560,
    status: 'optimal',
  },
];

export default function DatabaseAnalyticsPage() {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await new Promise((r) => setTimeout(r, 400));
    setRefreshing(false);
  };

  return (
    <>
      <PageHeader
        title="Database"
        description="Real-time execution latency metrics, Hyperdrive connection pooling, and slow query diagnostics."
        action={
          <Button size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Refresh Metrics
          </Button>
        }
      />
      <SubNav
        items={[
          { href: '/database', label: 'Tables' },
          { href: '/database/sql', label: 'SQL editor' },
          { href: '/database/migrations', label: 'Migrations' },
          { href: '/database/webhooks', label: 'Webhooks' },
          { href: '/database/policies', label: 'RLS Policies' },
          { href: '/database/analytics', label: 'Analytics' },
        ]}
      />

      {/* Metric Cards Grid */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
          <div className="flex items-center justify-between text-ink-soft">
            <span className="text-xs font-semibold uppercase tracking-wider">p50 Latency</span>
            <Gauge className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="mt-2 text-2xl font-extrabold text-ink font-mono">1.2<span className="text-sm font-normal text-ink-soft">ms</span></p>
          <span className="mt-1 inline-flex items-center gap-1 text-2xs text-positive font-medium">
            <StatusDot tone="positive" /> Edge Accelerated
          </span>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
          <div className="flex items-center justify-between text-ink-soft">
            <span className="text-xs font-semibold uppercase tracking-wider">p95 Latency</span>
            <Clock className="h-4 w-4 text-blue-500" />
          </div>
          <p className="mt-2 text-2xl font-extrabold text-ink font-mono">8.4<span className="text-sm font-normal text-ink-soft">ms</span></p>
          <span className="mt-1 inline-flex items-center gap-1 text-2xs text-positive font-medium">
            <StatusDot tone="positive" /> Sub-10ms Threshold
          </span>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
          <div className="flex items-center justify-between text-ink-soft">
            <span className="text-xs font-semibold uppercase tracking-wider">Hyperdrive Pool</span>
            <Zap className="h-4 w-4 text-amber-500" />
          </div>
          <p className="mt-2 text-2xl font-extrabold text-ink font-mono">96.8<span className="text-sm font-normal text-ink-soft">%</span></p>
          <span className="mt-1 inline-flex items-center gap-1 text-2xs text-positive font-medium">
            Connection reuse rate
          </span>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
          <div className="flex items-center justify-between text-ink-soft">
            <span className="text-xs font-semibold uppercase tracking-wider">Throughput</span>
            <Activity className="h-4 w-4 text-purple-500" />
          </div>
          <p className="mt-2 text-2xl font-extrabold text-ink font-mono">482<span className="text-sm font-normal text-ink-soft"> req/s</span></p>
          <span className="mt-1 inline-flex items-center gap-1 text-2xs text-ink-faint">
            0% dropped queries
          </span>
        </div>
      </div>

      {/* Query Performance Table */}
      <Panel title="Top Query Latency & Execution Diagnostics">
        <DataTable
          columns={[
            {
              key: 'query',
              label: 'SQL Query Template',
              render: (r) => {
                const q = r as unknown as QueryStat;
                return (
                  <code className="font-mono text-xs text-ink truncate max-w-lg block">
                    {q.query}
                  </code>
                );
              },
            },
            {
              key: 'calls',
              label: 'Executions',
              render: (r) => {
                const q = r as unknown as QueryStat;
                return <span className="font-mono text-xs text-ink-soft">{q.calls.toLocaleString()}</span>;
              },
            },
            {
              key: 'mean_time_ms',
              label: 'Avg Latency',
              align: 'right',
              render: (r) => {
                const q = r as unknown as QueryStat;
                return (
                  <span className={`font-mono text-xs font-semibold ${q.mean_time_ms > 20 ? 'text-amber-500' : 'text-positive'}`}>
                    {q.mean_time_ms.toFixed(1)}ms
                  </span>
                );
              },
            },
            {
              key: 'status',
              label: 'Diagnostic',
              align: 'right',
              render: (r) => {
                const q = r as unknown as QueryStat;
                return q.status === 'optimal' ? (
                  <Tag tone="positive">Optimal</Tag>
                ) : (
                  <Tag tone="accent">Index Recommended</Tag>
                );
              },
            },
          ]}
          rows={SAMPLE_QUERIES as unknown as Record<string, unknown>[]}
        />
      </Panel>
    </>
  );
}
