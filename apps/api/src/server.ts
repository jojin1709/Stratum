import { serve } from '@hono/node-server';
import { RealtimeServer, PostgresChangeListener } from '@stratum/realtime';
import { hashKey, keyRole } from '@stratum/shared';
import { createApp } from './app.js';
import { createServices } from './services.js';

async function main(): Promise<void> {
  const services = await createServices();
  const { config, logger, db, hub } = services;
  const app = createApp(services);

  const server = serve({ fetch: app.fetch, port: config.STRATUM_API_PORT, hostname: '0.0.0.0' }, (info) => {
    logger.info('stratum api listening', { port: info.port, storage: services.storage.driver });
  });

  let closeRealtime: (() => Promise<void>) | null = null;
  let listener: PostgresChangeListener | null = null;

  if (config.REALTIME_ENABLED) {
    const realtime = new RealtimeServer({
      server: server as never,
      hub,
      logger,
      validateKey: async (key) => {
        if (!key || !keyRole(key)) return false;
        const res = await db.query<{ id: string }>(
          `select id from stratum.api_keys where key_hash = $1 and revoked_at is null`,
          [hashKey(key)],
        );
        return res.rowCount > 0;
      },
    });
    closeRealtime = realtime.close.bind(realtime);

    listener = new PostgresChangeListener({ connectionString: config.DATABASE_URL, hub, logger });
    await listener.start();
  }

  const shutdown = async (signal: string): Promise<void> => {
    logger.info('shutting down', { signal });
    await closeRealtime?.();
    await listener?.stop();
    server.close();
    await db.close();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((e) => {
  process.stderr.write(`\nStratum API failed to start:\n${e instanceof Error ? e.message : String(e)}\n\n`);
  process.exit(1);
});
