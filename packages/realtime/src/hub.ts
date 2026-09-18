import type { DatabaseChangeEvent, RealtimeEventType } from '@stratum/shared';
import { assertChannel, tableChannel, type ServerMessage } from './protocol.js';

export interface RealtimeConnection {
  readonly id: string;
  send(message: ServerMessage): void;
}

export type Connection = RealtimeConnection;

export interface RealtimeStats {
  connections: number;
  channels: Array<{ name: string; subscribers: number }>;
}

export class RealtimeHub {
  private nextId = 0;
  private readonly connections = new Map<string, { send: (m: ServerMessage) => void; onClose?: () => void }>();
  private readonly channelSubs = new Map<string, Map<string, RealtimeEventType[] | undefined>>();
  private readonly channelPresence = new Map<string, Map<string, Record<string, unknown>>>();

  register(onMessage: (m: ServerMessage) => void, onClose?: () => void): Connection {
    const id = `conn_${++this.nextId}_${Date.now()}`;
    this.connections.set(id, { send: onMessage, onClose });
    onMessage({ type: 'ready', connectionId: id });
    return {
      id,
      send: onMessage,
    };
  }

  unregister(connectionId: string): void {
    const conn = this.connections.get(connectionId);
    if (!conn) return;
    this.connections.delete(connectionId);

    for (const [channel, subs] of this.channelSubs.entries()) {
      if (subs.has(connectionId)) {
        subs.delete(connectionId);
        if (subs.size === 0) this.channelSubs.delete(channel);
      }
    }

    for (const [channel, presences] of this.channelPresence.entries()) {
      if (presences.has(connectionId)) {
        presences.delete(connectionId);
        if (presences.size === 0) {
          this.channelPresence.delete(channel);
        } else {
          this.broadcastPresence(channel);
        }
      }
    }

    conn.onClose?.();
  }

  subscribe(connectionId: string, channel: string, events?: RealtimeEventType[]): void {
    assertChannel(channel);
    let subs = this.channelSubs.get(channel);
    if (!subs) {
      subs = new Map();
      this.channelSubs.set(channel, subs);
    }
    subs.set(connectionId, events);
  }

  unsubscribe(connectionId: string, channel: string): void {
    const subs = this.channelSubs.get(channel);
    if (subs) {
      subs.delete(connectionId);
      if (subs.size === 0) this.channelSubs.delete(channel);
    }
    const presences = this.channelPresence.get(channel);
    if (presences && presences.has(connectionId)) {
      presences.delete(connectionId);
      if (presences.size === 0) {
        this.channelPresence.delete(channel);
      } else {
        this.broadcastPresence(channel);
      }
    }
  }

  broadcast(channel: string, event: string, payload: unknown, fromConnectionId?: string): number {
    assertChannel(channel);
    const subs = this.channelSubs.get(channel);
    if (!subs) return 0;

    let count = 0;
    const msg: ServerMessage = {
      type: 'broadcast',
      channel,
      event,
      payload,
      from: fromConnectionId ?? 'system',
    };

    for (const subId of subs.keys()) {
      if (fromConnectionId && subId === fromConnectionId) continue;
      const conn = this.connections.get(subId);
      if (conn) {
        conn.send(msg);
        count++;
      }
    }

    return count;
  }

  publishChange(channel: string, change: DatabaseChangeEvent): number {
    const subs = this.channelSubs.get(channel);
    if (!subs) return 0;

    let count = 0;
    const msg: ServerMessage = {
      type: 'change',
      channel,
      data: change,
    };

    for (const [subId, filterEvents] of subs.entries()) {
      if (filterEvents && !filterEvents.includes(change.type)) continue;
      const conn = this.connections.get(subId);
      if (conn) {
        conn.send(msg);
        count++;
      }
    }

    return count;
  }

  dispatchPostgresChange(event: DatabaseChangeEvent): void {
    const channel = tableChannel(event.schema, event.table);
    this.publishChange(channel, event);
  }

  setPresence(connectionId: string, channel: string, state: Record<string, unknown>): void {
    assertChannel(channel);
    let presences = this.channelPresence.get(channel);
    if (!presences) {
      presences = new Map();
      this.channelPresence.set(channel, presences);
    }
    presences.set(connectionId, state);
    this.broadcastPresence(channel);
  }

  presenceState(channel: string): Record<string, Record<string, unknown>> {
    const presences = this.channelPresence.get(channel);
    if (!presences) return {};
    const out: Record<string, Record<string, unknown>> = {};
    for (const [id, st] of presences.entries()) {
      out[id] = st;
    }
    return out;
  }

  private broadcastPresence(channel: string): void {
    const state = this.presenceState(channel);
    const subs = this.channelSubs.get(channel);
    if (!subs) return;
    const msg: ServerMessage = {
      type: 'presence',
      channel,
      state,
    };
    for (const subId of subs.keys()) {
      const conn = this.connections.get(subId);
      conn?.send(msg);
    }
  }

  stats(): RealtimeStats {
    const channels: Array<{ name: string; subscribers: number }> = [];
    for (const [name, subs] of this.channelSubs.entries()) {
      channels.push({ name, subscribers: subs.size });
    }
    return {
      connections: this.connections.size,
      channels,
    };
  }
}
