'use client';

import { useState } from 'react';
import { Sparkles, Search, Plus, Database, Layers, Check, Zap, Play, Terminal } from 'lucide-react';
import { PageHeader, SubNav } from '@/components/shell';
import { Button, Empty, Field, Input, Panel, StatusDot, Tag } from '@/components/primitives';

interface VectorCollection {
  id: string;
  name: string;
  dimensions: number;
  model: string;
  indexType: 'HNSW' | 'IVFFlat';
  vectorsCount: number;
  metric: 'cosine' | 'l2' | 'inner_product';
}

const INITIAL_COLLECTIONS: VectorCollection[] = [
  {
    id: 'col_docs_1536',
    name: 'document_embeddings',
    dimensions: 1536,
    model: 'OpenAI text-embedding-3-small',
    indexType: 'HNSW',
    vectorsCount: 4280,
    metric: 'cosine',
  },
  {
    id: 'col_products_768',
    name: 'product_catalog_vectors',
    dimensions: 768,
    model: 'Gemini embedding-001',
    indexType: 'HNSW',
    vectorsCount: 15200,
    metric: 'cosine',
  },
];

export default function VectorsPage() {
  const [collections, setCollections] = useState<VectorCollection[]>(INITIAL_COLLECTIONS);
  const [queryText, setQueryText] = useState('How do I configure connection pooling for PostgreSQL on Cloudflare Workers?');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<{ id: string; content: string; similarity: number }[] | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setSearching(true);
    await new Promise((r) => setTimeout(r, 350));

    setSearchResults([
      {
        id: 'doc_492',
        content: 'Cloudflare Hyperdrive accelerates PostgreSQL by pooling connections at the global edge network and caching read queries.',
        similarity: 0.942,
      },
      {
        id: 'doc_188',
        content: 'Use the PostgresAdapter class in @stratum/database to execute queries over Hyperdrive edge sockets with immediate client lifecycle management.',
        similarity: 0.891,
      },
      {
        id: 'doc_312',
        content: 'Database connection strings should use sslmode=require when connecting to production Aiven or Neon Postgres clusters.',
        similarity: 0.814,
      },
    ]);
    setSearching(false);
  };

  return (
    <>
      <PageHeader
        title="AI Vector Embeddings & PGVector Studio"
        description="Store, index with HNSW, and execute cosine similarity semantic search for LLM RAG pipelines."
        action={
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-xs text-positive font-semibold">
              <StatusDot tone="positive" /> pgvector 0.7.4 Active
            </span>
          </div>
        }
      />
      <SubNav
        items={[
          { href: '/database', label: 'Tables' },
          { href: '/database/sql', label: 'SQL editor' },
          { href: '/database/migrations', label: 'Migrations' },
          { href: '/database/webhooks', label: 'Webhooks' },
          { href: '/database/policies', label: 'RLS Policies' },
          { href: '/database/analytics', label: 'Analytics' },
          { href: '/database/backups', label: 'Backups & PITR' },
          { href: '/database/vectors', label: 'AI Vectors' },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Vector Collections List */}
        <div className="lg:col-span-5 space-y-4">
          <Panel title={`Vector Collections (${collections.length})`}>
            <ul className="divide-y divide-line">
              {collections.map((c) => (
                <li key={c.id} className="p-4 space-y-2 hover:bg-surface-hover/30 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-mono font-bold text-xs text-ink">
                      <Sparkles className="h-3.5 w-3.5 text-blue-500" />
                      {c.name}
                    </div>
                    <Tag tone="accent">{c.dimensions}d</Tag>
                  </div>
                  <div className="flex items-center justify-between text-2xs text-ink-soft">
                    <span>{c.model}</span>
                    <span className="font-mono">{c.vectorsCount.toLocaleString()} vectors</span>
                  </div>
                  <div className="flex items-center gap-2 pt-1 border-t border-line/60 text-2xs text-ink-faint">
                    <span>Index: <Tag tone="neutral">{c.indexType}</Tag></span>
                    <span>Metric: <Tag tone="neutral">{c.metric}</Tag></span>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        {/* Semantic Similarity Search Tester */}
        <div className="lg:col-span-7 space-y-4">
          <Panel title="Semantic Similarity Search Runner">
            <form onSubmit={handleSearch} className="p-4 space-y-3">
              <Field label="Natural Language Query">
                <div className="flex gap-2">
                  <Input
                    value={queryText}
                    onChange={(e) => setQueryText(e.target.value)}
                    className="text-xs"
                    placeholder="Search documents by semantic meaning..."
                  />
                  <Button type="submit" variant="primary" disabled={searching || !queryText.trim()}>
                    <Search className="h-3.5 w-3.5" /> {searching ? 'Searching…' : 'Search Vectors'}
                  </Button>
                </div>
              </Field>

              {searchResults && (
                <div className="space-y-2.5 pt-3 border-t border-line">
                  <span className="text-2xs font-semibold text-ink-faint uppercase">Top Semantic Matches</span>
                  {searchResults.map((r, i) => (
                    <div key={r.id} className="rounded-xl border border-line bg-sunken p-3 space-y-1">
                      <div className="flex items-center justify-between text-2xs">
                        <span className="font-mono font-bold text-ink">#{i + 1} · {r.id}</span>
                        <span className="font-mono text-positive font-bold">{(r.similarity * 100).toFixed(1)}% match</span>
                      </div>
                      <p className="text-xs text-ink-soft leading-relaxed">{r.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </form>
          </Panel>
        </div>
      </div>
    </>
  );
}
