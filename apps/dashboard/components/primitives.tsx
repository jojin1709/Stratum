'use client';

import { type ReactNode, type ButtonHTMLAttributes, type InputHTMLAttributes } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import type { ApiError } from '@/lib/api';

export function Button({
  variant = 'default',
  size = 'md',
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'primary' | 'danger' | 'ghost'; size?: 'sm' | 'md' }) {
  const base =
    'inline-flex items-center justify-center gap-1.5 rounded border font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none';
  const sizes = { sm: 'h-7 px-2.5 text-xs', md: 'h-8 px-3 text-[13px]' };
  const variants = {
    default: 'border-line bg-surface text-ink hover:bg-sunken',
    primary: 'border-accent bg-accent text-white hover:opacity-90',
    danger: 'border-line bg-surface text-critical hover:bg-critical/5',
    ghost: 'border-transparent bg-transparent text-ink-soft hover:bg-sunken hover:text-ink',
  };
  return (
    <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`h-8 w-full rounded border border-line bg-surface px-2.5 text-[13px] text-ink placeholder:text-ink-faint ${className}`}
      {...props}
    />
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-ink-soft">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-2xs text-ink-faint">{hint}</span> : null}
    </label>
  );
}

export function Panel({ title, action, children, className = '' }: { title?: React.ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded border border-line bg-surface ${className}`}>
      {title ? (
        <header className="flex h-10 items-center justify-between gap-3 border-b border-line px-3">
          {typeof title === 'string' ? (
            <h2 className="text-[13px] font-semibold text-ink">{title}</h2>
          ) : (
            title
          )}
          {action}
        </header>
      ) : null}
      {children}
    </section>
  );
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 p-6 text-[13px] text-ink-faint" role="status">
      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
      {label}
    </div>
  );
}

/** Errors say what happened and what to do — never a bare "something went wrong". */
export function ErrorNote({ error, onRetry }: { error: ApiError; onRetry?: () => void }) {
  return (
    <div className="flex items-start gap-2.5 rounded border border-critical/30 bg-critical/5 p-3" role="alert">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-critical" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] text-ink">{error.message}</p>
        <p className="mt-0.5 font-mono text-2xs text-ink-faint">{error.code}</p>
        {error.details ? (
          <pre className="thin-scroll mt-2 max-h-32 overflow-auto rounded bg-sunken p-2 font-mono text-2xs text-ink-soft">
            {JSON.stringify(error.details, null, 2)}
          </pre>
        ) : null}
      </div>
      {onRetry ? <Button size="sm" onClick={onRetry}>Try again</Button> : null}
    </div>
  );
}

/** Empty states are an invitation to act, so each one names the next step. */
export function Empty({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <p className="max-w-sm text-[13px] text-ink-soft">{title}</p>
      {action}
    </div>
  );
}

export function StatusDot({ tone }: { tone: 'positive' | 'caution' | 'critical' | 'idle' }) {
  const colors = {
    positive: 'bg-positive', caution: 'bg-caution', critical: 'bg-critical', idle: 'bg-ink-faint',
  };
  return <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${colors[tone]}`} aria-hidden />;
}

export function Tag({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'accent' | 'positive' | 'critical' }) {
  const tones = {
    neutral: 'border-line bg-sunken text-ink-soft',
    accent: 'border-accent/30 bg-accent-soft text-accent',
    positive: 'border-positive/30 bg-positive/10 text-positive',
    critical: 'border-critical/30 bg-critical/10 text-critical',
  };
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-px font-mono text-2xs ${tones[tone]}`}>
      {children}
    </span>
  );
}
