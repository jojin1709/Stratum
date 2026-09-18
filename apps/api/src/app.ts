import { Hono } from 'hono';
import type { AppEnv, Services } from './context.js';
import { apiKeyAuth } from './middleware/auth.js';
import { bodyLimit, corsFor, errorHandler, requestLogger, securityHeaders } from './middleware/common.js';
import { rateLimit } from './middleware/rate-limit.js';
import { metaRoutes } from './routes/meta.js';
import { restRoutes } from './routes/rest.js';
import { sqlRoutes } from './routes/sql.js';
import { keyRoutes } from './routes/keys.js';
import { storageRoutes } from './routes/storage.js';
import { functionRoutes } from './routes/functions.js';
import { realtimeRoutes } from './routes/realtime.js';
import { logRoutes } from './routes/logs.js';
import { openApiRoutes } from './routes/openapi.js';

export function createApp(services: Services) {
  const app = new Hono<AppEnv>();
  const { config } = services;

  app.onError(errorHandler(services) as never);
  app.notFound((c) => c.json({ error: { code: 'NOT_FOUND', message: `No route for ${c.req.method} ${new URL(c.req.url).pathname}.` } }, 404));

  app.use('*', securityHeaders());
  app.use('*', corsFor(config.corsOrigins));
  app.use('*', bodyLimit(config.MAX_REQUEST_BYTES));
  app.use('*', requestLogger(services));

  // Unauthenticated: used by Docker healthchecks and `baseforge status`.
  app.get('/health', async (c) => {
    const health = await services.db.healthcheck().catch(() => ({ ok: false, latencyMs: 0, version: 'unreachable' }));
    return c.json(
      {
        status: health.ok ? 'ok' : 'degraded',
        version: '0.1.0',
        database: { connected: health.ok, latencyMs: health.latencyMs },
        storage: { driver: services.storage.driver },
        realtime: { enabled: config.REALTIME_ENABLED, connections: services.hub.stats().connections },
      },
      health.ok ? 200 : 503,
    );
  });

  app.use('/api/*', apiKeyAuth(services));
  app.use('/storage/*', apiKeyAuth(services));
  app.use('/functions/*', apiKeyAuth(services));
  // The WebSocket upgrade at /realtime/v1 is handled by the ws server before Hono sees it,
  // and authenticates separately, so guarding the whole prefix here is safe.
  app.use('/realtime/*', apiKeyAuth(services));
  app.use('/logs/*', apiKeyAuth(services));
  app.use('*', rateLimit({ windowMs: config.RATE_LIMIT_WINDOW_MS, max: config.RATE_LIMIT_MAX }));

  app.route('/api/v1/meta', metaRoutes(services));
  app.route('/api/v1/keys', keyRoutes(services));
  app.route('/api/v1/rpc', sqlRoutes(services));
  app.route('/api/v1', openApiRoutes(services));
  app.route('/storage/v1', storageRoutes(services));
  app.route('/functions/v1', functionRoutes(services));
  app.route('/realtime/v1', realtimeRoutes(services));
  app.route('/logs/v1', logRoutes(services));

  // Mounted last so table names cannot shadow the reserved prefixes above.
  app.route('/api/v1', restRoutes(services));

  return app;
}
