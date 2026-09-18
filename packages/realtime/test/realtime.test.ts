import { describe, it, expect, beforeEach } from 'vitest';
import { RealtimeHub } from '../src/hub.js';
import { parseClientMessage, assertChannel, tableChannel, parseTableChannel } from '../src/protocol.js';
import type { ServerMessage } from '../src/protocol.js';

function fakeConn(hub: RealtimeHub) {
  const received: ServerMessage[] = [];
  const conn = hub.register((m) => received.push(m), () => {});
  return { conn, received };
}

let hub: RealtimeHub;
beforeEach(() => { hub = new RealtimeHub(); });

describe('protocol', () => {
  it('validates channel names', () => {
    expect(assertChannel('room-123')).toBe('room-123');
    expect(assertChannel('table:public.products')).toBe('table:public.products');
    expect(() => assertChannel('bad channel!')).toThrow();
    expect(() => assertChannel('')).toThrow();
    expect(() => assertChannel(42)).toThrow();
  });

  it('rejects malformed and oversized frames', () => {
    expect(() => parseClientMessage('not json')).toThrow(/must be JSON/);
    expect(() => parseClientMessage('[]')).toThrow(/JSON objects/);
    expect(() => parseClientMessage('{"type":"nope"}')).toThrow(/Unknown realtime message type/);
    expect(() => parseClientMessage(JSON.stringify({ type: 'ping', pad: 'x'.repeat(70_000) }))).toThrow(/64 KB/);
  });

  it('filters unknown event types out of subscriptions', () => {
    const msg = parseClientMessage(JSON.stringify({ type: 'subscribe', channel: 'c', events: ['INSERT', 'TRUNCATE'] }));
    expect(msg).toEqual({ type: 'subscribe', channel: 'c', events: ['INSERT'] });
  });

  it('round-trips table channel names', () => {
    expect(tableChannel('public', 'products')).toBe('table:public.products');
    expect(parseTableChannel('table:public.products')).toEqual({ schema: 'public', table: 'products' });
    expect(parseTableChannel('room-1')).toBeNull();
  });
});

describe('RealtimeHub', () => {
  it('greets new connections with their id', () => {
    const { received } = fakeConn(hub);
    expect(received[0]).toMatchObject({ type: 'ready' });
  });

  it('delivers broadcasts to other subscribers but not the sender', () => {
    const a = fakeConn(hub);
    const b = fakeConn(hub);
    hub.subscribe(a.conn.id, 'room-1');
    hub.subscribe(b.conn.id, 'room-1');

    expect(hub.broadcast('room-1', 'msg', { text: 'hi' }, a.conn.id)).toBe(1);
    expect(b.received.some((m) => m.type === 'broadcast' && m.payload && (m.payload as any).text === 'hi')).toBe(true);
    expect(a.received.some((m) => m.type === 'broadcast')).toBe(false);
  });

  it('honours per-subscription event filters', () => {
    const a = fakeConn(hub);
    hub.subscribe(a.conn.id, 'table:public.products', ['INSERT']);
    const base = { schema: 'public', table: 'products', record: null, old: null, commitTimestamp: 'now' };

    expect(hub.publishChange('table:public.products', { ...base, type: 'INSERT' })).toBe(1);
    expect(hub.publishChange('table:public.products', { ...base, type: 'DELETE' })).toBe(0);
  });

  it('tracks presence and notifies the channel', () => {
    const a = fakeConn(hub);
    const b = fakeConn(hub);
    hub.subscribe(a.conn.id, 'room-1');
    hub.subscribe(b.conn.id, 'room-1');
    hub.setPresence(a.conn.id, 'room-1', { name: 'ada' });

    expect(hub.presenceState('room-1')).toEqual({ [a.conn.id]: { name: 'ada' } });
    expect(b.received.some((m) => m.type === 'presence')).toBe(true);
  });

  it('cleans up channels when the last subscriber disconnects', () => {
    const a = fakeConn(hub);
    hub.subscribe(a.conn.id, 'room-1');
    expect(hub.stats().channels).toHaveLength(1);
    hub.unregister(a.conn.id);
    expect(hub.stats()).toEqual({ connections: 0, channels: [] });
  });

  it('drops a connection from every channel on unregister', () => {
    const a = fakeConn(hub);
    const b = fakeConn(hub);
    hub.subscribe(a.conn.id, 'room-1');
    hub.subscribe(a.conn.id, 'room-2');
    hub.subscribe(b.conn.id, 'room-1');
    hub.unregister(a.conn.id);
    expect(hub.stats().channels).toEqual([{ name: 'room-1', subscribers: 1 }]);
  });
});
