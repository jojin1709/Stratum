'use client';

import { useState } from 'react';
import {
  Users, UserPlus, Key, ShieldCheck, Mail, Lock, Check, Copy, Trash2,
  Ban, Shield, RefreshCw, Smartphone, Globe, ExternalLink, Sliders
} from 'lucide-react';
import { PageHeader } from '@/components/shell';
import { DataTable } from '@/components/data-table';
import { Button, Empty, Field, Input, Panel, StatusDot, Tag } from '@/components/primitives';
import { relative, timestamp } from '@/lib/format';

interface UserRecord {
  id: string;
  email: string;
  provider: 'github' | 'google' | 'email' | 'apple' | 'discord';
  created_at: string;
  last_sign_in_at: string | null;
  status: 'active' | 'suspended';
  role: string;
}

interface ProviderConfig {
  id: string;
  name: string;
  enabled: boolean;
  clientId: string;
  clientSecret: string;
}

const INITIAL_USERS: UserRecord[] = [
  {
    id: 'usr_9f8b4a20-80a2-4a1c-8e4d-90c746d0a312',
    email: 'jojin@stratum.sh',
    provider: 'github',
    created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
    last_sign_in_at: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    status: 'active',
    role: 'super_admin',
  },
  {
    id: 'usr_c4e13d90-5b12-421f-829d-128d940e7199',
    email: 'alex.developer@example.com',
    provider: 'google',
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    last_sign_in_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    status: 'active',
    role: 'developer',
  },
  {
    id: 'usr_71a02e45-12c8-47bc-910a-394bf19920aa',
    email: 'sarah.engineer@company.io',
    provider: 'email',
    created_at: new Date(Date.now() - 86400000 * 1).toISOString(),
    last_sign_in_at: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    status: 'active',
    role: 'member',
  },
];

const INITIAL_PROVIDERS: ProviderConfig[] = [
  { id: 'github', name: 'GitHub OAuth', enabled: true, clientId: 'Ov23liD6A1DVbOLcWAYB', clientSecret: '••••••••••••••••' },
  { id: 'google', name: 'Google OAuth', enabled: true, clientId: '8492048190-apps.googleusercontent.com', clientSecret: '••••••••••••••••' },
  { id: 'email', name: 'Email Passwordless (Magic Link)', enabled: true, clientId: 'Built-in SMTP', clientSecret: 'Configured' },
  { id: 'apple', name: 'Apple Sign-In', enabled: false, clientId: '', clientSecret: '' },
  { id: 'discord', name: 'Discord OAuth', enabled: false, clientId: '', clientSecret: '' },
];

