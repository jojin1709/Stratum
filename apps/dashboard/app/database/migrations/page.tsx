'use client';

import { useState } from 'react';
import { Download, Copy, Check, FileCode, Clock, ShieldCheck, Terminal, Layers, RefreshCw } from 'lucide-react';
import { useApi } from '@/lib/api';
import { duration, timestamp } from '@/lib/format';
import { PageHeader, SubNav } from '@/components/shell';
import { DataTable } from '@/components/data-table';
import { Button, ErrorNote, Panel, Spinner, StatusDot, Tag } from '@/components/primitives';

interface AppliedMigration {
  version: string;
  name: string;
  checksum: string;
  applied_at: string;
  duration_ms: number;
}

interface TableColumn {
  name: string;
  dataType: string;
  nullable: boolean;
  defaultValue: string | null;
  isPrimaryKey: boolean;
}

interface TableMeta {
  name: string;
  schema: string;
  columns: TableColumn[];
}

export default function MigrationsPage() {
  const { data, error, loading, reload } = useApi<{ data: AppliedMigration[] }>('/api/v1/meta/migrations');
  const schema = useApi<{ tables: TableMeta[] }>('/api/v1/meta/tables');
  const [copied, setCopied] = useState(false);
  const [showDdlExport, setShowDdlExport] = useState(false);

  const rows = data?.data ?? [];
  const tables = schema.data?.tables ?? [];

  // Generate complete PostgreSQL DDL from current schema metadata
  const generatedDdl = `-- =========================================================
-- Stratum Database Schema Export
-- Generated on: ${new Date().toISOString()}
-- Engine: PostgreSQL 18.6 (Cloudflare Hyperdrive Edge Pool)
-- =========================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

${tables.map((t) => {
  const cols = t.columns.map((c) => {
    let def = `  "${c.name}" ${c.dataType.toUpperCase()}`;
    if (c.isPrimaryKey) def += ' PRIMARY KEY';
    if (!c.nullable && !c.isPrimaryKey) def += ' NOT NULL';
    if (c.defaultValue) def += ` DEFAULT ${c.defaultValue}`;
    return def;
  }).join(',\n');

  return `CREATE TABLE IF NOT EXISTS "${t.schema}"."${t.name}" (\n${cols}\n);`;
}).join('\n\n')}

-- =========================================================
-- End of Schema DDL Export
-- =========================================================`;

  const copyDdl = () => {
    navigator.clipboard.writeText(generatedDdl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadDdl = () => {
    const blob = new Blob([generatedDdl], { type: 'text/sql' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `stratum-schema-${Date.now()}.sql`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHeader
        title="Database"
        description="Migration audit log recorded in stratum.migrations with live DDL export."
        action={
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => reload()}><RefreshCw className="h-3.5 w-3.5" /> Refresh</Button>
            <Button size="sm" variant="primary" onClick={() => setShowDdlExport(!showDdlExport)}>
              <FileCode className="h-3.5 w-3.5" /> {showDdlExport ? 'Hide DDL' : 'Export Schema DDL'}
            </Button>
          </div>
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

      {/* DDL Export Panel */}
      {showDdlExport && (
        <Panel
          title="PostgreSQL Schema DDL Export"
          className="mb-6"
          action={
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={copyDdl}>
                {copied ? <Check className="h-3.5 w-3.5 text-positive" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copied' : 'Copy DDL'}
              </Button>
              <Button size="sm" variant="primary" onClick={downloadDdl}>
                <Download className="h-3.5 w-3.5" /> Download .sql
              </Button>
            </div>
          }
        >
          <div className="p-4">
            <pre className="thin-scroll max-h-80 overflow-auto rounded-xl border border-line bg-sunken p-4 font-mono text-xs leading-relaxed text-ink">
              {generatedDdl}
            </pre>
          </div>
        </Panel>
      )}

      <div className="mb-4 rounded-xl border border-line bg-surface p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-2 font-semibold text-ink text-sm">
          <Terminal className="h-4 w-4 text-blue-500" />
          <span>Declarative Schema Management via CLI</span>
        </div>
        <p className="text-xs text-ink-soft mb-3">
          To maintain zero schema drift across staging and production environments, migrations are version-controlled and applied atomically via the Stratum CLI:
        </p>
        <pre className="rounded-lg bg-sunken p-3 font-mono text-xs leading-relaxed text-ink-soft">{`# 1. Generate a new versioned migration file
stratum db migration create add_customer_indexes

# 2. Apply all pending migrations in atomic transactions
stratum db migrate

# 3. Check migration verification status and checksums
stratum db status

# 4. Rollback last migration batch if needed
stratum db rollback`}</pre>
      </div>

      <Panel title={`Applied Migrations Timeline (${rows.length})`}>
        {error ? (
          <div className="p-4">
            <ErrorNote error={error} onRetry={reload} />
          </div>
        ) : loading ? (
          <Spinner label="Reading migration history from Postgres..." />
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-xs text-ink-faint">
            No migrations applied yet. Generate one with: <code className="font-mono text-ink">stratum db migration create &lt;name&gt;</code>
          </div>
        ) : (
          <DataTable
            columns={[
              {
                key: 'version',
                label: 'Version',
                render: (r) => (
                  <span className="flex items-center gap-1.5 font-mono text-xs text-ink font-semibold">
                    <StatusDot tone="positive" />
                    {String(r.version)}
                  </span>
                ),
              },
              { key: 'name', label: 'Migration Name' },
              {
                key: 'applied_at',
                label: 'Applied Timestamp',
                render: (r) => <span className="nums text-xs text-ink-soft">{timestamp(String(r.applied_at))}</span>,
              },
              {
                key: 'duration_ms',
                label: 'Execution Time',
                align: 'right',
                render: (r) => <span className="nums text-xs text-ink-soft font-mono">{duration(Number(r.duration_ms))}</span>,
              },
              {
                key: 'checksum',
                label: 'SHA256 Checksum',
                render: (r) => <Tag tone="neutral">{String(r.checksum).slice(0, 16)}</Tag>,
              },
            ]}
            rows={rows as unknown as Record<string, unknown>[]}
          />
        )}
      </Panel>
    </>
  );
}
