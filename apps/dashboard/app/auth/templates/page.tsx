'use client';

import { useState } from 'react';
import { Mail, Sparkles, Send, Check, Eye, Code2 } from 'lucide-react';
import { PageHeader } from '@/components/shell';
import { Button, Field, Input, Panel, Tag } from '@/components/primitives';

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  bodyHtml: string;
}

const INITIAL_TEMPLATES: EmailTemplate[] = [
  {
    id: 'tpl_welcome',
    name: 'User Welcome & Confirmation',
    subject: 'Welcome to Stratum — Confirm your account',
    bodyHtml: `<h2>Welcome to Stratum!</h2>
<p>Hi {{ .User.Email }},</p>
<p>Thanks for creating an account. Click the button below to confirm your email and activate your workspace access:</p>
<p><a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:10px 20px;background:#2563eb;color:#ffffff;border-radius:8px;text-decoration:none;font-weight:bold;">Confirm Email Address</a></p>
<p>If you did not sign up for Stratum, you can safely ignore this email.</p>`,
  },
  {
    id: 'tpl_magic_link',
    name: 'Passwordless Magic Link Sign-In',
    subject: 'Your Stratum Magic Sign-In Link',
    bodyHtml: `<h2>Sign in to Stratum</h2>
<p>Hi {{ .User.Email }},</p>
<p>Click below to sign in instantly without a password. This link expires in 15 minutes:</p>
<p><a href="{{ .MagicLinkURL }}" style="display:inline-block;padding:10px 20px;background:#111827;color:#ffffff;border-radius:8px;text-decoration:none;font-weight:bold;">Sign In to Console</a></p>`,
  },
  {
    id: 'tpl_reset_password',
    name: 'Password Reset Notification',
    subject: 'Reset your Stratum password',
    bodyHtml: `<h2>Password Reset Request</h2>
<p>We received a request to reset your password. Click the link below to set a new password:</p>
<p><a href="{{ .ResetPasswordURL }}" style="display:inline-block;padding:10px 20px;background:#dc2626;color:#ffffff;border-radius:8px;text-decoration:none;font-weight:bold;">Reset Password</a></p>`,
  },
];

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<EmailTemplate[]>(INITIAL_TEMPLATES);
  const [selectedId, setSelectedId] = useState<string>('tpl_welcome');
  const [saved, setSaved] = useState(false);

  const activeTemplate = templates.find((t) => t.id === selectedId) || templates[0];

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <>
      <PageHeader
        title="Email & Notification Templates"
        description="Customize user onboarding, magic link sign-in, and password reset email templates with live HTML preview."
      />

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Template Selector & Editor */}
        <div className="lg:col-span-6 space-y-4">
          <Panel title="Email Template Editor">
            <div className="p-4 space-y-4">
              <div className="flex flex-wrap gap-2 pb-2 border-b border-line">
                {templates.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedId(t.id)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                      activeTemplate.id === t.id
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'border border-line bg-surface text-ink-soft hover:text-ink'
                    }`}
                  >
                    {t.name}
                  </button>
                ))}
              </div>

              <Field label="Subject Line">
                <Input
                  value={activeTemplate.subject}
                  onChange={(e) => {
                    const updated = { ...activeTemplate, subject: e.target.value };
                    setTemplates(templates.map((t) => (t.id === activeTemplate.id ? updated : t)));
                  }}
                  className="text-xs"
                />
              </Field>

              <Field label="HTML Email Body" hint="Interpolate variables: {{ .User.Email }}, {{ .ConfirmationURL }}">
                <textarea
                  value={activeTemplate.bodyHtml}
                  onChange={(e) => {
                    const updated = { ...activeTemplate, bodyHtml: e.target.value };
                    setTemplates(templates.map((t) => (t.id === activeTemplate.id ? updated : t)));
                  }}
                  spellCheck={false}
                  rows={10}
                  className="thin-scroll w-full rounded-xl border border-line bg-surface p-3 font-mono text-xs text-ink focus:border-blue-500 outline-none"
                />
              </Field>

              <div className="flex justify-end pt-2 border-t border-line">
                <Button variant="primary" onClick={handleSave}>
                  {saved ? <Check className="h-3.5 w-3.5 text-positive" /> : null}
                  {saved ? 'Saved Successfully' : 'Save Template'}
                </Button>
              </div>
            </div>
          </Panel>
        </div>

        {/* Live HTML Preview */}
        <div className="lg:col-span-6 space-y-4">
          <Panel title="Rendered HTML Preview">
            <div className="p-4">
              <div className="rounded-2xl border border-line bg-white p-6 text-slate-900 shadow-sm min-h-[350px]">
                <div className="mb-4 pb-3 border-b border-slate-200">
                  <p className="text-2xs text-slate-500 font-semibold uppercase">Subject:</p>
                  <p className="text-xs font-bold text-slate-900">{activeTemplate.subject}</p>
                </div>
                <div
                  className="prose prose-sm text-slate-800"
                  dangerouslySetInnerHTML={{
                    __html: activeTemplate.bodyHtml
                      .replace(/\{\{\s*\.User\.Email\s*\}\}/g, 'developer@example.com')
                      .replace(/\{\{\s*\.ConfirmationURL\s*\}\}/g, 'https://stratum-sh.vercel.app/confirm?token=xyz')
                      .replace(/\{\{\s*\.MagicLinkURL\s*\}\}/g, 'https://stratum-sh.vercel.app/auth/verify?token=xyz')
                      .replace(/\{\{\s*\.ResetPasswordURL\s*\}\}/g, 'https://stratum-sh.vercel.app/reset?token=xyz'),
                  }}
                />
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
