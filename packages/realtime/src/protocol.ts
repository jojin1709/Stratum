import { err, type DatabaseChangeEvent, type RealtimeEventType } from '@stratum/shared';

export interface SubscribeMessage {
  type: 'subscribe';
  channel: string;
  events?: RealtimeEventType[];
}

export interface UnsubscribeMessage {
  type: 'unsubscribe';
  channel: string;
}

export interface BroadcastMessage {
  type: 'broadcast';
  channel: string;
  event: string;
  payload: unknown;
}

export interface PresenceMessage {
  type: 'presence';
  channel: string;
  state: Record<string, unknown>;
}

export interface PingMessage {
  type: 'ping';
  pad?: string;
}

export type ClientMessage =
  | SubscribeMessage
  | UnsubscribeMessage
  | BroadcastMessage
  | PresenceMessage
  | PingMessage;

export interface ReadyMessage {
  type: 'ready';
  connectionId: string;
}

export interface ServerBroadcastMessage {
  type: 'broadcast';
  channel: string;
  event: string;
  payload: unknown;
  from: string;
}

export interface ServerChangeMessage {
  type: 'change';
  channel: string;
  data: DatabaseChangeEvent;
}

export interface ServerPresenceMessage {
  type: 'presence';
  channel: string;
  state: Record<string, Record<string, unknown>>;
}

export interface PongMessage {
  type: 'pong';
}

export interface ErrorMessage {
  type: 'error';
  error: { code: string; message: string };
}

export type ServerMessage =
  | ReadyMessage
  | ServerBroadcastMessage
  | ServerChangeMessage
  | ServerPresenceMessage
  | PongMessage
  | ErrorMessage;

const ALLOWED_EVENTS: RealtimeEventType[] = ['INSERT', 'UPDATE', 'DELETE'];

export function assertChannel(name: unknown): string {
  if (typeof name !== 'string' || !/^[a-z0-9_:.-]{1,128}$/i.test(name)) {
    throw err('VALIDATION_FAILED', `Invalid channel name: ${JSON.stringify(name)}`);
  }
  return name;
}

export function tableChannel(schema: string, table: string): string {
  return `table:${schema}.${table}`;
}

export function parseTableChannel(channel: string): { schema: string; table: string } | null {
  const match = /^table:([a-z0-9_]+)\.([a-z0-9_]+)$/i.exec(channel);
  if (!match) return null;
  return { schema: match[1] as string, table: match[2] as string };
}

export function parseClientMessage(raw: string): ClientMessage {
  if (typeof raw !== 'string') {
    throw err('BAD_REQUEST', 'Realtime frame must be JSON text.');
  }
  if (raw.length > 64 * 1024) {
    throw err('PAYLOAD_TOO_LARGE', 'Realtime frame exceeds 64 KB limit.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw err('BAD_REQUEST', 'Realtime frame must be JSON text.');
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw err('VALIDATION_FAILED', 'Realtime frames must be JSON objects.');
  }

  const obj = parsed as Record<string, unknown>;
  const type = obj.type;

  switch (type) {
    case 'subscribe': {
      const channel = assertChannel(obj.channel);
      let events: RealtimeEventType[] | undefined;
      if (Array.isArray(obj.events)) {
        events = obj.events.filter((e): e is RealtimeEventType => ALLOWED_EVENTS.includes(e as RealtimeEventType));
      }
      return { type: 'subscribe', channel, ...(events ? { events } : {}) };
    }
    case 'unsubscribe': {
      const channel = assertChannel(obj.channel);
      return { type: 'unsubscribe', channel };
    }
    case 'broadcast': {
      const channel = assertChannel(obj.channel);
      const event = String(obj.event ?? 'message');
      return { type: 'broadcast', channel, event, payload: obj.payload };
    }
    case 'presence': {
      const channel = assertChannel(obj.channel);
      const state = (typeof obj.state === 'object' && obj.state !== null && !Array.isArray(obj.state))
        ? (obj.state as Record<string, unknown>)
        : {};
      return { type: 'presence', channel, state };
    }
    case 'ping':
      return { type: 'ping', ...(typeof obj.pad === 'string' ? { pad: obj.pad } : {}) };
    default:
      throw err('VALIDATION_FAILED', `Unknown realtime message type: ${JSON.stringify(type)}`);
  }
}
