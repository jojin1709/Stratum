'use client';

import Link from 'next/link';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApi } from '@/lib/api';
import { bytes, count, duration } from '@/lib/format';
import { PageHeader } from '@/components/shell';
import { ErrorNote, Panel, Spinner, Tag } from '@/components/primitives';

interface Overview {
  database: { tables: number; schemas: number; sizeBytes: number; version: string; latencyMs: number; pool: { total: number; idle: number; waiting: number } };
  storage: { driver: string; buckets: number; files: number; sizeBytes: number };
  api: { requests24h: number; errors24h: number; p50DurationMs: number };
  realtime: { enabled: boolean; connections: number; channels: number; tables: number };
  functions: { count: number; names: string[] };
}

interface TrafficPoint { hour: string; requests: number; errors: number; avg_ms: number }

function Metric({ label, value, unit, href, detail }: { label: string; value: string; unit?: string; href: string; detail?: string }) {
  return (
    <Link
      href={href}
      className="group flex-1 border-line px-4 py-3 transition-colors hover:bg-sunken sm:border-r sm:last:border-r-0"
    >
      <p className="text-xs text-ink-soft">{label}</p>
      <p className="nums mt-1 text-xl font-semibold tracking-tight text-ink">
        {value}
        {unit ? <span className="ml-1 text-xs font-normal text-ink-faint">{unit}</span> : null}
      </p>
      <p className="mt-0.5 text-2xs text-ink-faint">{detail ?? '\u00a0'}</p>
    </Link>
  );
}

export default function OverviewPage() {
  const overview = useApi<Overview>('/api/v1/meta/overview');
  const traffic = useApi<{ data: TrafficPoint[] }>('/logs/v1/summary');

  if (overview.error) {
    return (
      <>
        <PageHeader title="Overview" />
        <ErrorNote error={overview.error} onRetry={overview.reload} />
      </>
    );
  }
  if (!overview.data) {
    return (
      <>
        <PageHeader title="Overview" />
        <Panel><Spinner label="Reading project state" /></Panel>
      </>
    );
  }

  const o = overview.data;
  const chart = (traffic.data?.data ?? []).map((p) => ({
    hour: new Date(p.hour).getUTCHours().toString().padStart(2, '0'),
    requests: Number(p.requests),
    errors: Number(p.errors),
  }));

  return (
    <>
      <PageHeader
        title="Overview"
        description="Live project state, read from the database, storage driver and realtime server."
      />

      <div className="mb-5 flex flex-col rounded border border-line bg-surface sm:flex-row shadow-2xs">
        <Metric label="Database" value={String(o.database.tables)} unit={o.database.tables === 1 ? 'table' : 'tables'} href="/database" detail={`${bytes(o.database.sizeBytes)} across ${o.database.schemas} schema${o.database.schemas === 1 ? '' : 's'}`} />
        <Metric label="Storage" value={bytes(o.storage.sizeBytes)} href="/storage" detail={`${o.storage.files} file${o.storage.files === 1 ? '' : 's'} in ${o.storage.buckets} bucket${o.storage.buckets === 1 ? '' : 's'}`} />
        <Metric label="API" value={count(o.api.requests24h)} unit="requests" href="/api" detail={`${o.api.errors24h} error${o.api.errors24h === 1 ? '' : 's'} · p50 ${duration(o.api.p50DurationMs)}`} />
        <Metric label="Realtime" value={String(o.realtime.connections)} unit={o.realtime.connections === 1 ? 'connection' : 'connections'} href="/realtime" detail={`${o.realtime.channels} channel${o.realtime.channels === 1 ? '' : 's'} · ${o.realtime.tables} table feed${o.realtime.tables === 1 ? '' : 's'}`} />
        <Metric label="Functions" value={String(o.functions.count)} unit={o.functions.count === 1 ? 'function' : 'functions'} href="/functions" detail={o.functions.names.slice(0, 3).join(', ') || 'none yet'} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Panel title="Requests, last 24 hours">
            {chart.length === 0 ? (
              <p className="px-3 py-12 text-center text-[13px] text-ink-faint">
                No requests recorded yet. Traffic appears here as soon as the API is called.
              </p>
            ) : (
              <div className="h-56 p-3">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chart} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid stroke="var(--line)" vertical={false} />
                    <XAxis dataKey="hour" tick={{ fontSize: 11, fill: 'var(--ink-faint)' }} tickLine={false} axisLine={{ stroke: 'var(--line)' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--ink-faint)' }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--surface)', border: '1px solid var(--line)',
                        borderRadius: 6, fontSize: 12, color: 'var(--ink)',
                      }}
                      labelFormatter={(h) => `${h}:00 UTC`}
                    />
                    <Area type="monotone" dataKey="requests" stroke="var(--accent)" fill="var(--accent-soft)" strokeWidth={1.5} />
                    <Area type="monotone" dataKey="errors" stroke="var(--critical)" fill="transparent" strokeWidth={1.5} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </Panel>
        </div>

        <Panel title="System">
          <dl className="divide-y divide-line text-[13px]">
            {[
              ['Postgres', o.database.version],
              ['Query latency', duration(o.database.latencyMs)],
              ['Pool', `${o.database.pool.total - o.database.pool.idle} active / ${o.database.pool.total} open`],
              ['Storage driver', o.storage.driver],
              ['Realtime', o.realtime.enabled ? 'enabled' : 'disabled'],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-3 px-3 py-2">
                <dt className="text-ink-soft">{label}</dt>
                <dd className="truncate"><Tag>{value}</Tag></dd>
              </div>
            ))}
          </dl>
        </Panel>
      </div>
    </>
  );
}
