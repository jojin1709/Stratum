import { createApp } from './app.js';
import { createServices } from './services.js';
import type { Services } from './context.js';

let servicesPromise: Promise<Services> | null = null;
let appInstance: ReturnType<typeof createApp> | null = null;

async function getApp(env: Record<string, string | undefined>) {
  if (!appInstance) {
    if (!servicesPromise) {
      servicesPromise = createServices({
        DATABASE_URL: env.DATABASE_URL || process.env.DATABASE_URL,
        STRATUM_PUBLIC_KEY: env.STRATUM_PUBLIC_KEY || process.env.STRATUM_PUBLIC_KEY,
        STRATUM_SECRET_KEY: env.STRATUM_SECRET_KEY || process.env.STRATUM_SECRET_KEY,
        R2_BUCKET: env.R2_BUCKET,
        R2_ENDPOINT: env.R2_ENDPOINT,
        R2_ACCESS_KEY_ID: env.R2_ACCESS_KEY_ID,
        R2_SECRET_ACCESS_KEY: env.R2_SECRET_ACCESS_KEY,
      });
    }
    const services = await servicesPromise;
    appInstance = createApp(services);
  }
  return appInstance;
}

export default {
  async fetch(request: Request, env: Record<string, string | undefined> = {}, ctx?: unknown): Promise<Response> {
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
