import path from 'node:path';
import { PostgresAdapter, bootstrap, createMigrationFile, migrate, rollback, snapshotSchema, status } from '@stratum/database';
import { loadProject, resolveDatabaseUrl } from '../project.js';
import { bytes, dim, fail, green, info, ok, table, yellow, red } from '../ui.js';

async function connect(): Promise<{ db: PostgresAdapter; migrationsDir: string }> {
  const project = await loadProject();
  if (!project) fail('No stratum.json found.', 'Run `stratum init` first.');

  const url = await resolveDatabaseUrl(project.root);
  if (!url) fail('DATABASE_URL is not set.', 'Add it to .env or export it in your shell.');

  const db = new PostgresAdapter({ connectionString: url, applicationName: 'stratum-cli' });
  try {
    await db.healthcheck();
  } catch (e) {
    await db.close();
    fail(
      `Could not connect to the database.`,
      `${e instanceof Error ? e.message : String(e)}\n  Is Postgres running? Try: docker compose up -d postgres`,
    );
  }
  return { db, migrationsDir: path.resolve(project.root, project.config.migrationsDir) };
}

export async function dbStatus(): Promise<void> {
  const { db, migrationsDir } = await connect();
  try {
    await bootstrap(db);
    const rows = await status(db, migrationsDir);
    if (rows.length === 0) {
      info('No migrations yet. Create one with: stratum db migration create <name>');
      return;
    }
    table(
      rows.map((r) => ({
        version: r.version,
        name: r.name,
        state:
          r.state === 'applied' ? green('applied')
          : r.state === 'pending' ? yellow('pending')
          : red(r.state),
        applied: r.appliedAt ? new Date(r.appliedAt).toISOString().slice(0, 19).replace('T', ' ') : dim('—'),
      })),
    );
    const problems = rows.filter((r) => r.state === 'checksum-mismatch' || r.state === 'missing-file');
    if (problems.length > 0) {
      console.log(`\n  ${yellow('!')} ${problems.length} migration(s) no longer match what was applied.`);
      console.log(dim('    Editing an applied migration is not supported — add a new one instead.\n'));
    }
  } finally {
    await db.close();
  }
}

export async function dbMigrate(opts: { dryRun?: boolean }): Promise<void> {
  const { db, migrationsDir } = await connect();
  try {
    await bootstrap(db);
    const result = await migrate(db, migrationsDir, { dryRun: opts.dryRun === true });
    if (result.applied.length === 0) {
      ok(`Database is up to date (${result.skipped} migration(s) already applied).`);
      return;
    }
    for (const m of result.applied) {
      console.log(`  ${opts.dryRun ? dim('would apply') : green('applied')}  ${m.version}_${m.name}${opts.dryRun ? '' : dim(`  ${m.durationMs}ms`)}`);
    }
    ok(`${result.applied.length} migration(s) ${opts.dryRun ? 'pending' : 'applied'}.`);
  } catch (e) {
    fail(e instanceof Error ? e.message : String(e));
  } finally {
    await db.close();
  }
}

export async function dbRollback(): Promise<void> {
  const { db, migrationsDir } = await connect();
  try {
    await bootstrap(db);
    const rolled = await rollback(db, migrationsDir);
    if (!rolled) { info('Nothing to roll back.'); return; }
    ok(`Rolled back ${rolled.version}_${rolled.name}`);
  } catch (e) {
    fail(e instanceof Error ? e.message : String(e));
  } finally {
    await db.close();
  }
}

export async function dbMigrationCreate(name: string): Promise<void> {
  const project = await loadProject();
  if (!project) fail('No stratum.json found.', 'Run `stratum init` first.');
  const dir = path.resolve(project.root, project.config.migrationsDir);
  try {
    const file = await createMigrationFile(dir, name);
    ok(`Created ${path.relative(process.cwd(), file)}`);
    info('Write your SQL under `-- +stratum up`, then run: stratum db migrate');
  } catch (e) {
    fail(e instanceof Error ? e.message : String(e));
  }
}

/** Prints the live schema — the `pull` half of the schema workflow. */
export async function dbPull(): Promise<void> {
  const { db } = await connect();
  try {
    const snapshot = await snapshotSchema(db);
    table(
      snapshot.tables.map((t) => ({
        table: `${t.schema}.${t.name}`,
        kind: t.kind,
        columns: t.columns.length,
        rows: t.estimatedRows,
        size: bytes(t.sizeBytes),
      })),
    );
  } finally {
    await db.close();
  }
}

export async function dbReset(opts: { yes?: boolean }): Promise<void> {
  if (!opts.yes) {
    fail(
      'Refusing to reset without confirmation.',
      'This drops every table in the public schema. Re-run with --yes if you are sure.',
    );
  }
  const { db, migrationsDir } = await connect();
  try {
    await db.query('drop schema if exists public cascade');
    await db.query('create schema public');
    await db.query('drop schema if exists stratum cascade');
    await db.query('drop schema if exists baseforge cascade');
    await bootstrap(db);
    const result = await migrate(db, migrationsDir);
    ok(`Schema reset. ${result.applied.length} migration(s) re-applied.`);
  } finally {
    await db.close();
  }
}
