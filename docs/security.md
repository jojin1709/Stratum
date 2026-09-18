# Security model

Stratum intentionally ships with **no platform authentication** — no signup,
login, or account system. Every operation is authorized entirely by API key.

## Key roles

| Role | Prefix | Can do |
|---|---|---|
| `public` | `strat_public_` | Read and write table rows through the automatic REST API. Upload/download storage objects. Invoke functions. Subscribe to realtime channels. |
| `secret` | `strat_secret_` | Everything the public key can, **plus**: create/alter/drop tables and columns, run arbitrary SQL via the SQL editor, create/revoke/rotate API keys, create/delete buckets, enable realtime on a table. |

The public key is safe to ship in a browser bundle. The secret key is not —
`@stratum/client` refuses to construct a client with a `strat_secret_` key when
`window` is defined, and the dashboard never sends the secret key to the
browser: it stays server-side in the Next.js proxy route (`app/bf/[...path]/route.ts`).

## Storage

- Every object key and bucket name is validated against an allowlist before
  touching the filesystem — no path traversal, no absolute paths, no NUL bytes.
- Local-driver files are served with `Content-Disposition: attachment`, so an
  uploaded HTML or SVG file can never execute script against the API origin.
- Uploads are size-limited (`STORAGE_MAX_UPLOAD_BYTES`) at both the declared
  `Content-Length` and the actual buffer size.

## SQL

- The automatic REST API never interpolates a user-supplied value into SQL —
  every value is a bound parameter. Table, schema, and column names are checked
  against live introspection (or a strict identifier regex for DDL) before
  being quoted and inlined.
- The raw SQL editor (`/api/v1/rpc/query`) is secret-key-only. A `readOnly: true`
  request runs inside a transaction set to `READ ONLY`, so an accidental write
  cannot land even if the query is malformed.
- Default expressions in column definitions are checked against a narrow
  allowlist (`now()`, `gen_random_uuid()`, literals) — arbitrary SQL fragments
  are rejected and must go through a migration instead.

## Rate limiting

A fixed-window limiter runs in process memory, keyed by API key id (or IP for
unauthenticated requests). This protects a single instance; a multi-instance
deployment needs a shared store (Redis, etc.) — this is not implemented and the
CLI/docs do not claim otherwise.

## What is NOT in scope today

- Row-level security / per-row authorization. Every key with `public` role can
  read and write every row of every exposed table. If you need row-level access
  control, put it in front of BaseForge (a function, or your own API layer).
- Multi-tenant isolation. One Stratum instance is one project.
- Audit logging beyond request/function logs.
