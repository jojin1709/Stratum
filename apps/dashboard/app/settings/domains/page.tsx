'use client';

import { useState } from 'react';
import { Globe, Plus, Check, Trash2, ShieldCheck, RefreshCw, Copy } from 'lucide-react';
import { PageHeader } from '@/components/shell';
import { Button, Field, Input, Panel, StatusDot, Tag } from '@/components/primitives';

interface CustomDomain {
  domain: string;
  target: string;
  status: 'active' | 'pending_verification';
  ssl: 'active' | 'issuing';
  created_at: string;
}

const INITIAL_DOMAINS: CustomDomain[] = [
  {
    domain: 'api.stratum.sh',
    target: 'stratum-api.jojin1709.workers.dev',
    status: 'active',
    ssl: 'active',
    created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
  },
];

export default function DomainsPage() {
  const [domains, setDomains] = useState<CustomDomain[]>(INITIAL_DOMAINS);
  const [newDomain, setNewDomain] = useState('');
  const [adding, setAdding] = useState(false);

  const handleAddDomain = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDomain.trim()) return;

    const dom: CustomDomain = {
      domain: newDomain.trim().toLowerCase(),
      target: 'stratum-sh.vercel.app',
      status: 'pending_verification',
      ssl: 'issuing',
      created_at: new Date().toISOString(),
    };

    setDomains([dom, ...domains]);
    setNewDomain('');
    setAdding(false);
  };

  const deleteDomain = (domain: string) => {
    setDomains(domains.filter((d) => d.domain !== domain));
  };

  return (
    <>
      <PageHeader
        title="Custom Domains & SSL Routing"
        description="Attach custom domain names to your Stratum API and Dashboard with automated Cloudflare SSL certificates."
        action={
          <Button size="sm" variant="primary" onClick={() => setAdding(true)}>
            <Plus className="h-3.5 w-3.5" /> Add Custom Domain
          </Button>
        }
      />

      {adding && (
        <Panel title="Attach Custom Domain" className="mb-6">
          <form onSubmit={handleAddDomain} className="p-4 space-y-4 max-w-md">
            <Field label="Domain Name" hint="e.g. api.yourdomain.com or data.mycompany.io">
              <Input
                placeholder="api.yourcompany.com"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                autoFocus
                required
              />
            </Field>

            <div className="flex gap-2 pt-2 border-t border-line">
              <Button type="submit" variant="primary">Add Domain</Button>
              <Button type="button" onClick={() => setAdding(false)}>Cancel</Button>
            </div>
          </form>
        </Panel>
      )}

      <div className="space-y-4">
        <Panel title={`Configured Domains (${domains.length})`}>
          <ul className="divide-y divide-line">
            {domains.map((d) => (
              <li key={d.domain} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <StatusDot tone={d.status === 'active' ? 'positive' : 'caution'} />
                      <h4 className="font-semibold text-ink text-sm font-mono">{d.domain}</h4>
                      <Tag tone={d.ssl === 'active' ? 'positive' : 'neutral'}>
                        SSL: {d.ssl.toUpperCase()}
                      </Tag>
                    </div>
                    <p className="text-2xs text-ink-soft">
                      Routes requests directly to Cloudflare Edge / Vercel Anycast.
                    </p>
                  </div>

                  <Button size="sm" variant="ghost" onClick={() => deleteDomain(d.domain)} aria-label="Remove domain">
                    <Trash2 className="h-3.5 w-3.5 text-critical" />
                  </Button>
                </div>

                <div className="rounded-xl border border-line bg-sunken p-3 text-xs space-y-2">
                  <span className="font-semibold text-ink-soft text-2xs uppercase">Required DNS CNAME Record</span>
                  <div className="grid gap-2 sm:grid-cols-3 font-mono text-2xs">
                    <div>
                      <span className="text-ink-faint block">Type:</span>
                      <strong className="text-ink">CNAME</strong>
                    </div>
                    <div>
                      <span className="text-ink-faint block">Host / Name:</span>
                      <strong className="text-ink">{d.domain.split('.')[0]}</strong>
                    </div>
                    <div>
                      <span className="text-ink-faint block">Target / Value:</span>
                      <strong className="text-blue-600 dark:text-blue-400">{d.target}</strong>
                    </div>
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
