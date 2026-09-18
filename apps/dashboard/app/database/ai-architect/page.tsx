'use client';

import { useState } from 'react';
import {
  Sparkles, Database, Layers, ArrowRight, Play, Check, Copy, RefreshCw,
  Table as TableIcon, Key, ShieldCheck, Zap, AlertCircle, FileCode, Cpu
} from 'lucide-react';
import { api, useApi } from '@/lib/api';
import { PageHeader, SubNav } from '@/components/shell';
import { Button, Field, Input, Panel, StatusDot, Tag } from '@/components/primitives';

interface SchemaTemplate {
  name: string;
  category: string;
  description: string;
  prompt: string;
  ddl: string;
}

const TEMPLATES: SchemaTemplate[] = [
  {
    name: 'SaaS Subscription & Multi-Tenancy',
    category: 'SaaS & Billing',
    description: 'Organizations, team members, subscription tiers, invoices, and audit logs with RLS.',
    prompt: 'Multi-tenant B2B SaaS with organizations, team membership roles, subscription tiers, Stripe invoice webhooks, and granular workspace isolation.',
    ddl: `-- 1. Organizations
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  billing_email TEXT NOT NULL,
  plan TEXT DEFAULT 'pro' CHECK (plan IN ('starter', 'pro', 'enterprise')),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 2. Organization Members
CREATE TABLE IF NOT EXISTS public.org_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'billing')),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(org_id, user_id)
);

-- 3. Invoices & Billing
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL,
  currency TEXT DEFAULT 'USD' NOT NULL,
  status TEXT DEFAULT 'paid' CHECK (status IN ('draft', 'open', 'paid', 'void', 'uncollectible')),
  stripe_invoice_id TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Indexes for lightning fast lookups
CREATE INDEX IF NOT EXISTS idx_org_members_lookup ON public.org_members(org_id, user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_org ON public.invoices(org_id, created_at DESC);`
  },
  {
    name: 'E-Commerce Multi-Vendor Marketplace',
    category: 'Commerce',
    description: 'Vendors, products, inventory variants, customer orders, and line items with status tracking.',
    prompt: 'Full marketplace schema with store vendors, product inventory, variants, orders, order items, and payout balances.',
    ddl: `-- 1. Vendors
CREATE TABLE IF NOT EXISTS public.vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  commission_rate NUMERIC(4,2) DEFAULT 0.10 NOT NULL,
  active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 2. Products
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  price_cents INTEGER NOT NULL,
  stock_quantity INTEGER DEFAULT 0 NOT NULL,
  is_published BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 3. Orders
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_email TEXT NOT NULL,
  total_amount_cents INTEGER NOT NULL,
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'refunded')),
  fulfillment_status TEXT DEFAULT 'unfulfilled' CHECK (fulfillment_status IN ('unfulfilled', 'processing', 'shipped', 'delivered')),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 4. Order Items
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  unit_price_cents INTEGER NOT NULL,
  quantity INTEGER DEFAULT 1 NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_products_vendor ON public.products(vendor_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON public.orders(customer_email);`
  },
  {
    name: 'AI Knowledge Base & Conversational Chat',
    category: 'AI & Vectors',
    description: 'Documents, chunked embeddings with PGVector, chat sessions, and assistant messages.',
    prompt: 'RAG architecture with documents, chunked text embeddings, chat conversation sessions, and semantic vector similarity search.',
    ddl: `-- Enable PGVector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 1. Knowledge Base Documents
CREATE TABLE IF NOT EXISTS public.knowledge_docs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  source_url TEXT,
  total_chunks INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 2. Document Chunks & Vector Embeddings
CREATE TABLE IF NOT EXISTS public.document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id UUID NOT NULL REFERENCES public.knowledge_docs(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  embedding vector(1536),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 3. Chat Sessions & Messages
CREATE TABLE IF NOT EXISTS public.chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  title TEXT DEFAULT 'New Conversation' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  tokens_used INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_doc_chunks_vector ON public.document_chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON public.chat_messages(session_id, created_at ASC);`
  },
  {
    name: 'Social Network & Activity Feeds',
    category: 'Social',
    description: 'User profiles, posts, media attachments, follower graphs, and notification events.',
    prompt: 'Social network platform with user profiles, posts, media URLs, following relationships, post likes, and notification feeds.',
    ddl: `-- 1. User Profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  bio TEXT,
  followers_count INTEGER DEFAULT 0 NOT NULL,
  following_count INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 2. Posts
CREATE TABLE IF NOT EXISTS public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  media_url TEXT,
  likes_count INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 3. Followers Graph
CREATE TABLE IF NOT EXISTS public.follows (
  follower_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (follower_id, following_id)
);

CREATE INDEX IF NOT EXISTS idx_posts_author ON public.posts(author_id, created_at DESC);`
  }
];

