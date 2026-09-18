'use client';

import Link from 'next/link';
import { Github, ArrowLeft, CheckCircle2 } from 'lucide-react';

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-canvas p-4 sm:p-6 font-sans">
      <div className="pointer-events-none fixed inset-0 bg-grid-pattern opacity-60 dark:opacity-40" />
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[500px] w-[750px] rounded-full bg-gradient-to-tr from-blue-500/15 via-indigo-500/5 to-transparent blur-3xl" />
      </div>

      <div className="relative w-full max-w-md z-10">
        {/* Back Link */}
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-1.5 text-xs font-semibold text-ink-soft hover:text-ink transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Home</span>
        </Link>

        {/* Card */}
        <div className="rounded-2xl border border-line bg-surface/95 p-6 sm:p-8 shadow-2xl backdrop-blur-md">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3.5 mb-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface border border-line shadow-sm">
              <img src="/logo.png" alt="Stratum Logo" className="h-8 w-8 object-contain" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-ink">Stratum Console</h1>
              <p className="text-xs text-ink-soft">Engineered by Jojin John</p>
            </div>
          </div>

          <div className="mb-6 space-y-2">
            <h2 className="text-base font-semibold text-ink">Sign in to your project</h2>
            <p className="text-xs text-ink-soft leading-relaxed">
              Authenticate with your GitHub account to access the Stratum Database Console, API Keys, Realtime Streams, and S3 Storage.
            </p>
          </div>

          {/* GitHub Sign in Button */}
          <a
            href="/api/auth/github"
            className="flex h-11 w-full items-center justify-center gap-2.5 rounded-xl bg-[#111827] text-white font-semibold text-sm shadow-md hover:bg-[#1f2937] transition-all hover:scale-[1.01] active:scale-[0.99] dark:bg-white dark:text-black dark:hover:bg-slate-200"
          >
            <Github className="h-4 w-4" />
            <span>Continue with GitHub</span>
          </a>

          {/* Feature Highlights List */}
          <div className="mt-8 border-t border-line pt-6 space-y-3 text-xs text-ink-soft">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="h-4 w-4 text-positive shrink-0" />
              <span>Full PostgreSQL 18.6 Schema & Table Management</span>
            </div>
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="h-4 w-4 text-positive shrink-0" />
              <span>Zero-latency Hyperdrive Connection Pooling</span>
            </div>
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="h-4 w-4 text-positive shrink-0" />
              <span>Auto-generated REST & OpenAPI 3.1 Endpoints</span>
            </div>
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="h-4 w-4 text-positive shrink-0" />
              <span>Realtime Table Subscriptions & S3 Storage</span>
            </div>
          </div>

          {/* Footer note */}
          <div className="mt-6 border-t border-line pt-4 text-center">
            <p className="text-2xs text-ink-faint">
              Protected by Stratum Security Engine · Developed by Jojin John
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
