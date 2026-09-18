'use client';

import { useRef, useState } from 'react';
import { Download, FolderPlus, Trash2, Upload } from 'lucide-react';
import { api, useApi, RequestFailed, type ApiError } from '@/lib/api';
import { bytes, timestamp } from '@/lib/format';
import { PageHeader } from '@/components/shell';
import { DataTable } from '@/components/data-table';
import { Button, Empty, ErrorNote, Input, Panel, Spinner, Tag } from '@/components/primitives';

interface Bucket { name: string; public: boolean; createdAt: string | null; fileCount: number; sizeBytes: number }
interface ObjectInfo { key: string; size: number; contentType: string; lastModified: string }

export default function StoragePage() {
  const buckets = useApi<{ data: Bucket[]; driver: string }>('/storage/v1/buckets');
  const [selected, setSelected] = useState<string | null>(null);
  const [newBucket, setNewBucket] = useState('');
  const [error, setError] = useState<ApiError | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const objects = useApi<{ data: ObjectInfo[] }>(selected ? `/storage/v1/buckets/${selected}/objects` : null);

  const fail = (e: unknown) =>
    setError(e instanceof RequestFailed ? e.apiError : { code: 'UNKNOWN_ERROR', message: String(e) });

  const createBucket = async () => {
    setError(null);
    try {
      await api('/storage/v1/buckets', { method: 'POST', body: JSON.stringify({ name: newBucket }) });
      setNewBucket('');
      buckets.reload();
    } catch (e) { fail(e); }
  };

  const deleteBucket = async (name: string) => {
    if (!window.confirm(`Delete bucket "${name}" and every file in it?`)) return;
    try {
      await api(`/storage/v1/buckets/${name}`, { method: 'DELETE' });
      if (selected === name) setSelected(null);
      buckets.reload();
    } catch (e) { fail(e); }
  };

  const upload = async (file: File) => {
    if (!selected) return;
    setUploading(true);
    setError(null);
    try {
      const res = await fetch(`/bf/storage/v1/buckets/${selected}/objects/${encodeURIComponent(file.name)}`, {
        method: 'PUT',
        headers: { 'content-type': file.type || 'application/octet-stream' },
        body: file,
      });
      if (!res.ok) {
        const wrapped = (await res.json().catch(() => null)) as { error?: ApiError } | null;
        throw new RequestFailed(wrapped?.error ?? { code: 'STORAGE_ERROR', message: `Upload failed (${res.status}).` }, res.status);
      }
      objects.reload();
      buckets.reload();
    } catch (e) { fail(e); } finally { setUploading(false); }
  };

  const removeObject = async (key: string) => {
    if (!selected) return;
    try {
      await api(`/storage/v1/buckets/${selected}/objects/${key.split('/').map(encodeURIComponent).join('/')}`, { method: 'DELETE' });
      objects.reload();
      buckets.reload();
    } catch (e) { fail(e); }
  };

  const list = buckets.data?.data ?? [];

  return (
    <>
      <PageHeader
        title="Storage"
        description="Buckets and files, served by the configured storage driver."
        action={buckets.data ? <Tag tone="accent">{buckets.data.driver} driver</Tag> : null}
      />

      {error ? <div className="mb-4"><ErrorNote error={error} /></div> : null}

      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <div className="space-y-4">
          <Panel title={`Buckets (${list.length})`}>
            {buckets.error ? (
              <div className="p-3"><ErrorNote error={buckets.error} onRetry={buckets.reload} /></div>
            ) : buckets.loading ? (
              <Spinner />
            ) : list.length === 0 ? (
              <Empty title="No buckets yet. Create one below to start storing files." />
            ) : (
              <ul className="divide-y divide-line">
                {list.map((b) => (
                  <li key={b.name} className="flex items-center gap-2 px-3 py-2">
                    <button
                      onClick={() => setSelected(b.name)}
                      className={`min-w-0 flex-1 text-left ${selected === b.name ? 'text-accent' : 'text-ink hover:text-accent'}`}
                    >
                      <span className="block truncate font-mono text-xs">{b.name}</span>
                      <span className="nums block text-2xs text-ink-faint">
                        {b.fileCount} file{b.fileCount === 1 ? '' : 's'} · {bytes(b.sizeBytes)}
                      </span>
                    </button>
                    <Button size="sm" variant="ghost" onClick={() => deleteBucket(b.name)} aria-label={`Delete bucket ${b.name}`}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="New bucket">
            <div className="space-y-2 p-3">
              <Input
                value={newBucket}
                onChange={(e) => setNewBucket(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void createBucket(); }}
                placeholder="avatars"
                className="font-mono text-xs"
              />
              <p className="text-2xs text-ink-faint">3–63 characters, lowercase letters, digits and hyphens.</p>
              <Button size="sm" variant="primary" onClick={createBucket} disabled={!newBucket.trim()}>
                <FolderPlus className="h-3.5 w-3.5" /> Create bucket
              </Button>
            </div>
          </Panel>
        </div>

        <Panel
          title={selected ? `${selected} · files` : 'Files'}
          action={
            selected ? (
              <>
                <input
                  ref={fileInput}
                  type="file"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ''; }}
                />
                <Button size="sm" variant="primary" onClick={() => fileInput.current?.click()} disabled={uploading}>
                  <Upload className="h-3.5 w-3.5" /> {uploading ? 'Uploading…' : 'Upload file'}
                </Button>
              </>
            ) : null
          }
        >
          {!selected ? (
            <Empty title="Pick a bucket to see what is in it." />
          ) : objects.loading ? (
            <Spinner />
          ) : objects.error ? (
            <div className="p-3"><ErrorNote error={objects.error} onRetry={objects.reload} /></div>
          ) : (
            <DataTable
              columns={[
                { key: 'key', label: 'Key' },
                { key: 'contentType', label: 'Type' },
                { key: 'size', label: 'Size', align: 'right', render: (r) => <span className="nums text-xs">{bytes(Number(r.size))}</span> },
                { key: 'lastModified', label: 'Modified', render: (r) => <span className="nums text-xs text-ink-soft">{timestamp(String(r.lastModified))}</span> },
                {
                  key: 'actions',
                  label: '',
                  align: 'right',
                  render: (r) => (
                    <span className="flex justify-end gap-1">
                      <a
                        href={`/bf/storage/v1/buckets/${selected}/objects/${String(r.key).split('/').map(encodeURIComponent).join('/')}`}
                        className="inline-flex h-7 w-7 items-center justify-center rounded text-ink-faint hover:bg-sunken hover:text-ink"
                        aria-label={`Download ${String(r.key)}`}
                      >
                        <Download className="h-3 w-3" />
                      </a>
                      <Button size="sm" variant="ghost" onClick={() => removeObject(String(r.key))} aria-label={`Delete ${String(r.key)}`}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </span>
                  ),
                },
              ]}
              rows={(objects.data?.data ?? []) as unknown as Record<string, unknown>[]}
              emptyLabel="This bucket is empty. Upload a file to get started."
            />
          )}
        </Panel>
      </div>
    </>
  );
}
