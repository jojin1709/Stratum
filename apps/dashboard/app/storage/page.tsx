'use client';

import { useRef, useState } from 'react';
import {
  Download, FolderPlus, Trash2, Upload, File, Image as ImageIcon,
  Copy, Check, Eye, X, Plus, HardDrive, RefreshCw
} from 'lucide-react';
import { api, useApi, RequestFailed, type ApiError } from '@/lib/api';
import { bytes, timestamp } from '@/lib/format';
import { PageHeader } from '@/components/shell';
import { DataTable } from '@/components/data-table';
import { Button, Empty, ErrorNote, Input, Panel, Spinner, Tag, StatusDot } from '@/components/primitives';

interface Bucket { name: string; public: boolean; createdAt: string | null; fileCount: number; sizeBytes: number }
interface ObjectInfo { key: string; size: number; contentType: string; lastModified: string }

export default function StoragePage() {
  const buckets = useApi<{ data: Bucket[]; driver: string }>('/storage/v1/buckets');
  const [selected, setSelected] = useState<string | null>(null);
  const [newBucket, setNewBucket] = useState('');
  const [error, setError] = useState<ApiError | null>(null);
  const [uploading, setUploading] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [previewObject, setPreviewObject] = useState<ObjectInfo | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const objects = useApi<{ data: ObjectInfo[] }>(selected ? `/storage/v1/buckets/${selected}/objects` : null);

  const fail = (e: unknown) =>
    setError(e instanceof RequestFailed ? e.apiError : { code: 'UNKNOWN_ERROR', message: String(e) });

  const createBucket = async () => {
    if (!newBucket.trim()) return;
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

  const handleUploadFiles = async (files: FileList | File[]) => {
    if (!selected || files.length === 0) return;
    setUploading(true);
    setError(null);

    for (const file of Array.from(files)) {
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
      } catch (e) {
        fail(e);
        break;
      }
    }

    objects.reload();
    buckets.reload();
    setUploading(false);
  };

  const removeObject = async (key: string) => {
    if (!selected) return;
    if (!window.confirm(`Delete file "${key}" permanently?`)) return;
    try {
      await api(`/storage/v1/buckets/${selected}/objects/${key.split('/').map(encodeURIComponent).join('/')}`, { method: 'DELETE' });
      objects.reload();
      buckets.reload();
    } catch (e) { fail(e); }
  };

  const copyPublicUrl = (key: string) => {
    const url = `https://stratum-api.jojin1709.workers.dev/storage/v1/buckets/${selected}/objects/${key}`;
    navigator.clipboard.writeText(url);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const list = buckets.data?.data ?? [];

  if (!selected && list.length > 0) {
    setSelected(list[0].name);
  }

  return (
    <>
      <PageHeader
        title="Storage"
        description="Manage S3/R2 storage buckets, drag-and-drop file uploads, and public media URLs."
        action={buckets.data ? <Tag tone="accent">{buckets.data.driver} driver active</Tag> : null}
      />

      {error ? <div className="mb-4"><ErrorNote error={error} /></div> : null}

      {/* Lightbox Preview Modal */}
      {previewObject && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <div className="relative max-h-[85vh] max-w-2xl overflow-hidden rounded-2xl border border-line bg-surface p-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-line pb-2 mb-3">
              <span className="font-mono text-xs font-bold text-ink truncate max-w-md">{previewObject.key}</span>
              <button onClick={() => setPreviewObject(null)} className="text-ink-faint hover:text-ink">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex items-center justify-center bg-sunken rounded-xl p-4 min-h-[250px]">
              {previewObject.contentType.startsWith('image/') ? (
                <img
                  src={`/bf/storage/v1/buckets/${selected}/objects/${previewObject.key}`}
                  alt={previewObject.key}
                  className="max-h-[60vh] max-w-full rounded-lg object-contain"
                />
              ) : (
                <div className="text-center text-xs text-ink-soft space-y-2">
                  <File className="h-12 w-12 mx-auto text-ink-faint" />
                  <p>Binary object ({previewObject.contentType})</p>
                  <a
                    href={`/bf/storage/v1/buckets/${selected}/objects/${previewObject.key}`}
                    download={previewObject.key}
                    className="inline-flex items-center gap-1.5 text-blue-600 font-semibold"
                  >
                    <Download className="h-3.5 w-3.5" /> Download File
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <div className="space-y-4">
          <Panel title={`Buckets (${list.length})`}>
            {buckets.error ? (
              <div className="p-3"><ErrorNote error={buckets.error} onRetry={buckets.reload} /></div>
            ) : buckets.loading ? (
              <Spinner />
            ) : list.length === 0 ? (
              <Empty title="No buckets created yet." />
            ) : (
              <ul className="divide-y divide-line">
                {list.map((b) => (
                  <li key={b.name} className="flex items-center gap-2 px-3 py-2">
                    <button
                      onClick={() => setSelected(b.name)}
                      className={`min-w-0 flex-1 text-left font-mono text-xs font-semibold ${selected === b.name ? 'text-blue-600 dark:text-blue-400' : 'text-ink hover:text-blue-600'}`}
                    >
                      {b.name}
                    </button>
                    <span className="nums text-2xs text-ink-faint">{bytes(b.sizeBytes)}</span>
                    <button onClick={() => deleteBucket(b.name)} className="p-1 text-ink-faint hover:text-critical">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="border-t border-line p-3 flex gap-2">
              <Input
                placeholder="new-bucket-name"
                value={newBucket}
                onChange={(e) => setNewBucket(e.target.value)}
                className="h-8 text-xs font-mono"
              />
              <Button size="sm" variant="primary" onClick={createBucket} disabled={!newBucket.trim()}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </Panel>
        </div>

        <div className="space-y-4">
          {!selected ? (
            <Panel><Empty title="Select or create a bucket to view and upload files." /></Panel>
          ) : (
            <>
              {/* Drag and drop upload zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files) void handleUploadFiles(e.dataTransfer.files);
                }}
                className={`rounded-2xl border-2 border-dashed p-6 text-center transition-all ${
                  isDragging
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-line bg-surface hover:border-blue-500/50'
                }`}
              >
                <input
                  type="file"
                  ref={fileInput}
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) void handleUploadFiles(e.target.files);
                  }}
                />
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 mb-2">
                  <Upload className="h-6 w-6" />
                </div>
                <h4 className="text-xs font-bold text-ink">
                  {uploading ? 'Uploading files to R2/S3 storage...' : `Drag & drop files into ${selected}`}
                </h4>
                <p className="mt-1 text-2xs text-ink-soft">
                  or <button type="button" onClick={() => fileInput.current?.click()} className="text-blue-600 font-semibold underline">browse from your computer</button>
                </p>
              </div>

              <Panel
                title={`Objects in "${selected}" (${objects.data?.data.length || 0})`}
                action={
                  <Button size="sm" onClick={() => objects.reload()}>
                    <RefreshCw className="h-3 w-3" /> Refresh
                  </Button>
                }
              >
                {objects.loading ? (
                  <Spinner label="Loading objects..." />
                ) : (objects.data?.data.length || 0) === 0 ? (
                  <Empty title="No files uploaded to this bucket yet." />
                ) : (
                  <DataTable
                    columns={[
                      {
                        key: 'key',
                        label: 'File Name',
                        render: (r) => {
                          const obj = r as unknown as ObjectInfo;
                          const isImg = obj.contentType?.startsWith('image/');
                          return (
                            <div className="flex items-center gap-2">
                              {isImg ? (
                                <ImageIcon className="h-4 w-4 text-emerald-500 shrink-0" />
                              ) : (
                                <File className="h-4 w-4 text-blue-500 shrink-0" />
                              )}
                              <span className="font-mono text-xs font-semibold text-ink truncate max-w-xs">{obj.key}</span>
                            </div>
                          );
                        },
                      },
                      {
                        key: 'size',
                        label: 'Size',
                        render: (r) => <span className="nums text-2xs text-ink-soft">{bytes(Number(r.size))}</span>,
                      },
                      {
                        key: 'contentType',
                        label: 'MIME Type',
                        render: (r) => <Tag tone="neutral">{String(r.contentType)}</Tag>,
                      },
                      {
                        key: 'lastModified',
                        label: 'Uploaded',
                        render: (r) => <span className="text-2xs text-ink-soft">{timestamp(String(r.lastModified))}</span>,
                      },
                      {
                        key: '_actions',
                        label: 'Actions',
                        align: 'right',
                        render: (r) => {
                          const obj = r as unknown as ObjectInfo;
                          return (
                            <div className="flex items-center gap-1.5 justify-end">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setPreviewObject(obj)}
                                title="Preview File"
                              >
                                <Eye className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => copyPublicUrl(obj.key)}
                                title="Copy Public URL"
                              >
                                {copiedKey === obj.key ? <Check className="h-3 w-3 text-positive" /> : <Copy className="h-3 w-3" />}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => removeObject(obj.key)}
                                title="Delete File"
                              >
                                <Trash2 className="h-3 w-3 text-critical" />
                              </Button>
                            </div>
                          );
                        },
                      },
                    ]}
                    rows={(objects.data?.data || []) as unknown as Record<string, unknown>[]}
                  />
                )}
              </Panel>
            </>
          )}
        </div>
      </div>
    </>
  );
}
