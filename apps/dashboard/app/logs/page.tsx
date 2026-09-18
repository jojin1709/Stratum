'use client';

import { useState } from 'react';
import { ScrollText, Search, ShieldCheck, RefreshCw, AlertCircle, CheckCircle2, User, Key, Database, Globe } from 'lucide-react';
import { PageHeader } from '@/components/shell';
import { DataTable } from '@/components/data-table';
import { Button, Field, Input, Panel, StatusDot, Tag } from '@/components/primitives';
import { relative, timestamp } from '@/lib/format';

interface AuditLog {
  id: string;
  event: string;
  category: 'AUTH' | 'DATABASE' | 'STORAGE' | 'WEBHOOK' | 'SECURITY';
  actor: string;
  ip: string;
  userAgent: string;
  status: 'SUCCESS' | 'WARNING' | 'CRITICAL';
  created_at: string;
  metadata: Record<string, unknown>;
}

const INITIAL_LOGS: AuditLog[] = [
  {
    id: 'aud_8402910a',
    event: 'API_KEY_PROVISIONED',
    category: 'SECURITY',
    actor: 'jojin1709 (Owner)',
    ip: '192.168.18.65',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    status: 'SUCCESS',
    created_at: new Date(Date.now() - 1000 * 45).toISOString(),
    metadata: { key_role: 'secret', label: 'Production Server Backend' },
  },
  {
    id: 'aud_8402908f',
    event: 'TABLE_ROW_INSERTED',
    category: 'DATABASE',
    actor: 'Console User',
    ip: '192.168.18.65',
    userAgent: 'Stratum-Dashboard/1.0',
    status: 'SUCCESS',
    created_at: new Date(Date.now() - 1000 * 60 * 4).toISOString(),
    metadata: { table: 'users', primary_key: '9f8b4a20-80a2' },
  },
  {
    id: 'aud_8402891b',
    event: 'WEBHOOK_EVENT_DISPATCHED',
    category: 'WEBHOOK',
    actor: 'Event System',
    ip: '104.21.48.102',
    userAgent: 'Cloudflare-Worker/Edge',
    status: 'SUCCESS',
    created_at: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    metadata: { target_url: 'https://api.myapp.com/webhooks/stratum', status_code: 200 },
  },
  {
    id: 'aud_8402874e',
    event: 'GITHUB_OAUTH_SESSION_AUTHENTICATED',
    category: 'AUTH',
    actor: 'jojin1709',
    ip: '192.168.18.65',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    status: 'SUCCESS',
    created_at: new Date(Date.now() - 1000 * 60 * 65).toISOString(),
    metadata: { provider: 'github', user_id: '197761551' },
  },
];

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>(INITIAL_LOGS);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  const filteredLogs = logs.filter((l) => {
    const matchesCat = selectedCategory === 'ALL' || l.category === selectedCategory;
    const matchesSearch =
      l.event.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.actor.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.ip.includes(searchQuery);
    return matchesCat && matchesSearch;
  });

  return (
    <>
      <PageHeader
        title="Audit & Security Logs"
        description="Immutable real-time audit trail of all platform mutations, security events, and authentication sessions."
        action={
          <Button size="sm" onClick={() => {}}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        }
      />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 rounded-lg border border-line bg-surface p-1">
          {['ALL', 'SECURITY', 'DATABASE', 'AUTH', 'WEBHOOK'].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                selectedCategory === cat
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-ink-soft hover:text-ink'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="relative">
          <Input
            placeholder="Search logs by event, actor, IP..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-64 text-xs"
          />
        </div>
      </div>

      <Panel title={`Audit Events (${filteredLogs.length})`}>
        <DataTable
          columns={[
            {
              key: 'event',
              label: 'Event & Actor',
              render: (r) => {
                const l = r as unknown as AuditLog;
                return (
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 font-mono text-xs font-bold text-ink">
                      <StatusDot tone={l.status === 'SUCCESS' ? 'positive' : 'caution'} />
                      {l.event}
                    </div>
                    <p className="text-2xs text-ink-soft flex items-center gap-1">
                      <User className="h-3 w-3 text-ink-faint" /> {l.actor}
                    </p>
                  </div>
                );
              },
            },
            {
              key: 'category',
              label: 'Category',
              render: (r) => <Tag tone="accent">{String(r.category)}</Tag>,
            },
            {
              key: 'ip',
              label: 'IP & Origin',
              render: (r) => {
                const l = r as unknown as AuditLog;
                return (
                  <div className="space-y-0.5 font-mono text-2xs text-ink-soft">
                    <p>{l.ip}</p>
                    <p className="text-ink-faint truncate max-w-xs">{l.userAgent}</p>
                  </div>
                );
              },
            },
            {
              key: 'created_at',
              label: 'Timestamp',
              render: (r) => <span className="text-2xs text-ink-soft">{relative(String(r.created_at))}</span>,
            },
            {
              key: 'metadata',
              label: 'Event Metadata',
              render: (r) => {
                const l = r as unknown as AuditLog;
                return (
                  <code className="font-mono text-2xs text-ink-soft bg-sunken p-1 rounded block truncate max-w-xs">
                    {JSON.stringify(l.metadata)}
                  </code>
                );
              },
            },
          ]}
          rows={filteredLogs as unknown as Record<string, unknown>[]}
          emptyLabel="No audit events matching current criteria."
        />
      </Panel>
    </>
  );
}
