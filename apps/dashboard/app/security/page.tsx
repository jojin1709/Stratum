'use client';

import Link from 'next/link';
import { ShieldCheck, ArrowLeft, Lock, Key, AlertTriangle, CheckCircle, Terminal } from 'lucide-react';

export default function SecurityPage() {
  return (
    <div className="min-h-screen bg-canvas text-ink py-12 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink hover:bg-sunken transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Return to Stratum Home
        </Link>

        <div className="space-y-2 border-b border-line pb-6">
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-semibold text-xs uppercase tracking-wider">
            <ShieldCheck className="h-4 w-4" /> Security & Trust Center
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-ink">Security & Responsible Disclosure</h1>
          <p className="text-xs text-ink-faint">Security Lead: Jojin John (@jojin1709) · Ethical Hacker & Security Researcher</p>
        </div>

        <div className="prose dark:prose-invert max-w-none text-xs leading-relaxed text-ink-soft space-y-6">
          <section className="space-y-2">
            <h2 className="text-base font-bold text-ink">1. Security Architecture & Threat Modeling</h2>
            <p>
              Stratum is built with an adversarial security mindset. Designed by an ethical hacker and bug bounty hunter, our defense-in-depth architecture prevents common web vulnerabilities by default:
            </p>
            <div className="grid gap-3 sm:grid-cols-2 pt-2">
              <div className="rounded-xl border border-line bg-surface p-3 space-y-1">
                <strong className="text-ink font-bold">SQL Injection Immunity:</strong>
                <p className="text-2xs">All DML queries are parameterized with strict identifier regex allowlists.</p>
              </div>
              <div className="rounded-xl border border-line bg-surface p-3 space-y-1">
                <strong className="text-ink font-bold">Isolated V8 Runtimes:</strong>
                <p className="text-2xs">Edge functions run in secure isolates with no Node.js filesystem access.</p>
              </div>
              <div className="rounded-xl border border-line bg-surface p-3 space-y-1">
                <strong className="text-ink font-bold">Strict HTTP Security:</strong>
                <p className="text-2xs">HSTS Preload, X-Frame-Options: DENY, and strict CSP policies.</p>
              </div>
              <div className="rounded-xl border border-line bg-surface p-3 space-y-1">
                <strong className="text-ink font-bold">Cryptographic Signing:</strong>
                <p className="text-2xs">HMAC-SHA256 constant-time comparison prevents timing attacks.</p>
              </div>
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-ink">2. Responsible Vulnerability Disclosure</h2>
            <p>
              We welcome reports from independent security researchers and bug bounty hunters. If you discover a potential vulnerability in Stratum, please disclose it responsibly:
            </p>
            <div className="rounded-xl border border-line bg-sunken p-4 font-mono text-xs text-ink-soft space-y-1">
              <p>Email: <strong>security@stratum.sh</strong> or GitHub Security Advisories</p>
              <p>GitHub Profile: <a href="https://github.com/jojin1709" target="_blank" rel="noreferrer" className="text-blue-600 underline">@jojin1709</a></p>
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-ink">3. Vulnerability Response SLA</h2>
            <p>
              We aim to acknowledge all security reports within <strong>24 hours</strong> and deploy patches to production within <strong>48 hours</strong> of verification.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
