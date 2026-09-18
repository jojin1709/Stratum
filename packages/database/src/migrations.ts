import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { err } from '@stratum/shared';
import type { DatabaseAdapter } from './adapter.js';

/**
 * File-based, explicitly-versioned migrations.
 *
 * A migration file is one .sql file named `<version>_<name>.sql`, optionally split into
 * an up and a down section:
 *
 *   -- +stratum up
 *   create table ...;
 *   -- +stratum down
 *   drop table ...;
 *
 * Files with no markers are treated as up-only and cannot be rolled back.
 */
export interface MigrationFile {
  version: string;
  name: string;
  filename: string;
  up: string;
  down: string | null;
  checksum: string;
}

export interface AppliedMigration {
  version: string;
  name: string;
  checksum: string;
  appliedAt: string;
  durationMs: number;
  rolledBackAt: string | null;
}

export interface MigrationStatus {
  version: string;
  name: string;
  state: 'applied' | 'pending' | 'missing-file' | 'checksum-mismatch';
  appliedAt?: string;
}

const FILENAME = /^(\d{12,14})_([a-z0-9_]+)\.sql$/i;

export function timestampVersion(date = new Date()): string {
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  return (
    `${date.getUTCFullYear()}${p(date.getUTCMonth() + 1)}${p(date.getUTCDate())}` +
    `${p(date.getUTCHours())}${p(date.getUTCMinutes())}${p(date.getUTCSeconds())}`
  );
}

export function splitSections(sql: string): { up: string; down: string | null } {
  const upMarker = /^--\s*\+(stratum|baseforge)\s+up\s*$/im;
  const downMarker = /^--\s*\+(stratum|baseforge)\s+down\s*$/im;
  if (!downMarker.test(sql)) return { up: sql.replace(upMarker, '').trim(), down: null };
  const idx = sql.search(downMarker);
  const upPart = sql.slice(0, idx).replace(upMarker, '').trim();
  const downPart = sql.slice(idx).replace(downMarker, '').trim();
  return { up: upPart, down: downPart || null };
}

export async function loadMigrations(dir: string): Promise<MigrationFile[]> {
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return [];
  }

  const files: MigrationFile[] = [];
  for (const filename of entries.sort()) {
    const match = FILENAME.exec(filename);
    if (!match) continue;
    const [, version, name] = match;
    const raw = await fs.readFile(path.join(dir, filename), 'utf8');
    const { up, down } = splitSections(raw);
    files.push({
      version: version as string,
      name: name as string,
      filename,
      up,
      down,
      checksum: createHash('sha256').update(up, 'utf8').digest('hex').slice(0, 32),
    });
  }
  return files;
}

export async function createMigrationFile(dir: string, name: string): Promise<string> {
  if (!/^[a-z0-9_]+$/i.test(name)) {
    throw err('VALIDATION_FAILED', 'Migration names may contain letters, digits, and underscores only.');
  }
  await fs.mkdir(dir, { recursive: true });
  const filename = `${timestampVersion()}_${name.toLowerCase()}.sql`;
  const full = path.join(dir, filename);
  await fs.writeFile(
    full,
    `-- +stratum up\n-- Write the forward migration here.\n\n\n-- +stratum down\n-- Write the rollback here. Delete this section if the migration is irreversible.\n`,
    { flag: 'wx' },
  );
  return full;
}

export async function listApplied(db: DatabaseAdapter): Promise<AppliedMigration[]> {
  const res = await db.query<Record<string, unknown>>(
    `select version, name, checksum, applied_at, duration_ms, rolled_back_at
       from stratum.migrations
      where rolled_back_at is null
      order by version`,
  );
  return res.rows.map((r) => ({
    version: String(r.version),
    name: String(r.name),
    checksum: String(r.checksum),
    appliedAt: new Date(r.applied_at as string).toISOString(),
    durationMs: Number(r.duration_ms),
    rolledBackAt: r.rolled_back_at ? new Date(r.rolled_back_at as string).toISOString() : null,
  }));
}

