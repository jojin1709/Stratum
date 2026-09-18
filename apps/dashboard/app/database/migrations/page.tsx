'use client';

import { useApi } from '@/lib/api';
import { duration, timestamp } from '@/lib/format';
import { PageHeader, SubNav } from '@/components/shell';
import { DataTable } from '@/components/data-table';
import { ErrorNote, Panel, Spinner, StatusDot, Tag } from '@/components/primitives';

interface AppliedMigration {
  version: string;
  name: string;
  checksum: string;
  applied_at: string;
  duration_ms: number;
}

/**
 * Migrations are applied from the CLI on purpose: a dashboard button that silently
 * changes a production schema is exactly what this project set out not to build.
 * This page reports history; it never mutates.
 */
export default function MigrationsPage() {
  const { data, error, loading, reload } = useApi<{ data: AppliedMigration[] }>('/api/v1/meta/migrations');
  const rows = data?.data ?? [];

  return (
    <>
      <PageHeader title="Database" description="Migration history recorded in stratum.migrations." />
      <SubNav
        items={[
          { href: '/database', label: 'Tables' },
          { href: '/database/sql', label: 'SQL editor' },
          { href: '/database/migrations', label: 'Migrations' },
        ]}
      />

      <div className="mb-4 rounded border border-line bg-sunken p-3">
        <p className="mb-2 text-[13px] font-medium text-ink">Migrations are applied from the command line.</p>
        <pre className="font-mono text-xs leading-relaxed text-ink-soft">{`stratum db migration create add_profiles
stratum db migrate
stratum db status
stratum db rollback`}</pre>
        <p className="mt-2 max-w-2xl text-2xs text-ink-faint">
          Each migration runs in its own transaction and its checksum is recorded. Editing a migration
          that has already been applied is rejected rather than re-run, so a schema never drifts from its history.
        </p>
      </div>

      <Panel title={`Applied migrations (${rows.length})`}>
        {error ? (
          <div className="p-3">
            <ErrorNote error={error} onRetry={reload} />
          </div>
        ) : loading ? (
          <Spinner label="Reading migration history" />
        ) : (
          <DataTable
            columns={[
              {
                key: 'version',
                label: 'Version',
                render: (r) => (
                  <span className="flex items-center gap-1.5 font-mono text-xs text-ink">
                    <StatusDot tone="positive" />
                    {String(r.version)}
                  </span>
                ),
              },
              { key: 'name', label: 'Name' },
              {
                key: 'applied_at',
                label: 'Applied',
                render: (r) => <span className="nums text-xs text-ink-soft">{timestamp(String(r.applied_at))}</span>,
              },
              {
                key: 'duration_ms',
                label: 'Took',
                align: 'right',
                render: (r) => <span className="nums text-xs text-ink-soft">{duration(Number(r.duration_ms))}</span>,
              },
              {
                key: 'checksum',
                label: 'Checksum',
                render: (r) => <Tag>{String(r.checksum).slice(0, 12)}</Tag>,
              },
            ]}
            rows={rows as unknown as Record<string, unknown>[]}
            emptyLabel="No migrations applied yet. Create one with: stratum db migration create <name>"
          />
        )}
      </Panel>
    </>
  );
}
