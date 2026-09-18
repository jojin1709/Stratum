import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

const bool = (fallback: boolean) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined ? fallback : v === 'true' || v === '1'));

const int = (fallback: number) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === '' ? fallback : Number(v)))
    .pipe(z.number().int().positive());

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    DATABASE_POOL_MAX: int(10),
    DATABASE_STATEMENT_TIMEOUT_MS: int(15_000),

    STRATUM_API_PORT: int(8788),
    STRATUM_DASHBOARD_PORT: int(8787),
    STRATUM_REALTIME_PORT: int(8789),

    STRATUM_PUBLIC_KEY: z.string().optional(),
    STRATUM_SECRET_KEY: z.string().optional(),

    STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
    STORAGE_PATH: z.string().default('./storage-data'),
    STORAGE_MAX_UPLOAD_BYTES: int(100 * 1024 * 1024),

    R2_ENDPOINT: z.string().optional(),
    R2_REGION: z.string().default('auto'),
    R2_BUCKET: z.string().optional(),
    R2_ACCESS_KEY_ID: z.string().optional(),
    R2_SECRET_ACCESS_KEY: z.string().optional(),
    R2_PUBLIC_BASE_URL: z.string().optional(),

    CORS_ORIGINS: z.string().default('http://localhost:8787'),
    RATE_LIMIT_WINDOW_MS: int(60_000),
    RATE_LIMIT_MAX: int(300),
    MAX_REQUEST_BYTES: int(2 * 1024 * 1024),

    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    REALTIME_ENABLED: bool(true),
    FUNCTIONS_DIR: z.string().default('./functions'),
    MIGRATIONS_DIR: z.string().default('./migrations'),
  })
  .superRefine((env, ctx) => {
    if (env.STORAGE_DRIVER === 's3') {
      for (const key of ['R2_ENDPOINT', 'R2_BUCKET', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY'] as const) {
        if (!env[key]) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: `${key} is required when STORAGE_DRIVER=s3`,
          });
        }
      }
    }
  });

export type Env = z.infer<typeof EnvSchema>;

export interface StratumConfig extends Env {
  isProduction: boolean;
  corsOrigins: string[];
  // Backwards compatibility aliases
  BASEFORGE_API_PORT: number;
  BASEFORGE_DASHBOARD_PORT: number;
  BASEFORGE_REALTIME_PORT: number;
  BASEFORGE_PUBLIC_KEY?: string;
  BASEFORGE_SECRET_KEY?: string;
}

// Backwards compatibility type alias
export type BaseForgeConfig = StratumConfig;

let cached: StratumConfig | null = null;

/**
 * Loads and validates configuration. Throws a readable aggregate error on bad config
 * rather than letting the process start in a half-configured state.
 */
export function loadConfig(overrides: Record<string, string | undefined> = {}): StratumConfig {
  loadDotenv({ path: process.env.STRATUM_ENV_FILE ?? process.env.BASEFORGE_ENV_FILE ?? '.env', override: false });
  
  const rawEnv: Record<string, string | undefined> = {
    STRATUM_API_PORT: process.env.STRATUM_API_PORT ?? process.env.BASEFORGE_API_PORT,
    STRATUM_DASHBOARD_PORT: process.env.STRATUM_DASHBOARD_PORT ?? process.env.BASEFORGE_DASHBOARD_PORT,
    STRATUM_REALTIME_PORT: process.env.STRATUM_REALTIME_PORT ?? process.env.BASEFORGE_REALTIME_PORT,
    STRATUM_PUBLIC_KEY: process.env.STRATUM_PUBLIC_KEY ?? process.env.BASEFORGE_PUBLIC_KEY,
    STRATUM_SECRET_KEY: process.env.STRATUM_SECRET_KEY ?? process.env.BASEFORGE_SECRET_KEY,
    ...process.env,
    ...overrides,
  };

  const parsed = EnvSchema.safeParse(rawEnv);

  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`);
    throw new Error(`Invalid Stratum configuration:\n${lines.join('\n')}\n\nSee .env.example for the full list.`);
  }

  const env = parsed.data;
  return {
    ...env,
    isProduction: env.NODE_ENV === 'production',
    corsOrigins: env.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean),
    BASEFORGE_API_PORT: env.STRATUM_API_PORT,
    BASEFORGE_DASHBOARD_PORT: env.STRATUM_DASHBOARD_PORT,
    BASEFORGE_REALTIME_PORT: env.STRATUM_REALTIME_PORT,
    BASEFORGE_PUBLIC_KEY: env.STRATUM_PUBLIC_KEY,
    BASEFORGE_SECRET_KEY: env.STRATUM_SECRET_KEY,
  };
}

export function getConfig(): StratumConfig {
  if (!cached) cached = loadConfig();
  return cached;
}

/** Test helper — clears the memoised config. */
export function resetConfig(): void {
  cached = null;
}