export async function status(db: DatabaseAdapter, dir: string): Promise<MigrationStatus[]> {
  const [files, applied] = await Promise.all([loadMigrations(dir), listApplied(db)]);
  const appliedByVersion = new Map(applied.map((a) => [a.version, a]));
  const out: MigrationStatus[] = [];

  for (const f of files) {
    const a = appliedByVersion.get(f.version);
    if (!a) out.push({ version: f.version, name: f.name, state: 'pending' });
    else if (a.checksum !== f.checksum) {
      out.push({ version: f.version, name: f.name, state: 'checksum-mismatch', appliedAt: a.appliedAt });
    } else out.push({ version: f.version, name: f.name, state: 'applied', appliedAt: a.appliedAt });
    appliedByVersion.delete(f.version);
  }
  for (const a of appliedByVersion.values()) {
    out.push({ version: a.version, name: a.name, state: 'missing-file', appliedAt: a.appliedAt });
  }
  return out.sort((x, y) => x.version.localeCompare(y.version));
}

export interface MigrateResult {
  applied: { version: string; name: string; durationMs: number }[];
  skipped: number;
}

/**
 * Applies every pending migration, each inside its own transaction, in version order.
 * A checksum mismatch aborts before anything runs — editing an applied migration is
 * a mistake we refuse to paper over.
 */
export async function migrate(
  db: DatabaseAdapter,
  dir: string,
  opts: { dryRun?: boolean } = {},
): Promise<MigrateResult> {
  const files = await loadMigrations(dir);
  const applied = await listApplied(db);
  const appliedByVersion = new Map(applied.map((a) => [a.version, a]));

  for (const f of files) {
    const a = appliedByVersion.get(f.version);
    if (a && a.checksum !== f.checksum) {
      throw err(
        'MIGRATION_ERROR',
        `Migration ${f.filename} changed after it was applied. Create a new migration instead of editing this one.`,
      );
    }
  }

  const pending = files.filter((f) => !appliedByVersion.has(f.version));
  if (opts.dryRun) {
    return { applied: pending.map((f) => ({ version: f.version, name: f.name, durationMs: 0 })), skipped: files.length - pending.length };
  }

  const result: MigrateResult = { applied: [], skipped: files.length - pending.length };
  for (const f of pending) {
    const started = Date.now();
    await db.transaction(async (tx) => {
      await tx.query(f.up);
      // A rolled-back migration is pending again, so re-applying must reuse its row
      // rather than collide with the unique version constraint.
      await tx.query(
        `insert into stratum.migrations (version, name, checksum, duration_ms) values ($1,$2,$3,$4)
           on conflict (version) do update
              set name = excluded.name, checksum = excluded.checksum,
                  duration_ms = excluded.duration_ms, applied_at = now(), rolled_back_at = null`,
        [f.version, f.name, f.checksum, Date.now() - started],
      );
    });
    result.applied.push({ version: f.version, name: f.name, durationMs: Date.now() - started });
  }
  return result;
}

/** Rolls back the most recently applied migration that has a down section. */
export async function rollback(db: DatabaseAdapter, dir: string): Promise<{ version: string; name: string } | null> {
  const files = await loadMigrations(dir);
  const applied = await listApplied(db);
  const last = applied.at(-1);
  if (!last) return null;

  const file = files.find((f) => f.version === last.version);
  if (!file) throw err('MIGRATION_ERROR', `Cannot roll back ${last.version}: the migration file is missing.`);
  if (!file.down) {
    throw err('MIGRATION_ERROR', `Migration ${file.filename} has no "-- +stratum down" section and cannot be rolled back.`);
  }

  await db.transaction(async (tx) => {
    await tx.query(file.down as string);
    await tx.query(`update stratum.migrations set rolled_back_at = now() where version = $1`, [file.version]);
  });
  return { version: file.version, name: file.name };
}
