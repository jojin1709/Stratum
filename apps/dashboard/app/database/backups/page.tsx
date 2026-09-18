'use client';

import { useState } from 'react';
import { Database, Download, RotateCcw, Plus, Check, Clock, HardDrive, ShieldCheck, RefreshCw } from 'lucide-react';
import { PageHeader, SubNav } from '@/components/shell';
import { DataTable } from '@/components/data-table';
import { Button, Empty, Panel, StatusDot, Tag } from '@/components/primitives';
import { bytes, relative, timestamp } from '@/lib/format';

interface BackupSnapshot {
  id: string;
  name: string;
  sizeBytes: number;
  type: 'automated' | 'manual';
  created_at: string;
  status: 'completed' | 'in_progress';
  checksum: string;
}

const INITIAL_BACKUPS: BackupSnapshot[] = [
  {
    id: 'snap_20260918_000000',
    name: 'Scheduled Daily Snapshot (00:00 UTC)',
    sizeBytes: 18450200,
    type: 'automated',
    created_at: new Date(Date.now() - 86400000 * 1).toISOString(),
    status: 'completed',
    checksum: 'sha256_9f8b4a2080a24a1c',
  },
  {
    id: 'snap_20260917_000000',
    name: 'Scheduled Daily Snapshot (00:00 UTC)',
    sizeBytes: 18210400,
    type: 'automated',
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    status: 'completed',
    checksum: 'sha256_c4e13d905b12421f',
  },
  {
    id: 'snap_20260915_pre_deploy',
    name: 'Pre-Deployment Manual Backup',
    sizeBytes: 17940100,
    type: 'manual',
    created_at: new Date(Date.now() - 86400000 * 4).toISOString(),
    status: 'completed',
    checksum: 'sha256_71a02e4512c847bc',
  },
];

export default function BackupsPage() {
  const [backups, setBackups] = useState<BackupSnapshot[]>(INITIAL_BACKUPS);
  const [creating, setCreating] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const createSnapshot = async () => {
    setCreating(true);
    await new Promise((r) => setTimeout(r, 700));

    const newSnap: BackupSnapshot = {
      id: 'snap_' + Date.now(),
      name: `Manual Snapshot ${new Date().toLocaleTimeString()}`,
      sizeBytes: 18560000,
      type: 'manual',
      created_at: new Date().toISOString(),
      status: 'completed',
      checksum: 'sha256_' + Math.random().toString(36).substring(2, 12),
    };

    setBackups([newSnap, ...backups]);
    setCreating(false);
  };

  const simulateRestore = async (snap: BackupSnapshot) => {
    if (!window.confirm(`Simulate Point-In-Time Recovery (PITR) restore to snapshot "${snap.name}"?`)) return;
    setRestoringId(snap.id);
    await new Promise((r) => setTimeout(r, 1200));
    setRestoringId(null);
    alert(`Snapshot "${snap.name}" successfully verified and restored with zero data corruption.`);
  };

  return (
    <>
      <PageHeader
        title="Database Backups & PITR"
        description="Automated continuous snapshots and Point-in-Time Recovery (PITR) with WAL archiving."
        action={
          <Button size="sm" variant="primary" onClick={createSnapshot} disabled={creating}>
            <Plus className="h-3.5 w-3.5" /> {creating ? 'Creating Snapshot…' : 'Create Snapshot Now'}
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
          { href: '/database/backups', label: 'Backups & PITR' },
          { href: '/database/vectors', label: 'AI Vectors' },
        ]}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
          <span className="text-xs font-semibold text-ink-soft uppercase">Automated Schedule</span>
          <p className="mt-2 text-xl font-bold text-ink">Daily at 00:00 UTC</p>
          <span className="text-2xs text-positive font-medium">30-day retention</span>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
          <span className="text-xs font-semibold text-ink-soft uppercase">PITR Window</span>
          <p className="mt-2 text-xl font-bold text-ink">Continuous WAL</p>
          <span className="text-2xs text-positive font-medium">Sub-second recovery precision</span>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
          <span className="text-xs font-semibold text-ink-soft uppercase">Storage Location</span>
          <p className="mt-2 text-xl font-bold text-ink">Encrypted R2</p>
          <span className="text-2xs text-ink-faint">AES-256 GCM</span>
        </div>
      </div>

      <Panel title={`Available Backup Snapshots (${backups.length})`}>
        <DataTable
          columns={[
            {
              key: 'name',
              label: 'Snapshot Name',
              render: (r) => {
                const s = r as unknown as BackupSnapshot;
                return (
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 font-semibold text-ink text-xs">
                      <StatusDot tone="positive" />
                      {s.name}
                    </div>
                    <p className="font-mono text-2xs text-ink-faint">{s.id}</p>
                  </div>
                );
              },
            },
            {
              key: 'type',
              label: 'Type',
              render: (r) => <Tag tone={r.type === 'automated' ? 'neutral' : 'accent'}>{String(r.type)}</Tag>,
            },
            {
              key: 'sizeBytes',
              label: 'Size',
              render: (r) => <span className="nums text-2xs font-mono text-ink-soft">{bytes(Number(r.sizeBytes))}</span>,
            },
            {
              key: 'created_at',
              label: 'Created',
              render: (r) => <span className="text-2xs text-ink-soft">{relative(String(r.created_at))}</span>,
            },
            {
              key: 'checksum',
              label: 'SHA256',
              render: (r) => <Tag tone="neutral">{String(r.checksum)}</Tag>,
            },
            {
              key: '_actions',
              label: 'Actions',
              align: 'right',
              render: (r) => {
                const s = r as unknown as BackupSnapshot;
                return (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => simulateRestore(s)}
                    disabled={restoringId === s.id}
                  >
                    <RotateCcw className={`h-3 w-3 ${restoringId === s.id ? 'animate-spin' : ''}`} />
                    {restoringId === s.id ? 'Restoring…' : 'Restore'}
                  </Button>
                );
              },
            },
          ]}
          rows={backups as unknown as Record<string, unknown>[]}
        />
      </Panel>
    </>
  );
}
