import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export interface TestDatabase {
  connectionString: string;
  stop: () => Promise<void>;
}

/**
 * Integration tests run against a real Postgres, never a mock — a stub would happily
 * accept the SQL this project generates and prove nothing about it.
 *
 * Resolution order:
 *   1. TEST_DATABASE_URL, if set. This is what CI and `docker compose up postgres` use.
 *   2. An ephemeral embedded Postgres, for a zero-setup local run.
 *
 * If neither is available the suite skips with a clear reason rather than passing silently.
 */
export async function startTestDatabase(): Promise<TestDatabase> {
  const external = process.env.TEST_DATABASE_URL;
  if (external) {
    return { connectionString: external, stop: async () => {} };
  }

  const { default: EmbeddedPostgres } = await import('embedded-postgres');
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'strat-pg-'));
  const dataDir = path.join(dir, 'data');
  await fs.mkdir(dataDir, { recursive: true });

  // Postgres refuses to run as root, so under a root sandbox it runs as its own user,
  // which then has to own the data directory or initdb cannot fix its permissions.
  const asRoot = process.getuid?.() === 0;
  if (asRoot) {
    const entry = (await fs.readFile('/etc/passwd', 'utf8')).split('\n').find((l) => l.startsWith('postgres:'));
    if (entry) {
      const parts = entry.split(':');
      await fs.chown(dir, Number(parts[2]), Number(parts[3]));
      await fs.chown(dataDir, Number(parts[2]), Number(parts[3]));
    }
    await fs.chmod(dir, 0o777);
    await fs.chmod(dataDir, 0o700);
  }

  const port = 15_000 + Math.floor(Math.random() * 20_000);
  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: 'stratum',
    password: 'stratum',
    port,
    persistent: false,
    createPostgresUser: asRoot,
  } as ConstructorParameters<typeof EmbeddedPostgres>[0]);

  await pg.initialise();
  await pg.start();
  await pg.createDatabase('stratum_test');

  return {
    connectionString: `postgres://stratum:stratum@localhost:${port}/stratum_test`,
    stop: async () => {
      await pg.stop().catch(() => {});
      await fs.rm(dir, { recursive: true, force: true });
    },
  };
}

export function skipReason(e: unknown): string {
  return (
    `Could not start a test database (${e instanceof Error ? e.message : String(e)}).\n` +
    `Run \`docker compose up -d postgres\` and set TEST_DATABASE_URL to run the integration suite.`
  );
}
