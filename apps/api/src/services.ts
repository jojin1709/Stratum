import { loadConfig, type StratumConfig } from '@stratum/config';
import { PostgresAdapter, bootstrap } from '@stratum/database';
import { createStorageProvider } from '@stratum/storage';
import { RealtimeHub } from '@stratum/realtime';
import { LocalFunctionRuntime } from '@stratum/functions';
import { createLogger, generateKey, hashKey, maskKey } from '@stratum/shared';
import type { Services } from './context.js';

/**
 * Wires every subsystem together and makes sure the project has usable API keys.
 * Without an account system, first-boot key provisioning is what makes the platform
 * usable at all — so it is explicit and printed once, not hidden.
 */
export async function createServices(overrides: Partial<StratumConfig> = {}): Promise<Services> {
  const config = loadConfig(overrides as Record<string, string | undefined>);
  const logger = createLogger({ level: config.LOG_LEVEL, service: 'stratum-api' });

  const db = new PostgresAdapter({
    connectionString: config.DATABASE_URL,
    max: config.DATABASE_POOL_MAX,
    statementTimeoutMs: config.DATABASE_STATEMENT_TIMEOUT_MS,
  });

  await bootstrap(db);
  await provisionKeys(db, config, logger);

  const storage = createStorageProvider({
    driver: config.STORAGE_DRIVER,
    localPath: config.STORAGE_PATH,
    apiBaseUrl: `http://localhost:${config.STRATUM_API_PORT}`,
    s3: {
      endpoint: config.R2_ENDPOINT,
      region: config.R2_REGION,
      bucket: config.R2_BUCKET,
      accessKeyId: config.R2_ACCESS_KEY_ID,
      secretAccessKey: config.R2_SECRET_ACCESS_KEY,
    },
  });

  const hub = new RealtimeHub();
  const functions = new LocalFunctionRuntime(config.FUNCTIONS_DIR, { DATABASE_URL: undefined, ...safeEnv() }, logger);

  return { config, db, storage, hub, functions, logger };
}

/** Only non-secret variables are handed to function code. */
function safeEnv(): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (/SECRET|PASSWORD|DATABASE_URL|ACCESS_KEY/i.test(key)) continue;
    out[key] = value;
  }
  return out;
}

async function provisionKeys(
  db: PostgresAdapter,
  config: StratumConfig,
  logger: ReturnType<typeof createLogger>,
): Promise<void> {
  for (const role of ['public', 'secret'] as const) {
    const existing = await db.query<{ count: number }>(
      `select count(*)::int as count from stratum.api_keys where role = $1 and revoked_at is null`,
      [role],
    );
    if ((existing.rows[0]?.count ?? 0) > 0) continue;

    const fromEnv = role === 'public' ? (config.STRATUM_PUBLIC_KEY ?? config.BASEFORGE_PUBLIC_KEY) : (config.STRATUM_SECRET_KEY ?? config.BASEFORGE_SECRET_KEY);
    const usable = fromEnv && (fromEnv.startsWith(`strat_${role}_`) || fromEnv.startsWith(`bf_${role}_`)) && !fromEnv.endsWith('replace_me');
    const raw = usable ? (fromEnv as string) : generateKey(role);

    await db.query(
      `insert into stratum.api_keys (label, role, key_hash, key_masked) values ($1,$2,$3,$4)
         on conflict (key_hash) do nothing`,
      [`default ${role} key`, role, hashKey(raw), maskKey(raw)],
    );

    if (usable) {
      logger.info('registered api key from environment', { role, key: maskKey(raw) });
    } else {
      // Printed to stderr, not the structured log, so it is not swept into log storage.
      process.stderr.write(
        `\n  Stratum generated a ${role} key. Save it now — it will not be shown again:\n\n    ${raw}\n\n` +
          `  Add it to your .env as STRATUM_${role.toUpperCase()}_KEY.\n\n`,
      );
    }
  }
}