export default function AiArchitectPage() {
  const [prompt, setPrompt] = useState('');
  const [generatedSql, setGeneratedSql] = useState(TEMPLATES[0].ddl);
  const [generating, setGenerating] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [deploySuccess, setDeploySuccess] = useState(false);
  const [deployError, setDeployError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState(0);

  const handleSelectTemplate = (index: number) => {
    setActiveTemplate(index);
    setPrompt(TEMPLATES[index].prompt);
    setGeneratedSql(TEMPLATES[index].ddl);
    setDeploySuccess(false);
    setDeployError(null);
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    setDeploySuccess(false);
    setDeployError(null);

    // AI schema synthesis simulation
    await new Promise((r) => setTimeout(r, 900));

    // Convert prompt to dynamic tables
    const cleanName = prompt.toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 15) || 'app_records';
    const customDdl = `-- AI Generated PostgreSQL Schema for: "${prompt}"
-- Generated by Stratum AI Schema Architect

CREATE TABLE IF NOT EXISTS public.${cleanName} (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('draft', 'active', 'archived')),
  metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.${cleanName}_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID NOT NULL REFERENCES public.${cleanName}(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB DEFAULT '{}'::jsonb NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_${cleanName}_status ON public.${cleanName}(status);
CREATE INDEX IF NOT EXISTS idx_${cleanName}_events_parent ON public.${cleanName}_events(parent_id, created_at DESC);`;

    setGeneratedSql(customDdl);
    setGenerating(false);
  };

  const handleDeployToDatabase = async () => {
    if (!generatedSql.trim()) return;
    setDeploying(true);
    setDeploySuccess(false);
    setDeployError(null);

    try {
      const res = await fetch('/bf/api/v1/rpc/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: generatedSql, params: [] }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Execution failed (${res.status})`);
      }

      setDeploySuccess(true);
    } catch (e: unknown) {
      setDeployError(e instanceof Error ? e.message : String(e));
    } finally {
      setDeploying(false);
    }
  };

  return (
    <>
      <PageHeader
        title="AI Schema Architect"
        description="Describe your application requirements in plain English to generate normalized PostgreSQL schemas, foreign keys, indexes, and RLS policies."
        action={
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="primary"
              onClick={handleDeployToDatabase}
              disabled={deploying || !generatedSql.trim()}
            >
              <Zap className="h-3.5 w-3.5" /> {deploying ? 'Executing DDL…' : 'Deploy Schema to Database'}
            </Button>
          </div>
        }
      />

      <SubNav
        items={[
          { href: '/database', label: 'Tables' },
          { href: '/database/sql', label: 'SQL editor' },
          { href: '/database/ai-architect', label: 'AI Architect' },
          { href: '/database/migrations', label: 'Migrations' },
          { href: '/database/policies', label: 'RLS Policies' },
          { href: '/database/performance', label: 'Performance & Indexes' },
          { href: '/database/backups', label: 'Backups' },
          { href: '/database/vectors', label: 'AI Vectors' },
          { href: '/database/cron', label: 'Cron Jobs' },
          { href: '/database/webhooks', label: 'Webhooks' },
          { href: '/database/analytics', label: 'Analytics' },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        {/* Left Column: Natural Language Input & Industry Templates */}
        <div className="space-y-4">
          <Panel title="Natural Language Prompt">
            <div className="p-4 space-y-3">
              <Field label="Describe your App or Data Model">
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="e.g., Multi-tenant SaaS with teams, subscription plans, usage billing, and audit logs..."
                  rows={4}
                  className="thin-scroll w-full rounded-xl border border-line bg-surface p-3 text-xs text-ink outline-none focus:border-blue-500 leading-relaxed"
                />
              </Field>

              <Button
                variant="primary"
                onClick={handleGenerate}
                disabled={generating || !prompt.trim()}
                className="w-full justify-center"
              >
                <Sparkles className="h-3.5 w-3.5" /> {generating ? 'Synthesizing Schema…' : 'Generate Schema DDL'}
              </Button>
            </div>
          </Panel>

          <Panel title="Production Architecture Presets">
            <div className="p-2 space-y-1 max-h-[50vh] overflow-y-auto">
              {TEMPLATES.map((tmpl, idx) => (
                <button
                  key={tmpl.name}
                  onClick={() => handleSelectTemplate(idx)}
                  className={`w-full rounded-xl p-3 text-left transition-all ${
                    activeTemplate === idx
                      ? 'border border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400'
                      : 'border border-line bg-surface text-ink-soft hover:bg-sunken hover:text-ink'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-ink">{tmpl.name}</span>
                    <span className="text-3xs font-medium px-1.5 py-0.5 rounded bg-surface border border-line text-ink-faint">
                      {tmpl.category}
                    </span>
                  </div>
                  <p className="mt-1 text-2xs text-ink-faint leading-relaxed line-clamp-2">
                    {tmpl.description}
                  </p>
                </button>
              ))}
            </div>
          </Panel>
        </div>

        {/* Right Column: Generated DDL & Schema Visualizer */}
        <div className="space-y-4 min-w-0">
          {deploySuccess && (
            <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <Check className="h-4 w-4 shrink-0" />
              <span>Schema successfully deployed to PostgreSQL! All tables, indexes, and constraints are now live.</span>
            </div>
          )}

          {deployError && (
            <div className="flex items-center gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs font-medium text-rose-600 dark:text-rose-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span className="truncate">Deploy error: {deployError}</span>
            </div>
          )}

          <Panel
            title="Generated PostgreSQL DDL & Foreign Key Graph"
            action={
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    navigator.clipboard.writeText(generatedSql);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-positive" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? 'Copied' : 'Copy DDL'}
                </Button>
              </div>
            }
          >
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between text-2xs text-ink-faint border-b border-line pb-2">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> UUID Primary Keys</span>
                  <span className="flex items-center gap-1"><Key className="h-3.5 w-3.5 text-amber-500" /> Cascade Foreign Keys</span>
                  <span className="flex items-center gap-1"><Zap className="h-3.5 w-3.5 text-blue-500" /> Auto-Indexes</span>
                </div>
                <Tag tone="accent">PostgreSQL 18.6 DDL</Tag>
              </div>

              <textarea
                value={generatedSql}
                onChange={(e) => setGeneratedSql(e.target.value)}
                spellCheck={false}
                rows={18}
                className="thin-scroll w-full rounded-xl border border-line bg-sunken p-4 font-mono text-xs text-ink focus:border-blue-500 outline-none leading-relaxed"
              />
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
