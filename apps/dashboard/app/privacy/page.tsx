'use client';

import Link from 'next/link';
import { Shield, ArrowLeft, Lock, Database, Globe } from 'lucide-react';

export default function PrivacyPage() {
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
            <Shield className="h-4 w-4" /> Legal & Privacy Policy
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-ink">Privacy Policy</h1>
          <p className="text-xs text-ink-faint">Last Updated: September 18, 2026 · Author: Jojin John</p>
        </div>

        <div className="prose dark:prose-invert max-w-none text-xs leading-relaxed text-ink-soft space-y-6">
          <section className="space-y-2">
            <h2 className="text-base font-bold text-ink">1. Overview & Commitment</h2>
            <p>
              Stratum, developed by Jojin John, respects your privacy and is committed to protecting the data processed across our Backend-as-a-Service infrastructure, Cloudflare edge proxies, and PostgreSQL database adapters.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-ink">2. Data We Collect</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Account & Profile Information:</strong> GitHub OAuth profile data (login name, public avatar URL, verified email address).</li>
              <li><strong>Project Metadata:</strong> PostgreSQL schema definitions, table schemas, column types, and storage bucket names.</li>
              <li><strong>Telemetry & Audit Logs:</strong> Timestamp, IP address, user-agent, and HTTP method for security audit logging and rate-limiting enforcement.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-ink">3. Data Ownership & Storage Location</h2>
            <p>
              <strong>You retain 100% ownership of your database records and files.</strong> Stratum does not sell, license, or monetize customer database data. Data is stored directly within your configured PostgreSQL database (Aiven/Neon) and Cloudflare R2 object storage.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-ink">4. Encryption & Security Standards</h2>
            <p>
              All traffic between clients, Vercel proxies, Cloudflare Workers, and PostgreSQL is encrypted in-transit using TLS 1.3. Service secrets and authentication keys are stored using cryptographic HMAC-SHA256 hashes and are never exposed to browser client bundles.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-ink">5. Contact & Data Controller</h2>
            <p>
              For privacy inquiries, data deletion requests, or GDPR/CCPA data export requests, please contact <strong>Jojin John</strong> via GitHub: <a href="https://github.com/jojin1709" target="_blank" rel="noreferrer" className="text-blue-600 font-semibold underline">@jojin1709</a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
