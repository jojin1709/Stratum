'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface ApiError { code: string; message: string; details?: unknown; }

export class RequestFailed extends Error {
  constructor(readonly apiError: ApiError, readonly status: number) {
    super(apiError.message);
  }
}

/** All dashboard traffic goes through the server proxy, never directly to the API. */
export async function api<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/bf${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
  });

  const text = await res.text();
  let body: unknown = null;
  if (text) { try { body = JSON.parse(text); } catch { body = text; } }

  if (!res.ok) {
    const wrapped = (body as { error?: ApiError } | null)?.error;
    throw new RequestFailed(wrapped ?? { code: 'UNKNOWN_ERROR', message: `Request failed (${res.status}).` }, res.status);
  }
  return body as T;
}

export interface Query<T> {
  data: T | null;
  error: ApiError | null;
  loading: boolean;
  reload: () => void;
}

/**
 * Data loading with explicit loading and error states — every screen has to be able to
 * say what went wrong, so the error is surfaced rather than swallowed into an empty list.
 */
export function useApi<T>(path: string | null, deps: unknown[] = []): Query<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(path !== null);
  const [nonce, setNonce] = useState(0);
  const latest = useRef(0);

  useEffect(() => {
    if (path === null) { setLoading(false); return; }
    const ticket = ++latest.current;
    setLoading(true);

    api<T>(path)
      .then((result) => {
        if (ticket !== latest.current) return; // A newer request already answered.
        setData(result);
        setError(null);
      })
      .catch((e: unknown) => {
        if (ticket !== latest.current) return;
        setError(e instanceof RequestFailed ? e.apiError : { code: 'UNKNOWN_ERROR', message: String(e) });
        setData(null);
      })
      .finally(() => { if (ticket === latest.current) setLoading(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, nonce, ...deps]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { data, error, loading, reload };
}
