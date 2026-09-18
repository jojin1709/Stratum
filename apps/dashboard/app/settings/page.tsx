'use client';

import { useApi } from '@/lib/api';
import { bytes, duration } from '@/lib/format';
import { PageHeader } from '@/components/shell';
import { ErrorNote, Panel, Spinner, Tag } from '@/components/primitives';

interface Overview {
  database: { tables: number; schemas: number; sizeBytes: number; version: string; latencyMs: number; pool: { total: number; idle: number; waiting: number } };
  storage: { driver: string; buckets: number; files: number; sizeBytes: number };
  realtime: { enabled: boolean; connections: number; channels: number; tables: number };
  functions: { count: number };
}

function Rows({ items }: { items: [string, string, string?][] }) {
  return (
    <dl className="divide-y divide-line text-[13px]">
      {items.map(([label, value, hint]) => (
        <div key={label} className="flex items-start justify-between gap-4 px-3 py-2">
          <div className="min-w-0">
            <dt className="text-ink">{label}</dt>
            {hint ? <p className="mt-0.5 text-2xs text-ink-faint">{hint}</p> : null}
          </div>
          <dd className="shrink-0 text-right"><Tag>{value}</Tag></dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Settings is read-only. Configuration lives in environment variables so that a
 * deployment is reproducible from its own files — a console that silently rewrote
 * live config would make that untrue.
 */
export default function SettingsPage() {
  const { data, error, loading, reload } = useApi<Overview>('/api/v1/meta/overview');

  if (error) {
    return (
      <>
        <PageHeader title="Settings" />
        <ErrorNote error={error} onRetry={reload} />
      </>
    );
  }
  if (loading || !data) {
    return (
      <>
        <PageHeader title="Settings" />
        <Panel><Spinner /></Panel>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Settings"
        description="Current configuration, read from the running services. Change these in your environment, then restart."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Database">
          <Rows
            items={[
              ['Postgres', data.database.version],
              ['Query latency', duration(data.database.latencyMs)],
              ['Connections', `${data.database.pool.total} open, ${data.database.pool.idle} idle`],
              ['Size on disk', bytes(data.database.sizeBytes)],
              ['Schemas', String(data.database.schemas), 'The reserved stratum schema is hidden from the REST API.'],
            ]}
          />
        </Panel>

        <Panel title="Storage">
          <Rows
            items={[
              ['Driver', data.storage.driver, 'STORAGE_DRIVER — local filesystem or any S3-compatible store, including Cloudflare R2.'],
              ['Buckets', String(data.storage.buckets)],
              ['Files', String(data.storage.files)],
              ['Used', bytes(data.storage.sizeBytes)],
            ]}
          />
        </Panel>

        <Panel title="Realtime">
          <Rows
            items={[
              ['Status', data.realtime.enabled ? 'enabled' : 'disabled', 'REALTIME_ENABLED'],
              ['Connections', String(data.realtime.connections)],
              ['Table feeds', String(data.realtime.tables)],
            ]}
          />
        </Panel>

        <Panel title="Environment">
          <div className="p-3">
            <p className="mb-2 text-[13px] text-ink-soft">
              Every setting is an environment variable. The full list, with defaults, is in <code className="font-mono text-xs">.env.example</code>.
            </p>
            <pre className="thin-scroll overflow-auto rounded bg-sunken p-2.5 font-mono text-xs leading-relaxed text-ink-soft">{`DATABASE_URL
STRATUM_PUBLIC_KEY
STRATUM_SECRET_KEY
STORAGE_DRIVER        local | s3
STORAGE_PATH
R2_ENDPOINT
R2_BUCKET
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
CORS_ORIGINS
RATE_LIMIT_MAX`}</pre>
          </div>
        </Panel>

        <div className="lg:col-span-2">
          <Panel title="Destructive commands">
            <div className="p-3">
              <p className="mb-2 text-[13px] text-ink-soft">
                Schema resets are command-line only, and require an explicit confirmation flag. There is no
                button here that can drop your data by accident.
              </p>
              <pre className="font-mono text-xs leading-relaxed text-critical">{`stratum db reset --yes`}</pre>
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
