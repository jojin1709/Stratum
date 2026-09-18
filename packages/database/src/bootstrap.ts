import type { DatabaseAdapter } from './adapter.js';

/**
 * Stratum's own metadata lives in a reserved `stratum` schema that the
 * table/REST APIs refuse to touch. This runs on every API boot and is idempotent.
 */
export const BOOTSTRAP_SQL = `
CREATE SCHEMA IF NOT EXISTS stratum;

CREATE TABLE IF NOT EXISTS stratum.migrations (
  id            bigserial PRIMARY KEY,
  version       text NOT NULL UNIQUE,
  name          text NOT NULL,
  checksum      text NOT NULL,
  applied_at    timestamptz NOT NULL DEFAULT now(),
  duration_ms   integer NOT NULL DEFAULT 0,
  rolled_back_at timestamptz
);

CREATE TABLE IF NOT EXISTS stratum.api_keys (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label       text NOT NULL,
  role        text NOT NULL CHECK (role IN ('public','secret')),
  key_hash    text NOT NULL UNIQUE,
  key_masked  text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  revoked_at  timestamptz
);

CREATE TABLE IF NOT EXISTS stratum.buckets (
  name       text PRIMARY KEY,
  is_public  boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stratum.objects (
  bucket        text NOT NULL REFERENCES stratum.buckets(name) ON DELETE CASCADE,
  key           text NOT NULL,
  size_bytes    bigint NOT NULL,
  content_type  text NOT NULL DEFAULT 'application/octet-stream',
  etag          text,
  metadata      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (bucket, key)
);

CREATE TABLE IF NOT EXISTS stratum.request_logs (
  id          bigserial PRIMARY KEY,
  at          timestamptz NOT NULL DEFAULT now(),
  method      text NOT NULL,
  path        text NOT NULL,
  status      integer NOT NULL,
  duration_ms integer NOT NULL,
  key_id      uuid,
  source      text NOT NULL DEFAULT 'api'
);
CREATE INDEX IF NOT EXISTS request_logs_at_idx ON stratum.request_logs (at DESC);

CREATE TABLE IF NOT EXISTS stratum.realtime_tables (
  schema_name text NOT NULL,
  table_name  text NOT NULL,
  enabled_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (schema_name, table_name)
);

CREATE TABLE IF NOT EXISTS stratum.functions (
  name          text PRIMARY KEY,
  runtime       text NOT NULL DEFAULT 'node',
  target        text NOT NULL DEFAULT 'local',
  entrypoint    text NOT NULL,
  deployed_at   timestamptz,
  last_error    text,
  invocations   bigint NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS stratum.function_logs (
  id          bigserial PRIMARY KEY,
  at          timestamptz NOT NULL DEFAULT now(),
  function    text NOT NULL,
  level       text NOT NULL DEFAULT 'info',
  message     text NOT NULL,
  duration_ms integer
);
CREATE INDEX IF NOT EXISTS function_logs_at_idx ON stratum.function_logs (at DESC);

-- pgcrypto supplies gen_random_uuid() on Postgres < 13; harmless on newer versions.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
`;

export async function bootstrap(db: DatabaseAdapter): Promise<void> {
  // pgcrypto must exist before the DEFAULT gen_random_uuid() columns are created.
  await db.query('CREATE EXTENSION IF NOT EXISTS pgcrypto').catch(() => {
    /* Managed Postgres may block extension creation; PG13+ has gen_random_uuid() built in. */
  });
  await db.query(BOOTSTRAP_SQL);
}
