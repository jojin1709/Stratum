type EventName = 'INSERT' | 'UPDATE' | 'DELETE' | 'broadcast' | 'presence';
type Listener = (payload: any) => void;

export interface RealtimeChannel {
  on(event: EventName, listener: Listener): RealtimeChannel;
  subscribe(): RealtimeChannel;
  unsubscribe(): void;
  send(event: string, payload: unknown): void;
  track(state: Record<string, unknown>): void;
}

/**
 * One WebSocket per client, multiplexed across channels, with exponential-backoff
 * reconnection that re-subscribes automatically. Reconnection is not optional:
 * a realtime client that silently stops receiving events is worse than one that errors.
 */
export class RealtimeClient {
  private socket: WebSocket | null = null;
  private readonly listeners = new Map<string, Map<EventName, Set<Listener>>>();
  private readonly active = new Set<string>();
  private queue: string[] = [];
  private retryMs = 500;
  private closed = false;

  constructor(private readonly url: string, private readonly key: string) {}

  private connect(): void {
    if (this.socket || this.closed) return;
    const socket = new WebSocket(`${this.url}?apikey=${encodeURIComponent(this.key)}`);
    this.socket = socket;

    socket.onopen = () => {
      this.retryMs = 500;
      for (const channel of this.active) {
        socket.send(JSON.stringify({ type: 'subscribe', channel }));
      }
      for (const frame of this.queue.splice(0)) socket.send(frame);
    };

    socket.onmessage = (raw) => {
      let msg: any;
      try { msg = JSON.parse(String(raw.data)); } catch { return; }
      const channelListeners = this.listeners.get(msg.channel);
      if (!channelListeners) return;

      if (msg.type === 'change') {
        for (const fn of channelListeners.get(msg.event?.type as EventName) ?? []) fn(msg.event);
      } else if (msg.type === 'broadcast') {
        for (const fn of channelListeners.get('broadcast') ?? []) fn({ event: msg.event, payload: msg.payload });
      } else if (msg.type === 'presence') {
        for (const fn of channelListeners.get('presence') ?? []) fn(msg.state);
      }
    };

    socket.onclose = () => {
      this.socket = null;
      if (this.closed) return;
      const delay = this.retryMs;
      this.retryMs = Math.min(this.retryMs * 2, 30_000);
      setTimeout(() => this.connect(), delay);
    };

    socket.onerror = () => socket.close();
  }

  private send(frame: object): void {
    const text = JSON.stringify(frame);
    if (this.socket?.readyState === 1) this.socket.send(text);
    else { this.queue.push(text); this.connect(); }
  }

  channel(name: string): RealtimeChannel {
    if (!this.listeners.has(name)) this.listeners.set(name, new Map());
    const channelListeners = this.listeners.get(name) as Map<EventName, Set<Listener>>;

    const api: RealtimeChannel = {
      on: (event, listener) => {
        const set = channelListeners.get(event) ?? new Set<Listener>();
        set.add(listener);
        channelListeners.set(event, set);
        return api;
      },
      subscribe: () => {
        this.active.add(name);
        this.send({ type: 'subscribe', channel: name });
        return api;
      },
      unsubscribe: () => {
        this.active.delete(name);
        this.listeners.delete(name);
        this.send({ type: 'unsubscribe', channel: name });
      },
      send: (event, payload) => this.send({ type: 'broadcast', channel: name, event, payload }),
      track: (state) => this.send({ type: 'presence', channel: name, state }),
    };
    return api;
  }

  disconnect(): void {
    this.closed = true;
    this.socket?.close();
    this.socket = null;
  }
}
