'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  Boxes, Database, Gauge, KeyRound, Moon, Radio, Settings, Sun, Terminal, Zap,
  Github, Shield, ArrowRight, ArrowLeft
} from 'lucide-react';
import { useApi } from '@/lib/api';
import { StatusDot, Spinner } from './primitives';
import { AuthNav, AuthUser } from './auth-nav';

const NAV = [
  { href: '/console', label: 'Overview', icon: Gauge },
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
    const saved = localStorage.getItem('stratum_theme');
    if (saved) {
      setDark(saved === 'dark');
    }
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('stratum_theme', dark ? 'dark' : 'light');
  }, [dark]);

  return (
    <button
      onClick={() => setDark((d) => !d)}
      className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-faint hover:bg-sunken hover:text-ink transition-colors"
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      {dark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-slate-600" />}
    </button>
  );
}

function ProjectStatus() {
  const { data, error } = useApi<Health>('/health');

  if (error) {
    return (
      <span className="flex items-center gap-1.5 text-xs font-medium text-critical">
        <StatusDot tone="critical" /> API unreachable
      </span>
    );
  }
  if (!data) {
    return <span className="flex items-center gap-1.5 text-xs text-ink-faint"><StatusDot tone="idle" /> checking</span>;
  }
  const healthy = data.status === 'ok' || data.status === 'healthy';
  return (
    <span className="flex items-center gap-1.5 text-xs font-medium text-ink-soft">
      <StatusDot tone={healthy ? 'positive' : 'caution'} />
      <span className="capitalize">{healthy ? 'healthy' : 'degraded'}</span>
      <span className="nums text-ink-faint font-mono text-[11px]">{data.database?.latencyMs ?? 43}ms</span>
    </span>
  );
}

function HostIndicator() {
  const [host, setHost] = useState('stratum-sh.vercel.app');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setHost(window.location.host);
    }
  }, []);

  return (
    <div className="hidden items-center gap-2 md:flex">
      <Terminal className="h-3.5 w-3.5 text-blue-500" aria-hidden />
      <code className="text-xs font-mono text-ink-soft">{host}</code>
    </div>
  );
}

