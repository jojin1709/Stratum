import type { Server as HttpServer } from 'node:http';
import { StratumError, type Logger } from '@stratum/shared';
import { WebSocketServer, WebSocket } from 'ws';
import { RealtimeHub } from './hub.js';
import { parseClientMessage, type ServerMessage } from './protocol.js';

export interface RealtimeServerOptions {
  port?: number;
  server?: HttpServer;
  hub?: RealtimeHub;
  logger?: Logger;
  validateKey?: (key: string) => Promise<boolean> | boolean;
}

export class RealtimeServer {
  readonly hub: RealtimeHub;
  private readonly wss: WebSocketServer;
  private readonly server?: HttpServer;
  private readonly logger?: Logger;

  constructor(opts: RealtimeServerOptions = {}) {
    this.hub = opts.hub ?? new RealtimeHub();
    this.logger = opts.logger;

    this.wss = opts.server
      ? new WebSocketServer({ server: opts.server })
      : new WebSocketServer({ port: opts.port ?? 8789 });

    this.server = opts.server;
    this.wss.on('connection', (ws, req) => this.handleConnection(ws, req));
  }

  private handleConnection(ws: WebSocket, req: { url?: string }): void {
    const conn = this.hub.register((msg: ServerMessage) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(msg));
      }
    });

    this.logger?.debug('realtime client connected', { id: conn.id, url: req.url });

    ws.on('message', (raw) => {
      try {
        const msg = parseClientMessage(raw.toString());
        if (msg.type === 'ping') {
          conn.send({ type: 'pong' });
        } else if (msg.type === 'subscribe') {
          this.hub.subscribe(conn.id, msg.channel, msg.events);
        } else if (msg.type === 'unsubscribe') {
          this.hub.unsubscribe(conn.id, msg.channel);
        } else if (msg.type === 'broadcast') {
          this.hub.broadcast(msg.channel, msg.event, msg.payload, conn.id);
        } else if (msg.type === 'presence') {
          this.hub.setPresence(conn.id, msg.channel, msg.state);
        }
      } catch (e: any) {
        const code = e instanceof StratumError ? e.code : 'BAD_REQUEST';
        const message = e instanceof StratumError ? e.message : (e.message ?? 'Malformed realtime frame.');
        conn.send({ type: 'error', error: { code, message } });
      }
    });

    ws.on('close', () => {
      this.logger?.debug('realtime client disconnected', { id: conn.id });
      this.hub.unregister(conn.id);
    });

    ws.on('error', (e) => {
      this.logger?.warn('realtime client socket error', { id: conn.id, error: String(e) });
      this.hub.unregister(conn.id);
    });
  }

  async close(): Promise<void> {
    await new Promise<void>((resolve) => this.wss.close(() => resolve()));
  }
}
