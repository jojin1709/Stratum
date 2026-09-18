import { createApp } from './app.js';
import { createServices } from './services.js';
import type { Services } from './context.js';

let servicesPromise: Promise<Services> | null = null;
let appInstance: ReturnType<typeof createApp> | null = null;

interface WorkerEnv {
  DATABASE_URL?: string;
  STRATUM_PUBLIC_KEY?: string;
  STRATUM_SECRET_KEY?: string;
  R2_BUCKET?: string;
  R2_ENDPOINT?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  CORS_ORIGINS?: string;
  HYPERDRIVE?: { connectionString: string };
  [key: string]: unknown;
}

async function getApp(env: WorkerEnv) {
  if (!appInstance) {
    if (!servicesPromise) {
      const dbUrl = env.HYPERDRIVE?.connectionString || env.DATABASE_URL || (typeof process !== 'undefined' ? process.env.DATABASE_URL : undefined);
      servicesPromise = createServices({
        DATABASE_URL: dbUrl,
        STRATUM_PUBLIC_KEY: (env.STRATUM_PUBLIC_KEY as string) || (typeof process !== 'undefined' ? process.env.STRATUM_PUBLIC_KEY : undefined),
        STRATUM_SECRET_KEY: (env.STRATUM_SECRET_KEY as string) || (typeof process !== 'undefined' ? process.env.STRATUM_SECRET_KEY : undefined),
        CORS_ORIGINS: (env.CORS_ORIGINS as string) || 'https://stratum-sh.vercel.app,http://localhost:8787,*',
        R2_BUCKET: env.R2_BUCKET as string | undefined,
        R2_ENDPOINT: env.R2_ENDPOINT as string | undefined,
        R2_ACCESS_KEY_ID: env.R2_ACCESS_KEY_ID as string | undefined,
        R2_SECRET_ACCESS_KEY: env.R2_SECRET_ACCESS_KEY as string | undefined,
      });
    }
    const services = await servicesPromise;
    appInstance = createApp(services);
  }
  return appInstance;
}

export default {
  async fetch(request: Request, env: WorkerEnv = {}, ctx?: unknown): Promise<Response> {
    try {
      const app = await getApp(env);
      return await app.fetch(request, env as never, ctx as never);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return new Response(JSON.stringify({ error: { code: 'INTERNAL_ERROR', message } }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      });
    }
  },
};
