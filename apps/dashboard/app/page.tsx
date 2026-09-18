'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Database, Zap, Boxes, Radio, KeyRound, Shield, Terminal, ArrowRight,
  Github, CheckCircle2, Cpu, Globe, Server, Layers, Code2, Sparkles,
  ExternalLink, ChevronRight, Activity, Copy, Check
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

  const codeSnippets = {
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
    <div className="min-h-screen bg-canvas text-ink selection:bg-accent-soft selection:text-accent font-sans">
      {/* Dynamic Background Glow Elements */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[500px] w-[800px] rounded-full bg-gradient-to-b from-accent/15 via-accent/5 to-transparent blur-3xl" />
        <div className="absolute top-[600px] -left-40 h-[400px] w-[500px] rounded-full bg-positive/5 blur-3xl" />
        <div className="absolute top-[1200px] -right-40 h-[500px] w-[600px] rounded-full bg-accent/10 blur-3xl" />
      </div>

      {/* Top Sticky Navigation */}
      <header className="sticky top-0 z-50 border-b border-line/80 bg-surface/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-white font-bold text-sm shadow-md transition-transform group-hover:scale-105">
                S
              </div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold tracking-tight text-ink">Stratum</span>
                <span className="hidden sm:inline-flex rounded-full border border-line bg-sunken px-2 py-0.5 text-[10px] font-mono text-ink-soft">
                  v0.1.0 • by Jojin John
                </span>
              </div>
            </Link>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-ink-soft">
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
                  className="flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3.5 text-xs font-medium text-white shadow-sm hover:bg-accent/90 transition-all hover:scale-[1.02]"
                >
                  <span>Launch Console</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                <Link href="/console" className="flex items-center gap-2">
                  <img
                    src={user.avatar_url}
                    alt={user.login}
                    className="h-7 w-7 rounded-full border border-line"
                  />
                </Link>
              </div>
            ) : (
              <a
                href="/api/auth/github"
                className="flex h-8 items-center gap-2 rounded-lg bg-[#24292F] px-3.5 text-xs font-medium text-white shadow-sm hover:bg-[#1b1f23] transition-all hover:scale-[1.02]"
              >
                <Github className="h-3.5 w-3.5" />
                <span>Sign in with GitHub</span>
              </a>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-16 pb-20 sm:pt-24 sm:pb-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            {/* Tag Badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent-soft/80 px-3 py-1 text-xs font-medium text-accent mb-6 shadow-sm">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Next-Gen PostgreSQL Backend-as-a-Service</span>
            </div>

            {/* Headline */}
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl text-ink">
              Build Fast. Scale Infinitely.{' '}
              <span className="bg-gradient-to-r from-accent via-indigo-400 to-positive bg-clip-text text-transparent">
                Own Your Data.
              </span>
            </h1>

            {/* Subheadline */}
            <p className="mt-6 text-base sm:text-lg text-ink-soft leading-relaxed max-w-2xl mx-auto">
              The modern developer platform combining instant <strong>PostgreSQL 18</strong>, auto-generated REST & OpenAPI 3.1, realtime CDC streams, S3 storage, and sub-50ms Cloudflare Hyperdrive edge compute.
            </p>

            {/* Action Buttons */}
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
              {user ? (
                <Link
                  href="/console"
                  className="flex h-11 w-full sm:w-auto items-center justify-center gap-2 rounded-lg bg-accent px-6 text-sm font-semibold text-white shadow-lg hover:bg-accent/90 transition-all hover:scale-[1.02]"
                >
                  <span>Enter Stratum Console</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ) : (
                <a
                  href="/api/auth/github"
                  className="flex h-11 w-full sm:w-auto items-center justify-center gap-2.5 rounded-lg bg-[#24292F] px-6 text-sm font-semibold text-white shadow-lg hover:bg-[#1b1f23] transition-all hover:scale-[1.02]"
                >
                  <Github className="h-4 w-4" />
                  <span>Continue with GitHub</span>
                </a>
              )}
              <a
                href="/bf/api/v1/openapi.json"
                target="_blank"
                rel="noreferrer"
                className="flex h-11 w-full sm:w-auto items-center justify-center gap-2 rounded-lg border border-line bg-surface px-5 text-sm font-medium text-ink shadow-sm hover:bg-sunken transition-colors"
              >
                <Code2 className="h-4 w-4 text-ink-soft" />
                <span>Live OpenAPI Spec</span>
              </a>
            </div>

            {/* Metrics Ribbon */}
            <div className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl mx-auto">
              <div className="rounded-lg border border-line bg-surface/60 p-3 text-center backdrop-blur-xs">
                <p className="text-xl font-bold font-mono text-ink">43ms</p>
                <p className="text-2xs text-ink-soft mt-0.5">Query Latency (Hyperdrive)</p>
              </div>
              <div className="rounded-lg border border-line bg-surface/60 p-3 text-center backdrop-blur-xs">
                <p className="text-xl font-bold font-mono text-ink">v18.6</p>
                <p className="text-2xs text-ink-soft mt-0.5">PostgreSQL Engine</p>
              </div>
              <div className="rounded-lg border border-line bg-surface/60 p-3 text-center backdrop-blur-xs">
                <p className="text-xl font-bold font-mono text-ink">300+</p>
                <p className="text-2xs text-ink-soft mt-0.5">Global Edge Locations</p>
              </div>
              <div className="rounded-lg border border-line bg-surface/60 p-3 text-center backdrop-blur-xs">
                <p className="text-xl font-bold font-mono text-ink">100%</p>
                <p className="text-2xs text-ink-soft mt-0.5">Automated REST & OpenAPI</p>
              </div>
            </div>
          </div>

          {/* Interactive Console Terminal Preview */}
          <div className="mt-16 rounded-xl border border-line bg-surface/95 shadow-2xl overflow-hidden max-w-5xl mx-auto">
            <div className="flex h-10 items-center justify-between border-b border-line bg-sunken px-4">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-critical/70" />
                <div className="h-3 w-3 rounded-full bg-caution/70" />
                <div className="h-3 w-3 rounded-full bg-positive/70" />
                <span className="ml-2 font-mono text-xs text-ink-faint">stratum-console — live project runtime</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-positive animate-pulse" />
                <span className="text-2xs font-mono text-ink-soft">Hyperdrive Active</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-line p-4 sm:p-6 gap-4 sm:gap-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-ink">
                  <Database className="h-4 w-4 text-accent" />
                  <span>PostgreSQL 18 Live DB</span>
                </div>
                <p className="text-xs text-ink-soft leading-relaxed">
                  Realtime connection pool managed via Cloudflare Hyperdrive TCP acceleration for sub-50ms queries anywhere on Earth.
                </p>
                <div className="rounded bg-sunken p-2.5 font-mono text-2xs text-ink-soft border border-line">
                  <span className="text-accent font-semibold">SELECT</span> * <span className="text-accent font-semibold">FROM</span> users <span className="text-accent font-semibold">LIMIT</span> 5;
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-ink">
                  <KeyRound className="h-4 w-4 text-positive" />
                  <span>Zero-Config REST API</span>
                </div>
                <p className="text-xs text-ink-soft leading-relaxed">
                  Every table you create is immediately accessible with OpenAPI 3.1 schemas, filtering, pagination, and role-based API keys.
                </p>
                <div className="rounded bg-sunken p-2.5 font-mono text-2xs text-ink-soft border border-line">
                  <span className="text-positive font-semibold">GET</span> /api/v1/users?status=eq.active
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-ink">
                  <Radio className="h-4 w-4 text-caution" />
                  <span>Realtime CDC & S3 Storage</span>
                </div>
                <p className="text-xs text-ink-soft leading-relaxed">
                  Listen to PostgreSQL WAL change streams over WebSockets and store files with S3-compatible presigned URLs.
                </p>
                <div className="rounded bg-sunken p-2.5 font-mono text-2xs text-ink-soft border border-line">
                  <span className="text-caution font-semibold">WS</span> /realtime/v1/subscribe
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Core Features Grid */}
      <section id="features" className="py-20 border-t border-line bg-sunken/40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-accent">Core Capabilities</h2>
            <p className="mt-2 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
              Everything you need to ship in hours, not weeks
            </p>
            <p className="mt-4 text-sm text-ink-soft">
              Stratum replaces dozens of disconnected tools with a unified backend platform architected for maximum speed and security.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div className="rounded-xl border border-line bg-surface p-6 shadow-2xs hover:border-line-strong transition-all">
              <div className="h-10 w-10 rounded-lg bg-accent-soft text-accent flex items-center justify-center mb-4">
                <Database className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold text-ink">PostgreSQL 18 with Hyperdrive</h3>
              <p className="mt-2 text-xs text-ink-soft leading-relaxed">
                Connect your database to Cloudflare Hyperdrive for instant TCP socket pooling, caching, and sub-50ms execution from 300+ edge cities.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="rounded-xl border border-line bg-surface p-6 shadow-2xs hover:border-line-strong transition-all">
              <div className="h-10 w-10 rounded-lg bg-positive/10 text-positive flex items-center justify-center mb-4">
                <Code2 className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold text-ink">Auto-Generated REST & OpenAPI</h3>
              <p className="mt-2 text-xs text-ink-soft leading-relaxed">
                No manual boilerplate controllers. Stratum inspects your live Postgres schema and generates type-safe REST routes and interactive OpenAPI documentation.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="rounded-xl border border-line bg-surface p-6 shadow-2xs hover:border-line-strong transition-all">
              <div className="h-10 w-10 rounded-lg bg-caution/10 text-caution flex items-center justify-center mb-4">
                <Radio className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold text-ink">Realtime Change Data Capture</h3>
              <p className="mt-2 text-xs text-ink-soft leading-relaxed">
                Subscribe to INSERT, UPDATE, and DELETE events on any table with zero polling. Stream live data to clients over WebSockets or Server-Sent Events.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="rounded-xl border border-line bg-surface p-6 shadow-2xs hover:border-line-strong transition-all">
              <div className="h-10 w-10 rounded-lg bg-accent-soft text-accent flex items-center justify-center mb-4">
                <Boxes className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold text-ink">S3-Compatible Storage</h3>
              <p className="mt-2 text-xs text-ink-soft leading-relaxed">
                Store user uploads, images, and documents with instant bucket creation, metadata indexing in Postgres, and secure presigned download links.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="rounded-xl border border-line bg-surface p-6 shadow-2xs hover:border-line-strong transition-all">
              <div className="h-10 w-10 rounded-lg bg-positive/10 text-positive flex items-center justify-center mb-4">
                <Zap className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold text-ink">Serverless Edge Functions</h3>
              <p className="mt-2 text-xs text-ink-soft leading-relaxed">
                Deploy custom TypeScript logic running on V8 isolates with 0ms cold starts. Trigger functions from API endpoints or database events.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="rounded-xl border border-line bg-surface p-6 shadow-2xs hover:border-line-strong transition-all">
              <div className="h-10 w-10 rounded-lg bg-critical/10 text-critical flex items-center justify-center mb-4">
                <Shield className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold text-ink">API Key RBAC & Audit Trails</h3>
              <p className="mt-2 text-xs text-ink-soft leading-relaxed">
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
              <h2 className="text-xs font-semibold uppercase tracking-wider text-accent">Developer Experience</h2>
              <p className="text-3xl font-bold tracking-tight text-ink">
                Effortless integration in any language
              </p>
              <p className="text-xs sm:text-sm text-ink-soft leading-relaxed">
                Whether you are building with Next.js, Python FastAPI, Mobile apps, or microservices, Stratum connects with clean idioms and zero friction.
              </p>

              <div className="space-y-2 pt-2">
                <div className="flex items-center gap-2 text-xs text-ink">
                  <CheckCircle2 className="h-4 w-4 text-positive shrink-0" />
                  <span>TypeScript auto-generated schema types</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-ink">
                  <CheckCircle2 className="h-4 w-4 text-positive shrink-0" />
                  <span>Standard cURL & REST for any HTTP client</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-ink">
                  <CheckCircle2 className="h-4 w-4 text-positive shrink-0" />
                  <span>WebSockets & SSE for live streaming feeds</span>
                </div>
              </div>

              <div className="pt-4">
                {user ? (
                  <Link
                    href="/console"
                    className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-white shadow hover:bg-accent/90 transition-colors"
                  >
                    <span>Open Project Console</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                ) : (
                  <a
                    href="/api/auth/github"
                    className="inline-flex items-center gap-2 rounded-lg bg-[#24292F] px-4 py-2 text-xs font-semibold text-white shadow hover:bg-[#1b1f23] transition-colors"
                  >
                    <Github className="h-3.5 w-3.5" />
                    <span>Sign in with GitHub</span>
                  </a>
                )}
              </div>
            </div>

            <div className="lg:col-span-7">
              <div className="rounded-xl border border-line bg-surface shadow-xl overflow-hidden">
                {/* Code Tabs */}
                <div className="flex items-center justify-between border-b border-line bg-sunken px-3">
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
                        className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                          activeTab === tab.id
                            ? 'border-accent text-accent font-semibold'
                            : 'border-transparent text-ink-soft hover:text-ink'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => copyCode(codeSnippets[activeTab])}
                    className="flex items-center gap-1 text-2xs text-ink-soft hover:text-ink transition-colors p-1"
                    title="Copy code"
                  >
                    {copied ? <Check className="h-3.5 w-3.5 text-positive" /> : <Copy className="h-3.5 w-3.5" />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>

                {/* Code Display */}
                <pre className="p-4 font-mono text-xs text-ink-soft leading-relaxed overflow-x-auto bg-canvas">
                  <code>{codeSnippets[activeTab]}</code>
                </pre>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Global Architecture Section */}
      <section id="architecture" className="py-20 border-t border-line bg-sunken/40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-accent">High-Performance Infrastructure</h2>
            <p className="mt-2 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
              Engineered for low latency from Day 1
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="rounded-lg border border-line bg-surface p-4">
              <div className="flex items-center gap-2 text-xs font-bold text-ink mb-1">
                <Globe className="h-4 w-4 text-accent" />
                <span>Edge Routing</span>
              </div>
              <p className="text-2xs text-ink-soft">
                Cloudflare Workers globally distributed across 300+ locations terminate SSL and authenticate requests in &lt;10ms.
              </p>
            </div>

            <div className="rounded-lg border border-line bg-surface p-4">
              <div className="flex items-center gap-2 text-xs font-bold text-ink mb-1">
                <Zap className="h-4 w-4 text-positive" />
                <span>Hyperdrive Pooling</span>
              </div>
              <p className="text-2xs text-ink-soft">
                Maintains active warm TCP connections to the central database, eliminating cold database handshake delays.
              </p>
            </div>

            <div className="rounded-lg border border-line bg-surface p-4">
              <div className="flex items-center gap-2 text-xs font-bold text-ink mb-1">
                <Database className="h-4 w-4 text-caution" />
                <span>PostgreSQL 18 DB</span>
              </div>
              <p className="text-2xs text-ink-soft">
                Industrial-grade relational database running on dedicated high-performance cloud compute.
              </p>
            </div>

            <div className="rounded-lg border border-line bg-surface p-4">
              <div className="flex items-center gap-2 text-xs font-bold text-ink mb-1">
                <Shield className="h-4 w-4 text-accent" />
                <span>Security Engine</span>
              </div>
              <p className="text-2xs text-ink-soft">
                Automated RBAC, query sanitization, token hashing, and strict CORS policies out of the box.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Creator Spotlight */}
      <section id="creator" className="py-20 border-t border-line">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-line bg-surface p-6 sm:p-10 shadow-lg flex flex-col sm:flex-row items-center gap-6 sm:gap-8">
            <img
              src="https://avatars.githubusercontent.com/u/102925763?v=4"
              alt="Jojin John"
              className="h-24 w-24 rounded-full border-2 border-accent object-cover shadow-md"
            />
            <div className="space-y-2 text-center sm:text-left flex-1">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-line bg-sunken px-2.5 py-0.5 text-2xs font-mono text-accent">
                Architect & Engineer
              </div>
              <h3 className="text-xl font-bold text-ink">Jojin John</h3>
              <p className="text-xs text-ink-soft leading-relaxed">
                Full Stack Developer, Ethical Hacker, and Security Researcher. Architected <strong>Stratum</strong> to deliver the fastest, self-hostable, serverless Backend-as-a-Service on top of PostgreSQL and Edge computing.
              </p>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 pt-2">
                <a
                  href="https://github.com/jojin1709"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 text-xs font-medium text-ink hover:text-accent transition-colors"
                >
                  <Github className="h-4 w-4" />
                  <span>@jojin1709</span>
                </a>
                <a
                  href="https://github.com/jojin1709/Stratum"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 text-xs font-medium text-ink-soft hover:text-ink transition-colors"
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
      <section className="py-16 border-t border-line bg-gradient-to-b from-canvas to-sunken/60 text-center">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 space-y-6">
          <h2 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            Ready to experience Stratum?
          </h2>
          <p className="text-sm text-ink-soft max-w-xl mx-auto">
            Authenticate with your GitHub account to access your live database console, generate API keys, and deploy functions.
          </p>
          <div className="flex items-center justify-center gap-4 pt-2">
            {user ? (
              <Link
                href="/console"
                className="flex h-11 items-center gap-2 rounded-lg bg-accent px-6 text-sm font-semibold text-white shadow-lg hover:bg-accent/90 transition-all hover:scale-[1.02]"
              >
                <span>Launch Console</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <a
                href="/api/auth/github"
                className="flex h-11 items-center gap-2.5 rounded-lg bg-[#24292F] px-6 text-sm font-semibold text-white shadow-lg hover:bg-[#1b1f23] transition-all hover:scale-[1.02]"
              >
                <Github className="h-4 w-4" />
                <span>Sign in with GitHub</span>
              </a>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-line bg-surface py-8 text-center text-xs text-ink-faint">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-ink">Stratum</span>
            <span>— Developed by Jojin John</span>
          </div>
          <p className="text-2xs">
            © 2026 Stratum. All Rights Reserved. Proprietary software developed by Jojin John (@jojin1709).
          </p>
          <div className="flex items-center gap-4">
            <a href="https://github.com/jojin1709/Stratum" target="_blank" rel="noreferrer" className="hover:text-ink transition-colors">
              GitHub
            </a>
            <a href="/bf/api/v1/openapi.json" target="_blank" rel="noreferrer" className="hover:text-ink transition-colors">
              OpenAPI
            </a>
            <Link href="/login" className="hover:text-ink transition-colors">
              Console Sign In
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