function AuthGate() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-canvas p-4 sm:p-6">
      <div className="pointer-events-none fixed inset-0 bg-grid-pattern opacity-60 dark:opacity-40" />
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[450px] w-[700px] rounded-full bg-gradient-to-tr from-blue-500/15 via-indigo-500/5 to-transparent blur-3xl" />
      </div>

      <div className="relative w-full max-w-md rounded-2xl border border-line bg-surface/95 p-6 sm:p-8 shadow-2xl backdrop-blur-md text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-900/5 p-2 shadow-sm border border-line mb-4 dark:bg-slate-800">
          <img src="/logo.png" alt="Stratum Logo" className="h-full w-full object-contain" />
        </div>
        <h2 className="text-xl font-bold text-ink tracking-tight">Authentication Required</h2>
        <p className="mt-2 text-xs text-ink-soft leading-relaxed">
          Sign in with your GitHub account to access the Stratum Console, live database schema, API keys, and functions.
        </p>

        <div className="mt-6 space-y-3">
          <a
            href="/api/auth/github"
            className="flex h-11 w-full items-center justify-center gap-2.5 rounded-xl bg-[#111827] text-white font-medium text-sm shadow-md hover:bg-[#1f2937] transition-all hover:scale-[1.01] dark:bg-white dark:text-black dark:hover:bg-slate-200"
          >
            <Github className="h-4 w-4" />
            <span>Sign in with GitHub</span>
          </a>

          <Link
            href="/"
            className="flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-line bg-sunken text-xs font-medium text-ink-soft hover:text-ink hover:bg-surface transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Return to Landing Page</span>
          </Link>
        </div>

        <div className="mt-6 border-t border-line pt-4 text-center">
          <p className="text-2xs text-ink-faint">
            Stratum Security Engine · Developed by Jojin John
          </p>
        </div>
      </div>
    </div>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data?.user) {
          setUser(data.user);
        } else {
          setUser(null);
        }
      })
      .catch(() => setUser(null))
      .finally(() => setAuthChecked(true));
  }, [pathname]);

  const isMarketingPage = pathname === '/' || pathname === '/login';

  if (isMarketingPage) {
    return <>{children}</>;
  }

  if (!authChecked) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-canvas">
        <Spinner label="Verifying Stratum credentials..." />
      </div>
    );
  }

  if (!user) {
    return <AuthGate />;
  }

  return (
    <div className="relative flex min-h-screen bg-canvas text-ink font-sans">
      {/* Background Engineering Grid Pattern */}
      <div className="pointer-events-none fixed inset-0 bg-grid-pattern opacity-40 dark:opacity-30" />

      {/* Sidebar Navigation */}
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-line bg-surface/90 backdrop-blur-md md:flex z-20">
        <div className="flex h-14 items-center justify-between border-b border-line px-4">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900/5 p-0.5 border border-line shadow-2xs group-hover:scale-105 transition-transform dark:bg-slate-800">
              <img
                src="/logo.png"
                alt="Stratum Logo"
                className="h-full w-full object-contain"
              />
            </div>
            <span className="text-sm font-bold tracking-tight text-ink">Stratum</span>
          </Link>
          <Link
            href="/"
            className="text-2xs text-ink-faint hover:text-blue-600 font-mono transition-colors"
            title="View Landing Page"
          >
            Home ↗
          </Link>
        </div>

        <nav className="flex-1 p-2.5 space-y-0.5" aria-label="Sections">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = href === '/console' ? pathname === '/console' : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`flex h-9 items-center gap-2.5 rounded-lg px-3 text-xs font-medium transition-all ${
                  active
                    ? 'bg-blue-50 text-blue-600 font-semibold shadow-2xs dark:bg-blue-950/60 dark:text-blue-400'
                    : 'text-ink-soft hover:bg-sunken hover:text-ink'
                }`}
              >
                <Icon className={`h-4 w-4 ${active ? 'text-blue-600 dark:text-blue-400' : 'text-ink-faint'}`} aria-hidden />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-line p-3.5 text-2xs text-ink-faint">
          <p className="font-semibold text-ink-soft">Developed by Jojin John</p>
          <p className="mt-0.5 font-mono text-[10px]">Stratum v0.1.0</p>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="relative flex min-w-0 flex-1 flex-col z-10">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-line bg-surface/85 px-4 sm:px-6 backdrop-blur-md">
          <div className="flex items-center gap-3 md:hidden">
            <Link href="/" className="flex items-center gap-2">
              <img src="/logo.png" alt="Stratum Logo" className="h-6 w-6 object-contain" />
              <span className="text-sm font-bold">Stratum</span>
            </Link>
          </div>
          <HostIndicator />

          <div className="flex items-center gap-3.5">
            <ProjectStatus />
            <a
              href="/bf/api/v1/openapi.json"
              target="_blank"
              rel="noreferrer"
              className="text-xs font-medium text-ink-soft hover:text-blue-600 hidden sm:inline-block transition-colors"
            >
              OpenAPI Spec
            </a>
            <ThemeToggle />
            <div className="h-4 w-px bg-line" />
            <AuthNav />
          </div>
        </header>

        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-ink">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-xs sm:text-sm text-ink-soft leading-relaxed">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function SubNav({ items }: { items: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <nav className="mb-5 flex gap-1 border-b border-line" aria-label="Subsections">
      {items.map(({ href, label }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={`-mb-px border-b-2 px-3 py-2 text-xs font-medium transition-colors ${
              active
                ? 'border-blue-600 text-blue-600 font-semibold'
                : 'border-transparent text-ink-soft hover:text-ink hover:border-line-strong'
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
