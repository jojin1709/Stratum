'use client';

import { useState } from 'react';
import { ShieldCheck, Plus, Trash2, Lock, Unlock, Check, Sparkles, AlertCircle, Play } from 'lucide-react';
import { useApi, api } from '@/lib/api';
import { PageHeader, SubNav } from '@/components/shell';
import { DataTable } from '@/components/data-table';
import { Button, Empty, Field, Input, Panel, StatusDot, Tag } from '@/components/primitives';

interface RlsPolicy {
  id: string;
  name: string;
  table: string;
  command: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'ALL';
  roles: string[];
  usingExpression: string;
  withCheckExpression?: string;
  enabled: boolean;
}

const INITIAL_POLICIES: RlsPolicy[] = [
  {
    id: 'pol_users_self_read',
    name: 'Allow users to read their own profile',
    table: 'users',
    command: 'SELECT',
    roles: ['authenticated'],
    usingExpression: 'auth.uid() = id',
    enabled: true,
  },
  {
    id: 'pol_users_self_update',
    name: 'Allow users to update own profile',
    table: 'users',
    command: 'UPDATE',
    roles: ['authenticated'],
    usingExpression: 'auth.uid() = id',
    withCheckExpression: 'auth.uid() = id',
    enabled: true,
  },
  {
    id: 'pol_public_read',
    name: 'Allow anonymous public read access',
    table: 'products',
    command: 'SELECT',
    roles: ['anon', 'authenticated'],
    usingExpression: 'is_active = true',
    enabled: true,
  },
];

const PRESET_TEMPLATES = [
  { label: '👤 User can read own data', expr: 'auth.uid() = user_id' },
  { label: '🌐 Public read active records', expr: 'is_active = true' },
  { label: '🏢 Multi-tenant team isolation', expr: 'team_id = (auth.jwt() ->> \'team_id\')::uuid' },
  { label: '👑 Admin full access override', expr: '(auth.jwt() ->> \'role\') = \'admin\'' },
];

export default function PoliciesPage() {
  const schema = useApi<{ tables: { name: string; schema: string }[] }>('/api/v1/meta/tables');
  const [policies, setPolicies] = useState<RlsPolicy[]>(INITIAL_POLICIES);
  const [creating, setCreating] = useState(false);

  // Policy Form State
  const [name, setName] = useState('');
  const [table, setTable] = useState('users');
  const [command, setCommand] = useState<'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'ALL'>('SELECT');
  const [role, setRole] = useState('authenticated');
  const [usingExpr, setUsingExpr] = useState('auth.uid() = user_id');

  const tables = schema.data?.tables ?? [];

  const handleCreatePolicy = () => {
    if (!name.trim() || !usingExpr.trim()) return;

    const newPol: RlsPolicy = {
      id: 'pol_' + Math.random().toString(36).substring(2, 10),
      name: name.trim(),
      table,
      command,
      roles: [role],
      usingExpression: usingExpr.trim(),
      enabled: true,
    };

    setPolicies([newPol, ...policies]);
    setCreating(false);
    setName('');
  };

  const deletePolicy = (id: string) => {
    setPolicies(policies.filter((p) => p.id !== id));
  };

  const togglePolicy = (id: string) => {
    setPolicies(policies.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p)));
  };

  return (
    <>
      <PageHeader
        title="Database"
        description="Visual Row-Level Security (RLS) policies defining granular access control rules per table."
        action={
          <Button size="sm" variant="primary" onClick={() => setCreating(true)}>
            <Plus className="h-3.5 w-3.5" /> Add RLS Policy
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

      {creating ? (
        <Panel title="Create Row-Level Security Policy" className="mb-6">
          <div className="p-4 space-y-4 max-w-2xl">
            <Field label="Policy Name" hint="Descriptive name explaining the security rule">
              <Input
                placeholder="Users can view only their own records"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Target Table">
                <select
                  value={table}
                  onChange={(e) => setTable(e.target.value)}
                  className="h-8 w-full rounded border border-line bg-surface px-2 text-xs"
                >
                  {tables.map((t) => (
                    <option key={t.name} value={t.name}>{t.name}</option>
                  ))}
                  {tables.length === 0 && <option value="users">users</option>}
                </select>
              </Field>

              <Field label="Command / Operation">
                <select
                  value={command}
                  onChange={(e) => setCommand(e.target.value as any)}
                  className="h-8 w-full rounded border border-line bg-surface px-2 text-xs font-mono font-semibold"
                >
                  {['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'ALL'].map((cmd) => (
                    <option key={cmd} value={cmd}>{cmd}</option>
                  ))}
                </select>
              </Field>

              <Field label="Target Role">
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="h-8 w-full rounded border border-line bg-surface px-2 text-xs"
                >
                  <option value="authenticated">authenticated</option>
                  <option value="anon">anon (public)</option>
                  <option value="admin">admin</option>
                </select>
              </Field>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-ink-soft">USING Expression (SQL Condition)</span>
              </div>
              <textarea
                value={usingExpr}
                onChange={(e) => setUsingExpr(e.target.value)}
                spellCheck={false}
                rows={3}
                className="thin-scroll w-full rounded-xl border border-line bg-surface p-3 font-mono text-xs text-ink outline-none focus:border-blue-500"
                placeholder="auth.uid() = user_id"
              />

              {/* Preset template chips */}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {PRESET_TEMPLATES.map((tmpl, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setUsingExpr(tmpl.expr)}
                    className="rounded-md border border-line bg-surface px-2 py-0.5 text-2xs text-ink-soft hover:border-blue-500 hover:text-ink transition-colors"
                  >
                    {tmpl.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-3 border-t border-line">
              <Button variant="primary" onClick={handleCreatePolicy} disabled={!name.trim() || !usingExpr.trim()}>
                Create Policy
              </Button>
              <Button onClick={() => setCreating(false)}>Cancel</Button>
            </div>
          </div>
        </Panel>
      ) : null}

      <div className="space-y-4">
        <Panel title={`Configured Row-Level Security Policies (${policies.length})`}>
          <ul className="divide-y divide-line">
            {policies.map((p) => (
              <li key={p.id} className="p-4 hover:bg-surface-hover/30 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <StatusDot tone={p.enabled ? 'positive' : 'idle'} />
                      <h4 className="font-semibold text-ink text-sm">{p.name}</h4>
                      <Tag tone="neutral">table:{p.table}</Tag>
                      <Tag tone="accent">{p.command}</Tag>
                    </div>
                    <pre className="mt-2 rounded-lg bg-sunken p-2 font-mono text-xs text-ink-soft max-w-2xl overflow-x-auto">
                      USING ({p.usingExpression})
                    </pre>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant={p.enabled ? 'ghost' : 'primary'}
                      onClick={() => togglePolicy(p.id)}
                    >
                      {p.enabled ? 'Disable' : 'Enable'}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => deletePolicy(p.id)} aria-label="Delete policy">
                      <Trash2 className="h-3.5 w-3.5 text-critical" />
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}