export default function AuthUsersPage() {
  const [activeTab, setActiveTab] = useState<'users' | 'providers'>('users');
  const [users, setUsers] = useState<UserRecord[]>(INITIAL_USERS);
  const [providers, setProviders] = useState<ProviderConfig[]>(INITIAL_PROVIDERS);
  const [searchQuery, setSearchQuery] = useState('');
  const [creatingUser, setCreatingUser] = useState(false);

  // New user form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('member');

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    const newUser: UserRecord = {
      id: 'usr_' + Math.random().toString(36).substring(2, 15) + '-' + Math.random().toString(36).substring(2, 10),
      email: email.trim(),
      provider: 'email',
      created_at: new Date().toISOString(),
      last_sign_in_at: null,
      status: 'active',
      role,
    };

    setUsers([newUser, ...users]);
    setCreatingUser(false);
    setEmail('');
    setPassword('');
  };

  const toggleUserStatus = (id: string) => {
    setUsers(
      users.map((u) =>
        u.id === id ? { ...u, status: u.status === 'active' ? 'suspended' : 'active' } : u
      )
    );
  };

  const deleteUser = (id: string) => {
    if (!window.confirm('Permanently delete this user and revoke all active auth sessions?')) return;
    setUsers(users.filter((u) => u.id !== id));
  };

  const toggleProvider = (id: string) => {
    setProviders(
      providers.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p))
    );
  };

  const filteredUsers = users.filter((u) =>
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <PageHeader
        title="Authentication & Users"
        description="Manage registered user accounts, auth sessions, and OAuth identity providers."
        action={
          <Button size="sm" variant="primary" onClick={() => setCreatingUser(true)}>
            <UserPlus className="h-3.5 w-3.5" /> Create User
          </Button>
        }
      />

      {/* Tabs */}
      <div className="mb-6 flex items-center gap-2 border-b border-line pb-3">
        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors ${
            activeTab === 'users' ? 'bg-blue-600 text-white shadow-xs' : 'text-ink-soft hover:text-ink'
          }`}
        >
          <Users className="h-3.5 w-3.5" /> Users Directory ({users.length})
        </button>
        <button
          onClick={() => setActiveTab('providers')}
          className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors ${
            activeTab === 'providers' ? 'bg-blue-600 text-white shadow-xs' : 'text-ink-soft hover:text-ink'
          }`}
        >
          <Sliders className="h-3.5 w-3.5" /> Auth Providers & OAuth
        </button>
      </div>

      {creatingUser ? (
        <Panel title="Create New User Account" className="mb-6">
          <form onSubmit={handleCreateUser} className="p-4 space-y-4 max-w-md">
            <Field label="Email Address">
              <Input
                type="email"
                placeholder="user@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
                required
              />
            </Field>
            <Field label="Initial Password" hint="Leave blank to send a magic sign-in link">
              <Input
                type="password"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            <Field label="Role">
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="h-8 w-full rounded border border-line bg-surface px-2.5 text-[13px] text-ink"
              >
                <option value="member">member</option>
                <option value="developer">developer</option>
                <option value="admin">admin</option>
              </select>
            </Field>
            <div className="flex gap-2 pt-2 border-t border-line">
              <Button type="submit" variant="primary">Create User</Button>
              <Button type="button" onClick={() => setCreatingUser(false)}>Cancel</Button>
            </div>
          </form>
        </Panel>
      ) : null}

      {activeTab === 'users' ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Input
                placeholder="Search users by email or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>

          <Panel title={`Users (${filteredUsers.length})`}>
            <DataTable
              columns={[
                {
                  key: 'email',
                  label: 'User / Email',
                  render: (r) => {
                    const u = r as unknown as UserRecord;
                    return (
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 font-semibold text-ink text-xs">
                          <StatusDot tone={u.status === 'active' ? 'positive' : 'critical'} />
                          {u.email}
                        </div>
                        <p className="font-mono text-2xs text-ink-faint">{u.id}</p>
                      </div>
                    );
                  },
                },
                {
                  key: 'provider',
                  label: 'Provider',
                  render: (r) => {
                    const u = r as unknown as UserRecord;
                    return <Tag tone="accent">{u.provider}</Tag>;
                  },
                },
                {
                  key: 'role',
                  label: 'Role',
                  render: (r) => {
                    const u = r as unknown as UserRecord;
                    return <Tag tone="neutral">{u.role}</Tag>;
                  },
                },
                {
                  key: 'created_at',
                  label: 'Created',
                  render: (r) => {
                    const u = r as unknown as UserRecord;
                    return <span className="text-2xs text-ink-soft">{relative(u.created_at)}</span>;
                  },
                },
                {
                  key: 'last_sign_in_at',
                  label: 'Last Sign In',
                  render: (r) => {
                    const u = r as unknown as UserRecord;
                    return (
                      <span className="text-2xs text-ink-soft">
                        {u.last_sign_in_at ? relative(u.last_sign_in_at) : 'Never'}
                      </span>
                    );
                  },
                },
                {
                  key: '_actions',
                  label: 'Actions',
                  align: 'right',
                  render: (r) => {
                    const u = r as unknown as UserRecord;
                    return (
                      <div className="flex items-center gap-1.5 justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => toggleUserStatus(u.id)}
                          title={u.status === 'active' ? 'Suspend User' : 'Activate User'}
                        >
                          <Ban className={`h-3 w-3 ${u.status === 'suspended' ? 'text-positive' : 'text-amber-500'}`} />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteUser(u.id)}
                          title="Delete User"
                        >
                          <Trash2 className="h-3 w-3 text-critical" />
                        </Button>
                      </div>
                    );
                  },
                },
              ]}
              rows={filteredUsers as unknown as Record<string, unknown>[]}
              emptyLabel="No users found matching your search."
            />
          </Panel>
        </div>
      ) : (
        /* Providers Tab */
        <div className="space-y-4">
          <Panel title="Identity & OAuth Providers">
            <ul className="divide-y divide-line">
              {providers.map((p) => (
                <li key={p.id} className="p-4 flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <StatusDot tone={p.enabled ? 'positive' : 'idle'} />
                      <h4 className="font-semibold text-ink text-sm">{p.name}</h4>
                      <Tag tone={p.enabled ? 'positive' : 'neutral'}>
                        {p.enabled ? 'Enabled' : 'Disabled'}
                      </Tag>
                    </div>
                    {p.clientId ? (
                      <p className="font-mono text-2xs text-ink-faint">Client ID: {p.clientId}</p>
                    ) : (
                      <p className="text-2xs text-ink-faint">Not configured yet</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant={p.enabled ? 'ghost' : 'primary'}
                      onClick={() => toggleProvider(p.id)}
                    >
                      {p.enabled ? 'Disable' : 'Enable'}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      )}
    </>
  );
}
