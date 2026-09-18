'use client';

import Link from 'next/link';
import { FileText, ArrowLeft, Shield, CheckCircle2 } from 'lucide-react';

export default function TermsPage() {
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
            <FileText className="h-4 w-4" /> Legal & Terms of Service
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-ink">Terms of Service</h1>
          <p className="text-xs text-ink-faint">Effective Date: September 18, 2026 · Copyright © 2026 Jojin John. All Rights Reserved.</p>
        </div>

        <div className="prose dark:prose-invert max-w-none text-xs leading-relaxed text-ink-soft space-y-6">
          <section className="space-y-2">
            <h2 className="text-base font-bold text-ink">1. Acceptance of Terms</h2>
            <p>
              By accessing or using Stratum (the "Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, do not access or use the platform.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-ink">2. Proprietary License & Intellectual Property</h2>
            <p>
              Stratum, including its source code, architecture, CLI, edge proxy adapters, and brand assets, is the proprietary software of <strong>Jojin John</strong>. All rights reserved. Unauthorized reproduction, distribution, sublicensing, or reverse engineering is strictly prohibited without express written authorization.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-ink">3. Acceptable Use Policy</h2>
            <p>
              You agree not to use Stratum to:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Violate any local, national, or international laws or regulations.</li>
              <li>Attempt to bypass rate-limiting, authentication controls, or isolate boundaries.</li>
              <li>Transmit malware, unauthorized exploits, or facilitate distributed denial-of-service (DDoS) attacks.</li>
              <li>Store illegal, abusive, or infringing digital content.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-ink">4. Service Availability & SLA</h2>
            <p>
              Stratum provides high-availability edge routing across Cloudflare's global Anycast network and PostgreSQL replication clusters. The Service is provided on an "AS IS" and "AS AVAILABLE" basis without warranties of any kind.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-ink">5. Governing Law</h2>
            <p>
              These Terms shall be governed and construed in accordance with the applicable laws of India, without regard to its conflict of law provisions.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
