'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { cell } from '@/lib/format';

function CopyCell({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        void navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        });
      }}
      className="invisible ml-1 text-ink-faint hover:text-accent group-hover/cell:visible"
      aria-label={copied ? 'Copied' : 'Copy value'}
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

export interface Column {
  key: string;
  label?: string;
  /** Rendered instead of the raw value when present. */
  render?: (row: Record<string, unknown>) => React.ReactNode;
  align?: 'left' | 'right';
}

/**
 * The console's core surface. Sticky header, horizontal scroll rather than a collapsed
 * layout on narrow screens, NULL rendered distinctly from an empty string, and JSON
 * kept on one line so rows stay scannable.
 */
export function DataTable({
  columns,
  rows,
  sort,
  onSort,
  emptyLabel = 'No rows',
  maxHeight = '60vh',
}: {
  columns: Column[];
  rows: Record<string, unknown>[];
  sort?: { column: string; ascending: boolean } | null;
  onSort?: (column: string) => void;
  emptyLabel?: string;
  maxHeight?: string;
}) {
  if (rows.length === 0) {
    return <p className="px-3 py-8 text-center text-[13px] text-ink-faint">{emptyLabel}</p>;
  }

  return (
    <div className="thin-scroll overflow-auto" style={{ maxHeight }}>
      <table className="w-full border-collapse text-[13px]">
        <thead className="sticky top-0 z-[1]">
          <tr>
            {columns.map((col) => {
              const sorted = sort?.column === col.key;
              return (
                <th
                  key={col.key}
                  scope="col"
                  aria-sort={sorted ? (sort.ascending ? 'ascending' : 'descending') : undefined}
                  className={`whitespace-nowrap border-b border-line bg-sunken px-3 py-1.5 font-medium text-ink-soft ${
                    col.align === 'right' ? 'text-right' : 'text-left'
                  }`}
                >
                  {onSort ? (
                    <button
                      onClick={() => onSort(col.key)}
                      className="inline-flex items-center gap-1 hover:text-ink"
                    >
                      {col.label ?? col.key}
                      <span className="text-ink-faint">{sorted ? (sort.ascending ? '↑' : '↓') : ''}</span>
                    </button>
                  ) : (
                    (col.label ?? col.key)
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-line last:border-0 hover:bg-sunken/60">
              {columns.map((col) => {
                if (col.render) {
                  return (
                    <td key={col.key} className={`px-3 py-1.5 ${col.align === 'right' ? 'text-right' : ''}`}>
                      {col.render(row)}
                    </td>
                  );
                }
                const value = cell(row[col.key]);
                return (
                  <td
                    key={col.key}
                    className={`group/cell max-w-md truncate px-3 py-1.5 font-mono text-xs ${
                      col.align === 'right' ? 'nums text-right' : ''
                    } ${value.kind === 'null' ? 'italic text-ink-faint' : 'text-ink'}`}
                    title={value.text}
                  >
                    {value.text}
                    {value.kind !== 'null' ? <CopyCell value={value.text} /> : null}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
