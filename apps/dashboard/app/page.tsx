'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Database, Zap, Boxes, Radio, KeyRound, Shield, Terminal, ArrowRight,
  Github, CheckCircle2, Cpu, Globe, Server, Layers, Code2, Sparkles,
  ExternalLink, ChevronRight, Activity, Copy, Check, BarChart3, Cloud, FileCode2
} from 'lucide-react';

interface AuthUser {
  login: string;
  name: string;
  avatar_url: string;
  html_url: string;
}

export default function LandingPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [activeTab, setActiveTab] = useState<'ts' | 'curl' | 'py' | 'realtime'>('ts');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data?.user) setUser(data.user);
      })
      .catch(() => {});
  }, []);

  const copyCode = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const codeSnippetsRaw = {
    ts: `import { createClient } from '@stratum/sdk';

// Initialize with your Stratum edge endpoint
const stratum = createClient({
  url: 'https://stratum-api.jojin1709.workers.dev',
  apiKey: process.env.STRATUM_PUBLIC_KEY,
});

// Query PostgreSQL with sub-50ms Hyperdrive latency
const { data: users, error } = await stratum
  .from('users')
  .select('id, name, email, created_at')
  .order('created_at', { ascending: false })
  .limit(10);

console.log('Fetched users:', users);`,
    curl: `# Instant auto-generated REST API with OpenAPI 3.1
curl -X GET "https://stratum-api.jojin1709.workers.dev/api/v1/meta/tables" \\
  -H "apikey: strat_secret_3VaZu6akUJyh52qOPs1HXldzE4aSlSvS" \\
  -H "Content-Type: application/json"

# Response: 200 OK (~43ms)
# [{"name":"users","schema":"public","columns":4,"rowCount":120}]`,
    py: `from stratum import StratumClient

# Connect to Stratum Edge Backend
client = StratumClient(
    api_url="https://stratum-api.jojin1709.workers.dev",
    api_key="strat_secret_3VaZu6akUJyh52qOPs1HXldzE4aSlSvS"
)

# Insert new record into PostgreSQL
record = client.table("projects").insert({
    "name": "AI Agent Orchestrator",
    "status": "active",
    "author": "Jojin John"
})

print("Created project:", record)`,
    realtime: `// Subscribe to live PostgreSQL Change Data Capture (CDC)
const subscription = stratum
  .channel('public:orders')
  .on('INSERT', (payload) => {
    console.log('New order received in realtime:', payload.new);
  })
  .subscribe();`
  };

  return (
    <div className="relative min-h-screen bg-canvas text-ink selection:bg-accent-soft selection:text-accent font-sans overflow-x-hidden">
      {/* Background Engineering Grid Pattern */}
      <div className="pointer-events-none fixed inset-0 bg-grid-pattern opacity-60 dark:opacity-40" />

      {/* Ambient Glowing Gradients */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[550px] w-[900px] rounded-full bg-gradient-to-b from-blue-400/15 via-indigo-300/10 to-transparent blur-3xl animate-pulse-glow" />
        <div className="absolute top-[500px] -left-48 h-[450px] w-[550px] rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="absolute top-[900px] -right-48 h-[550px] w-[650px] rounded-full bg-blue-500/10 blur-3xl" />
      </div>

      {/* Top Sticky Navigation */}
      <header className="sticky top-0 z-50 border-b border-line/70 bg-surface/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900/5 p-1 border border-line shadow-2xs group-hover:scale-105 transition-transform dark:bg-slate-800">
                <img src="/logo.png" alt="Stratum Logo" className="h-full w-full object-contain" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold tracking-tight text-ink">Stratum</span>
                <span className="inline-flex rounded-full border border-line bg-sunken px-2.5 py-0.5 text-[11px] font-mono text-ink-soft">
                  v0.1.0 • by Jojin John
                </span>
              </div>
            </Link>
          </div>

          <nav className="hidden md:flex items-center gap-7 text-xs font-medium text-ink-soft">
            <a href="#features" className="hover:text-ink transition-colors">Features</a>
            <a href="#architecture" className="hover:text-ink transition-colors">Architecture</a>
            <a href="#code" className="hover:text-ink transition-colors">Code & SDK</a>
            <a href="#creator" className="hover:text-ink transition-colors">Creator</a>
            <a
              href="https://github.com/jojin1709/Stratum"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 hover:text-ink transition-colors"
            >
              <Github className="h-3.5 w-3.5" />
              <span>GitHub</span>
            </a>
          </nav>

          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-3">
                <Link
                  href="/console"
                  className="flex h-9 items-center gap-1.5 rounded-full bg-[#1e5eff] px-4 text-xs font-medium text-white shadow-sm hover:bg-[#194ecc] transition-all hover:scale-[1.02]"
                >
                  <span>Launch Console</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                <Link href="/console" className="flex items-center gap-2">
                  <img
                    src={user.avatar_url || 'https://avatars.githubusercontent.com/u/197761551?v=4'}
                    alt={user.login}
                    className="h-8 w-8 rounded-full border border-line shadow-xs object-cover"
                  />
                </Link>
              </div>
            ) : (
              <a
                href="/api/auth/github"
                className="flex h-9 items-center gap-2 rounded-full bg-[#111827] px-4 text-xs font-medium text-white shadow-sm hover:bg-[#1f2937] transition-all hover:scale-[1.02]"
              >
                <Github className="h-3.5 w-3.5" />
                <span>Sign in with GitHub</span>
              </a>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section with Floating 3D Elements & Animated Waves */}
      <section className="relative pt-12 pb-20 sm:pt-20 sm:pb-28 overflow-hidden">
        {/* SVG Decorative Wave Lines */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-40 dark:opacity-20 overflow-hidden">
          <svg className="w-full max-w-7xl h-[600px]" viewBox="0 0 1200 600" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M 50,300 C 300,200 400,450 600,320 C 800,190 900,420 1150,280"
              stroke="url(#gradient-line-1)"
              strokeWidth="1.5"
              className="animate-wave-line"
            />
            <path
              d="M 50,340 C 250,450 450,180 600,300 C 750,420 950,160 1150,320"
              stroke="url(#gradient-line-2)"
              strokeWidth="1.5"
              className="animate-wave-line"
            />
            <defs>
              <linearGradient id="gradient-line-1" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.1" />
                <stop offset="50%" stopColor="#2563eb" stopOpacity="0.7" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.1" />
              </linearGradient>
              <linearGradient id="gradient-line-2" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.1" />
                <stop offset="50%" stopColor="#6366f1" stopOpacity="0.7" />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.1" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* LEFT FLOATING 3D GLASS ELEMENTS */}
        <div className="hidden xl:block pointer-events-none absolute left-6 2xl:left-16 top-24 z-10">
          <div className="relative animate-float-slow">
            <div className="w-48 rounded-2xl border border-white/60 bg-gradient-to-b from-white/90 to-blue-50/70 p-5 shadow-2xl backdrop-blur-lg dark:border-slate-700/60 dark:from-slate-800/90 dark:to-slate-900/80">
              <div className="flex items-center justify-between mb-3">
                <div className="h-8 w-8 rounded-lg bg-blue-500/15 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <Database className="h-4 w-4" />
                </div>
                <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
              </div>
              <p className="text-xs font-bold text-ink">PostgreSQL 18.6</p>
              <p className="text-[11px] text-ink-soft mt-1">Live Database Engine</p>
              <div className="mt-3 rounded bg-blue-500/10 px-2 py-1 text-[10px] font-mono text-blue-600 dark:text-blue-400">
                ⚡ Hyperdrive Active
              </div>
            </div>

            <div className="absolute -top-10 right-2 animate-float-fast">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/80 bg-white/90 text-blue-600 shadow-xl backdrop-blur-md dark:border-slate-700 dark:bg-slate-800 dark:text-blue-400">
                <Zap className="h-5 w-5 fill-current" />
              </div>
            </div>

            <div className="absolute -bottom-16 left-6 animate-float-reverse">
              <div className="flex items-center gap-2 rounded-xl border border-white/80 bg-white/95 px-3 py-2 text-xs font-semibold text-ink shadow-xl backdrop-blur-md dark:border-slate-700 dark:bg-slate-800">
                <BarChart3 className="h-4 w-4 text-emerald-500" />
                <span className="text-[11px]">43ms Latency</span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT FLOATING TRANSLUCENT CODE CARD & BADGES */}
        <div className="hidden xl:block pointer-events-none absolute right-6 2xl:right-16 top-20 z-10">
          <div className="relative animate-float-slow">
            <div className="w-64 rounded-2xl border border-white/70 bg-gradient-to-b from-white/95 to-slate-50/80 p-5 shadow-2xl backdrop-blur-xl dark:border-slate-700/60 dark:from-slate-800/90 dark:to-slate-900/80">
              <div className="flex items-center gap-1.5 mb-3 border-b border-line pb-2">
                <FileCode2 className="h-3.5 w-3.5 text-blue-500" />
                <span className="text-[11px] font-mono text-ink-faint">client.ts</span>
              </div>
              <pre className="font-mono text-[11px] leading-relaxed text-ink-soft">
                <span className="text-blue-500 font-semibold">// Instant API</span>{'\n'}
                <span className="text-purple-600 font-semibold">const</span> db = <span className="text-purple-600 font-semibold">new</span> Stratum(){'\n'}
                <span className="text-purple-600 font-semibold">await</span> db.table(<span className="text-emerald-600">&apos;users&apos;</span>){'\n'}
                {'  '}.select(<span className="text-emerald-600">&apos;*&apos;</span>){'\n'}
                {'  '}.limit(<span className="text-amber-600">10</span>){'\n\n'}
                <span className="text-blue-500 font-semibold">// Sub-50ms globally 🚀</span>
              </pre>
            </div>

            <div className="absolute -top-8 right-6 animate-float-fast">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/80 bg-white/90 text-blue-500 shadow-xl backdrop-blur-md dark:border-slate-700 dark:bg-slate-800 dark:text-blue-400">
                <Cloud className="h-5 w-5 fill-current" />
              </div>
            </div>

            <div className="absolute -bottom-14 -left-4 animate-float-reverse">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/80 bg-white/90 text-indigo-500 shadow-xl backdrop-blur-md dark:border-slate-700 dark:bg-slate-800 dark:text-indigo-400">
                <Code2 className="h-5 w-5" />
              </div>
            </div>
          </div>
        </div>

        {/* Center Main Hero Content */}
        <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 text-center z-20">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50/80 px-3.5 py-1 text-xs font-semibold text-blue-600 shadow-xs mb-8 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-400">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Next-Gen PostgreSQL Backend-as-a-Service</span>
          </div>

          <h1 className="text-4xl font-black tracking-tight sm:text-6xl text-[#0f172a] dark:text-white leading-[1.12]">
            Build Fast. Scale Infinitely.{' '}
            <span className="block mt-1 bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-500 bg-clip-text text-transparent">
              Own Your Data.
            </span>
          </h1>

          <p className="mt-6 text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl mx-auto">
            The modern developer platform combining instant <strong>PostgreSQL 18</strong>, auto-generated REST & OpenAPI 3.1, realtime CDC streams, S3 storage, and sub-50ms Cloudflare Hyperdrive edge compute.
          </p>

          <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3.5">
            {user ? (
              <Link
                href="/console"
                className="flex h-11 w-full sm:w-auto items-center justify-center gap-2 rounded-full bg-[#111827] px-7 text-sm font-semibold text-white shadow-xl hover:bg-[#1f2937] transition-all hover:scale-[1.02] dark:bg-white dark:text-black dark:hover:bg-slate-200"
              >
                <span>Enter Stratum Console</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <a
                href="/api/auth/github"
                className="flex h-11 w-full sm:w-auto items-center justify-center gap-2.5 rounded-full bg-[#111827] px-7 text-sm font-semibold text-white shadow-xl hover:bg-[#1f2937] transition-all hover:scale-[1.02] dark:bg-white dark:text-black dark:hover:bg-slate-200"
              >
                <Github className="h-4 w-4" />
                <span>Continue with GitHub</span>
              </a>
            )}
            <a
              href="/bf/api/v1/openapi.json"
              target="_blank"
              rel="noreferrer"
              className="flex h-11 w-full sm:w-auto items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-6 text-sm font-semibold text-slate-800 shadow-xs hover:bg-slate-50 transition-colors dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <Code2 className="h-4 w-4 text-slate-500" />
              <span>Live OpenAPI Spec</span>
            </a>
          </div>

          {/* 4-Metric Ribbon Grid */}
          <div className="mt-14 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-4xl mx-auto">
            <div className="rounded-2xl border border-slate-200/80 bg-white/85 p-4 text-left shadow-sm backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/80">
              <div className="flex items-center gap-2 mb-1">
                <Zap className="h-4 w-4 text-blue-600 fill-current" />
                <p className="text-xl font-bold font-mono text-ink">43ms</p>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">Query Latency (Hyperdrive)</p>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white/85 p-4 text-left shadow-sm backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/80">
              <div className="flex items-center gap-2 mb-1">
                <Database className="h-4 w-4 text-blue-600" />
                <p className="text-xl font-bold font-mono text-ink">v18.6</p>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">PostgreSQL Engine</p>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white/85 p-4 text-left shadow-sm backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/80">
              <div className="flex items-center gap-2 mb-1">
                <Globe className="h-4 w-4 text-emerald-600" />
                <p className="text-xl font-bold font-mono text-ink">300+</p>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">Global Edge Locations</p>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white/85 p-4 text-left shadow-sm backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/80">
              <div className="flex items-center gap-2 mb-1">
                <Shield className="h-4 w-4 text-emerald-600" />
                <p className="text-xl font-bold font-mono text-ink">100%</p>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">Automated REST & OpenAPI</p>
            </div>
          </div>

          {/* Interactive Console Terminal Window Preview */}
          <div className="mt-14 rounded-2xl border border-slate-200/90 bg-white/95 shadow-2xl overflow-hidden max-w-5xl mx-auto text-left dark:border-slate-800 dark:bg-slate-900/95">
            <div className="flex h-11 items-center justify-between border-b border-slate-200/80 bg-slate-50/80 px-4 dark:border-slate-800 dark:bg-slate-800/80">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-slate-500 font-medium">stratum-console — live project runtime</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-mono font-medium text-emerald-600 dark:text-emerald-400">Hyperdrive Active</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-200 dark:divide-slate-800 p-5 sm:p-6 gap-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-ink">
                  <Database className="h-4 w-4 text-blue-600" />
                  <span>PostgreSQL 18 Live DB</span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Realtime connection pool managed via Cloudflare Hyperdrive TCP acceleration for sub-50ms queries anywhere on Earth.
                </p>
                <div className="rounded-lg bg-slate-50 p-2.5 font-mono text-xs text-slate-600 border border-slate-200/80 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300">
                  <span className="text-blue-600 font-bold">SELECT</span> * <span className="text-blue-600 font-bold">FROM</span> users <span className="text-blue-600 font-bold">LIMIT</span> 5;
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-ink">
                  <KeyRound className="h-4 w-4 text-emerald-600" />
                  <span>Zero-Config REST API</span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Every table you create is immediately accessible with OpenAPI 3.1 schemas, filtering, pagination, and role-based API keys.
                </p>
                <div className="rounded-lg bg-slate-50 p-2.5 font-mono text-xs text-slate-600 border border-slate-200/80 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300">
                  <span className="text-emerald-600 font-bold">GET</span> /api/v1/users?status=active
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-ink">
                  <Radio className="h-4 w-4 text-amber-600" />
                  <span>Realtime CDC & S3 Storage</span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Listen to PostgreSQL WAL change streams over WebSockets and store files with S3-compatible presigned URLs.
                </p>
                <div className="rounded-lg bg-slate-50 p-2.5 font-mono text-xs text-slate-600 border border-slate-200/80 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300">
                  <span className="text-amber-600 font-bold">WS</span> /realtime/v1/subscribe
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Core Features Grid */}
      <section id="features" className="py-20 border-t border-line bg-slate-50/50 dark:bg-slate-900/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-blue-600">Core Capabilities</h2>
            <p className="mt-2 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
              Everything you need to ship in hours, not weeks
            </p>
            <p className="mt-4 text-sm text-slate-500">
              Stratum replaces dozens of disconnected tools with a unified backend platform architected for maximum speed and security.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:border-slate-300 transition-all dark:border-slate-800 dark:bg-slate-900">
              <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4 dark:bg-blue-950/60 dark:text-blue-400">
                <Database className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold text-ink">PostgreSQL 18 with Hyperdrive</h3>
              <p className="mt-2 text-xs text-slate-500 leading-relaxed">
                Connect your database to Cloudflare Hyperdrive for instant TCP socket pooling, caching, and sub-50ms execution from 300+ edge cities.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:border-slate-300 transition-all dark:border-slate-800 dark:bg-slate-900">
              <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4 dark:bg-emerald-950/60 dark:text-emerald-400">
                <Code2 className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold text-ink">Auto-Generated REST & OpenAPI</h3>
              <p className="mt-2 text-xs text-slate-500 leading-relaxed">
                No manual boilerplate controllers. Stratum inspects your live Postgres schema and generates type-safe REST routes and interactive OpenAPI documentation.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:border-slate-300 transition-all dark:border-slate-800 dark:bg-slate-900">
              <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4 dark:bg-amber-950/60 dark:text-amber-400">
                <Radio className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold text-ink">Realtime Change Data Capture</h3>
              <p className="mt-2 text-xs text-slate-500 leading-relaxed">
                Subscribe to INSERT, UPDATE, and DELETE events on any table with zero polling. Stream live data to clients over WebSockets or Server-Sent Events.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:border-slate-300 transition-all dark:border-slate-800 dark:bg-slate-900">
              <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4 dark:bg-blue-950/60 dark:text-blue-400">
                <Boxes className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold text-ink">S3-Compatible Storage</h3>
              <p className="mt-2 text-xs text-slate-500 leading-relaxed">
                Store user uploads, images, and documents with instant bucket creation, metadata indexing in Postgres, and secure presigned download links.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:border-slate-300 transition-all dark:border-slate-800 dark:bg-slate-900">
              <div className="h-10 w-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-4 dark:bg-purple-950/60 dark:text-purple-400">
                <Zap className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold text-ink">Serverless Edge Functions</h3>
              <p className="mt-2 text-xs text-slate-500 leading-relaxed">
                Deploy custom TypeScript logic running on V8 isolates with 0ms cold starts. Trigger functions from API endpoints or database events.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:border-slate-300 transition-all dark:border-slate-800 dark:bg-slate-900">
              <div className="h-10 w-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center mb-4 dark:bg-red-950/60 dark:text-red-400">
                <Shield className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold text-ink">API Key RBAC & Audit Trails</h3>
              <p className="mt-2 text-xs text-slate-500 leading-relaxed">
                Fine-grained permissions for anonymous client keys, service roles, and master admin keys with automated request logging and latency telemetry.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Code & Developer Experience */}
      <section id="code" className="py-20 border-t border-line">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-5 space-y-4">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-blue-600">Developer Experience</h2>
              <p className="text-3xl font-bold tracking-tight text-ink">
                Effortless integration in any language
              </p>
              <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                Whether you are building with Next.js, Python FastAPI, Mobile apps, or microservices, Stratum connects with clean idioms and zero friction.
              </p>

              <div className="space-y-2 pt-2">
                <div className="flex items-center gap-2 text-xs text-ink font-medium">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span>TypeScript auto-generated schema types</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-ink font-medium">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span>Standard cURL & REST for any HTTP client</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-ink font-medium">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span>WebSockets & SSE for live streaming feeds</span>
                </div>
              </div>

              <div className="pt-4">
                {user ? (
                  <Link
                    href="/console"
                    className="inline-flex items-center gap-2 rounded-full bg-[#1e5eff] px-5 py-2.5 text-xs font-semibold text-white shadow hover:bg-blue-600 transition-colors"
                  >
                    <span>Open Project Console</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                ) : (
                  <a
                    href="/api/auth/github"
                    className="inline-flex items-center gap-2 rounded-full bg-[#111827] px-5 py-2.5 text-xs font-semibold text-white shadow hover:bg-slate-800 transition-colors"
                  >
                    <Github className="h-3.5 w-3.5" />
                    <span>Sign in with GitHub</span>
                  </a>
                )}
              </div>
            </div>

            {/* Code Box with Solid Background & Syntax Highlighting */}
            <div className="lg:col-span-7">
              <div className="rounded-2xl border border-slate-700/80 bg-[#0d1117] shadow-2xl overflow-hidden">
                {/* Header bar */}
                <div className="flex items-center justify-between border-b border-slate-800 bg-[#161b22] px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <div className="h-3 w-3 rounded-full bg-[#ff5f56]" />
                      <div className="h-3 w-3 rounded-full bg-[#ffbd2e]" />
                      <div className="h-3 w-3 rounded-full bg-[#27c93f]" />
                    </div>
                    <div className="flex gap-1">
                      {[
                        { id: 'ts', label: 'TypeScript / Next.js' },
                        { id: 'curl', label: 'cURL / REST' },
                        { id: 'py', label: 'Python' },
                        { id: 'realtime', label: 'Realtime CDC' },
                      ].map((tab) => (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id as any)}
                          className={`rounded-md px-2.5 py-1 text-xs font-mono transition-colors ${
                            activeTab === tab.id
                              ? 'bg-[#1f293d] text-blue-400 font-semibold border border-blue-500/30'
                              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => copyCode(codeSnippetsRaw[activeTab])}
                    className="flex items-center gap-1.5 rounded bg-slate-800/80 px-2.5 py-1 text-xs font-mono text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                    title="Copy code"
                  >
                    {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>

                {/* Solid Code Editor Display */}
                <div className="p-5 font-mono text-xs leading-relaxed overflow-x-auto bg-[#0d1117] text-slate-200">
                  {activeTab === 'ts' && (
                    <pre>
                      <span className="text-[#c678dd]">import</span> {'{'} <span className="text-[#e5c07b]">createClient</span> {'}'} <span className="text-[#c678dd]">from</span> <span className="text-[#98c379]">&apos;@stratum/sdk&apos;</span>;{'\n\n'}
                      <span className="text-[#5c6370] italic">// Initialize with your Stratum edge endpoint</span>{'\n'}
                      <span className="text-[#c678dd]">const</span> stratum = <span className="text-[#61afef]">createClient</span>({'{'}{'\n'}
                      {'  '}url: <span className="text-[#98c379]">&apos;https://stratum-api.jojin1709.workers.dev&apos;</span>,{'\n'}
                      {'  '}apiKey: process.env.STRATUM_PUBLIC_KEY,{'\n'}
                      {'}'});{'\n\n'}
                      <span className="text-[#5c6370] italic">// Query PostgreSQL with sub-50ms Hyperdrive latency</span>{'\n'}
                      <span className="text-[#c678dd]">const</span> {'{'} data: users, error {'}'} = <span className="text-[#c678dd]">await</span> stratum{'\n'}
                      {'  '}.<span className="text-[#61afef]">from</span>(<span className="text-[#98c379]">&apos;users&apos;</span>){'\n'}
                      {'  '}.<span className="text-[#61afef]">select</span>(<span className="text-[#98c379]">&apos;id, name, email, created_at&apos;</span>){'\n'}
                      {'  '}.<span className="text-[#61afef]">order</span>(<span className="text-[#98c379]">&apos;created_at&apos;</span>, {'{'} ascending: <span className="text-[#d19a66]">false</span> {'}'}){'\n'}
                      {'  '}.<span className="text-[#61afef]">limit</span>(<span className="text-[#d19a66]">10</span>);{'\n\n'}
                      console.<span className="text-[#61afef]">log</span>(<span className="text-[#98c379]">&apos;Fetched users:&apos;</span>, users);
                    </pre>
                  )}

                  {activeTab === 'curl' && (
                    <pre>
                      <span className="text-[#5c6370] italic"># Instant auto-generated REST API with OpenAPI 3.1</span>{'\n'}
                      curl -X GET <span className="text-[#98c379]">&quot;https://stratum-api.jojin1709.workers.dev/api/v1/meta/tables&quot;</span> \{'\n'}
                      {'  '}-H <span className="text-[#98c379]">&quot;apikey: strat_secret_3VaZu6akUJyh52qOPs1HXldzE4aSlSvS&quot;</span> \{'\n'}
                      {'  '}-H <span className="text-[#98c379]">&quot;Content-Type: application/json&quot;</span>{'\n\n'}
                      <span className="text-[#5c6370] italic"># Response: 200 OK (~43ms)</span>{'\n'}
                      <span className="text-[#5c6370] italic"># [{'{'}&quot;name&quot;:&quot;users&quot;,&quot;schema&quot;:&quot;public&quot;,&quot;columns&quot;:4,&quot;rowCount&quot;:120{'}'}]</span>
                    </pre>
                  )}

                  {activeTab === 'py' && (
                    <pre>
                      <span className="text-[#c678dd]">from</span> stratum <span className="text-[#c678dd]">import</span> StratumClient{'\n\n'}
                      <span className="text-[#5c6370] italic"># Connect to Stratum Edge Backend</span>{'\n'}
                      client = <span className="text-[#61afef]">StratumClient</span>({'\n'}
                      {'    '}api_url=<span className="text-[#98c379]">&quot;https://stratum-api.jojin1709.workers.dev&quot;</span>,{'\n'}
                      {'    '}api_key=<span className="text-[#98c379]">&quot;strat_secret_3VaZu6akUJyh52qOPs1HXldzE4aSlSvS&quot;</span>{'\n'}
                      ){'\n\n'}
                      <span className="text-[#5c6370] italic"># Insert new record into PostgreSQL</span>{'\n'}
                      record = client.<span className="text-[#61afef]">table</span>(<span className="text-[#98c379]">&quot;projects&quot;</span>).<span className="text-[#61afef]">insert</span>({'{'}{'\n'}
                      {'    '}<span className="text-[#98c379]">&quot;name&quot;</span>: <span className="text-[#98c379]">&quot;AI Agent Orchestrator&quot;</span>,{'\n'}
                      {'    '}<span className="text-[#98c379]">&quot;status&quot;</span>: <span className="text-[#98c379]">&quot;active&quot;</span>,{'\n'}
                      {'    '}<span className="text-[#98c379]">&quot;author&quot;</span>: <span className="text-[#98c379]">&quot;Jojin John&quot;</span>{'\n'}
                      {'}'}){'\n\n'}
                      <span className="text-[#61afef]">print</span>(<span className="text-[#98c379]">&quot;Created project:&quot;</span>, record)
                    </pre>
                  )}

                  {activeTab === 'realtime' && (
                    <pre>
                      <span className="text-[#5c6370] italic">// Subscribe to live PostgreSQL Change Data Capture (CDC)</span>{'\n'}
                      <span className="text-[#c678dd]">const</span> subscription = stratum{'\n'}
                      {'  '}.<span className="text-[#61afef]">channel</span>(<span className="text-[#98c379]">&apos;public:orders&apos;</span>){'\n'}
                      {'  '}.<span className="text-[#61afef]">on</span>(<span className="text-[#98c379]">&apos;INSERT&apos;</span>, (payload) =&gt; {'{'}{'\n'}
                      {'    '}console.<span className="text-[#61afef]">log</span>(<span className="text-[#98c379]">&apos;New order received in realtime:&apos;</span>, payload.new);{'\n'}
                      {'  '}&apos;{'}'}){'\n'}
                      {'  '}.<span className="text-[#61afef]">subscribe</span>();
                    </pre>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Global Architecture Section */}
      <section id="architecture" className="py-20 border-t border-line bg-slate-50/50 dark:bg-slate-900/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-blue-600">High-Performance Infrastructure</h2>
            <p className="mt-2 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
              Engineered for low latency from Day 1
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-2 text-xs font-bold text-ink mb-2">
                <Globe className="h-4 w-4 text-blue-600" />
                <span>Edge Routing</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Cloudflare Workers globally distributed across 300+ locations terminate SSL and authenticate requests in &lt;10ms.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-2 text-xs font-bold text-ink mb-2">
                <Zap className="h-4 w-4 text-emerald-600 fill-current" />
                <span>Hyperdrive Pooling</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Maintains active warm TCP connections to the central database, eliminating cold database handshake delays.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-2 text-xs font-bold text-ink mb-2">
                <Database className="h-4 w-4 text-blue-600" />
                <span>PostgreSQL 18 DB</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Industrial-grade relational database running on dedicated high-performance cloud compute.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-2 text-xs font-bold text-ink mb-2">
                <Shield className="h-4 w-4 text-indigo-600" />
                <span>Security Engine</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Automated RBAC, query sanitization, token hashing, and strict CORS policies out of the box.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Creator Spotlight */}
      <section id="creator" className="py-20 border-t border-line">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-10 shadow-lg flex flex-col sm:flex-row items-center gap-6 sm:gap-8 dark:border-slate-800 dark:bg-slate-900">
            <img
              src="https://avatars.githubusercontent.com/u/197761551?v=4"
              alt="Jojin John"
              className="h-24 w-24 rounded-full border-2 border-blue-500 object-cover shadow-md"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://github.com/jojin1709.png';
              }}
            />
            <div className="space-y-2 text-center sm:text-left flex-1">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-2.5 py-0.5 text-xs font-mono text-blue-600 dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-400">
                Architect & Engineer
              </div>
              <h3 className="text-xl font-bold text-ink">Jojin John</h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Unlocking digital realms as an ethical hacker by day, crafting seamless experiences as a full stack developer by night. <span className="text-blue-600 dark:text-blue-400 font-semibold">#CyberGuardian #CodeWizard</span>. Architected <strong>Stratum</strong> to deliver the fastest, self-hostable, serverless Backend-as-a-Service on top of PostgreSQL and Edge computing.
              </p>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 pt-2">
                <a
                  href="https://github.com/jojin1709"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 hover:text-blue-600 transition-colors dark:text-slate-200"
                >
                  <Github className="h-4 w-4" />
                  <span>@jojin1709</span>
                </a>
                <a
                  href="https://github.com/jojin1709/Stratum"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors dark:hover:text-slate-200"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>Stratum Repository</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-20 border-t border-line bg-gradient-to-b from-canvas to-slate-50 dark:to-slate-900/60 text-center">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 space-y-6">
          <h2 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            Ready to experience Stratum?
          </h2>
          <p className="text-sm text-slate-500 max-w-xl mx-auto">
            Authenticate with your GitHub account to access your live database console, generate API keys, and deploy functions.
          </p>
          <div className="flex items-center justify-center gap-4 pt-2">
            {user ? (
              <Link
                href="/console"
                className="flex h-11 items-center gap-2 rounded-full bg-[#111827] px-7 text-sm font-semibold text-white shadow-xl hover:bg-[#1f2937] transition-all hover:scale-[1.02] dark:bg-white dark:text-black dark:hover:bg-slate-200"
              >
                <span>Launch Console</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <a
                href="/api/auth/github"
                className="flex h-11 items-center gap-2.5 rounded-full bg-[#111827] px-7 text-sm font-semibold text-white shadow-xl hover:bg-[#1f2937] transition-all hover:scale-[1.02] dark:bg-white dark:text-black dark:hover:bg-slate-200"
              >
                <Github className="h-4 w-4" />
                <span>Sign in with GitHub</span>
              </a>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-line bg-white dark:bg-slate-950 py-8 text-center text-xs text-slate-400">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800 dark:text-slate-200">Stratum</span>
            <span>— Developed by Jojin John</span>
          </div>
          <p className="text-[11px]">
            © 2026 Stratum. All Rights Reserved. Proprietary software developed by Jojin John (@jojin1709).
          </p>
          <div className="flex items-center gap-4 text-[11px]">
            <a href="https://github.com/jojin1709/Stratum" target="_blank" rel="noreferrer" className="hover:text-slate-800 dark:hover:text-slate-200 transition-colors">
              GitHub
            </a>
            <a href="/bf/api/v1/openapi.json" target="_blank" rel="noreferrer" className="hover:text-slate-800 dark:hover:text-slate-200 transition-colors">
              OpenAPI
            </a>
            <Link href="/login" className="hover:text-slate-800 dark:hover:text-slate-200 transition-colors">
              Console Sign In
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
