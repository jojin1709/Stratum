'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  Boxes, Database, Gauge, KeyRound, Moon, Radio, Settings, Sun, Terminal, Zap,
} from 'lucide-react';
import { useApi } from '@/lib/api';
import { StatusDot } from './primitives';

const NAV = [
  { href: '/', label: 'Overview', icon: Gauge },
  { href: '/database', label: 'Database', icon: Database },
  { href: '/api', label: 'API', icon: KeyRound },
  { href: '/storage', label: 'Storage', icon: Boxes },
  { href: '/realtime', label: 'Realtime', icon: Radio },
  { href: '/functions', label: 'Functions', icon: Zap },
  { href: '/settings', label: 'Settings', icon: Settings },
];

interface Health {
  status: string;
  version: string;
  database: { connected: boolean; latencyMs: number };
}

function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const prefers = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setDark(prefers);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  return (
    <button
      onClick={() => setDark((d) => !d)}
      className="flex h-7 w-7 items-center justify-center rounded text-ink-faint hover:bg-sunken hover:text-ink"
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      {dark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
    </button>
  );
}

function ProjectStatus() {
  const { data, error } = useApi<Health>('/health');

  // Reachability is the one thing the chrome must always be honest about: if the API is
  // down, every screen below is empty for a reason the user needs to see immediately.
  if (error) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-critical">
        <StatusDot tone="critical" /> API unreachable
      </span>
    );
  }
  if (!data) {
    return <span className="flex items-center gap-1.5 text-xs text-ink-faint"><StatusDot tone="idle" /> checking</span>;
  }
  const healthy = data.status === 'ok';
  return (
    <span className="flex items-center gap-1.5 text-xs text-ink-soft">
      <StatusDot tone={healthy ? 'positive' : 'caution'} />
      {healthy ? 'healthy' : 'degraded'}
      <span className="nums text-ink-faint">{data.database.latencyMs}ms</span>
    </span>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-52 shrink-0 flex-col border-r border-line bg-surface md:flex">
        <div className="flex h-12 items-center gap-2 border-b border-line px-3">
          <span className="flex h-5 w-5 items-center justify-center rounded-sm bg-accent text-[11px] font-bold text-white">
            S
          </span>
          <span className="text-[13px] font-semibold tracking-tight">Stratum</span>
        </div>

        <nav className="flex-1 p-2" aria-label="Sections">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`mb-0.5 flex h-8 items-center gap-2 rounded px-2 text-[13px] transition-colors ${
                  active ? 'bg-accent-soft font-medium text-accent' : 'text-ink-soft hover:bg-sunken hover:text-ink'
                }`}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-line p-3 text-2xs text-ink-faint">
          <p className="font-medium text-ink-soft">Developed by Jojin John</p>
          <p className="mt-0.5 font-mono">Stratum v0.1.0</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-12 items-center justify-between gap-4 border-b border-line bg-surface/90 px-4 backdrop-blur">
          <div className="flex items-center gap-3 md:hidden">
            <span className="text-[13px] font-semibold">Stratum</span>
          </div>
          <div className="hidden items-center gap-2 md:flex">
            <Terminal className="h-3.5 w-3.5 text-ink-faint" aria-hidden />
            <code className="text-xs text-ink-soft">localhost:8787</code>
          </div>
          <div className="flex items-center gap-4">
            <ProjectStatus />
            <a
              href="/bf/api/v1/openapi.json"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-ink-soft hover:text-accent"
            >
              OpenAPI
            </a>
            <ThemeToggle />
          </div>
        </header>

        <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-ink">{title}</h1>
        {description ? <p className="mt-0.5 max-w-xl text-[13px] text-ink-soft">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function SubNav({ items }: { items: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <nav className="mb-4 flex gap-1 border-b border-line" aria-label="Subsections">
      {items.map(({ href, label }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={`-mb-px border-b-2 px-2.5 py-1.5 text-[13px] transition-colors ${
              active ? 'border-accent font-medium text-ink' : 'border-transparent text-ink-soft hover:text-ink'
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
