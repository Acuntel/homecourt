// HOMECOURT — Engine WebSocket client. One connection per browser tab.
// Lazy connect on first subscribe(), exponential backoff reconnect (1s→30s),
// 25s ping, 1MB backpressure cutoff. Anonymous works for public channels;
// fill:user needs the supabase JWT (auto-appended as ?token=).

import { log } from "@/lib/log";

import type { ChannelHandler, ServerMessage, StatusHandler, WsStatus } from "./types";

export type { ChannelHandler, ServerMessage, StatusHandler, WsStatus } from "./types";

const PING_INTERVAL_MS = 25_000;
const MIN_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;
const MAX_BUFFERED_BYTES = 1_000_000;

function jitter(ms: number): number {
  // ±25% jitter to avoid synchronized reconnect storms.
  const spread = ms * 0.25;
  return ms + (Math.random() * 2 - 1) * spread;
}

/** EngineWsClient wraps one WebSocket. See useEngineWebSocket() to consume. */
export class EngineWsClient {
  private url: string;
  private token: string | null = null;
  private ws: WebSocket | null = null;
  private status: WsStatus = "closed";

  private channelHandlers = new Map<string, Set<ChannelHandler>>();
  private statusHandlers = new Set<StatusHandler>();

  private backoffMs = MIN_BACKOFF_MS;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private bufferTimer: ReturnType<typeof setInterval> | null = null;
  private explicitlyClosed = false;

  constructor(url: string) {
    this.url = url;
  }

  /** Update the URL (no-op if unchanged). Reconnects on change. */
  setUrl(url: string): void {
    if (url === this.url) return;
    this.url = url;
    this.reconnect();
  }

  /**
   * Provide / update the JWT used as ?token=… on the next reconnect. If
   * the token actually changes, force a reconnect so per-user channels
   * pick up the new identity.
   */
  setToken(token: string | null): void {
    if (token === this.token) return;
    this.token = token;
    this.reconnect();
  }

  getStatus(): WsStatus {
    return this.status;
  }

  /** Subscribe to a channel and register a handler. Returns an unsub fn. */
  subscribe(channel: string, handler: ChannelHandler): () => void {
    let set = this.channelHandlers.get(channel);
    const isNewChannel = !set;
    if (!set) {
      set = new Set();
      this.channelHandlers.set(channel, set);
    }
    set.add(handler);

    this.ensureConnected();
    if (isNewChannel && this.ws?.readyState === WebSocket.OPEN) {
      this.send({ type: "subscribe", channels: [channel] });
    }

    return () => this.unsubscribe(channel, handler);
  }

  /** Remove a single handler; if no handlers remain, unsubscribe upstream. */
  unsubscribe(channel: string, handler: ChannelHandler): void {
    const set = this.channelHandlers.get(channel);
    if (!set) return;
    set.delete(handler);
    if (set.size === 0) {
      this.channelHandlers.delete(channel);
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({ type: "unsubscribe", channels: [channel] });
      }
    }
  }

  /** Subscribe to status changes; returns an unsubscribe fn. */
  onStatus(handler: StatusHandler): () => void {
    this.statusHandlers.add(handler);
    // Fire current value immediately so consumers can render without race.
    handler(this.status);
    return () => {
      this.statusHandlers.delete(handler);
    };
  }

  /** Close the connection and stop reconnecting (used by HMR teardown). */
  close(): void {
    this.explicitlyClosed = true;
    this.clearTimers();
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
    }
    this.setStatus("closed");
  }

  private ensureConnected(): void {
    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }
    this.connect();
  }

  private connect(): void {
    if (typeof window === "undefined") return; // SSR safety
    this.explicitlyClosed = false;
    this.setStatus("connecting");

    let url = this.url;
    if (this.token) {
      const sep = url.includes("?") ? "&" : "?";
      url = `${url}${sep}token=${encodeURIComponent(this.token)}`;
    }

    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch (err) {
      log.warn({ err }, "ws: failed to construct WebSocket");
      this.scheduleReconnect();
      return;
    }
    this.ws = ws;

    ws.onopen = () => {
      this.backoffMs = MIN_BACKOFF_MS;
      this.setStatus("open");
      // Re-arm subscriptions for every channel we had handlers for.
      const channels = Array.from(this.channelHandlers.keys());
      if (channels.length > 0) {
        this.send({ type: "subscribe", channels });
      }
      this.startPingTimer();
      this.startBufferTimer();
    };

    ws.onmessage = (ev) => {
      this.handleMessage(ev.data);
    };

    ws.onclose = () => {
      this.clearTimers();
      this.ws = null;
      this.setStatus("closed");
      if (!this.explicitlyClosed) {
        this.scheduleReconnect();
      }
    };

    ws.onerror = () => {
      // The browser closes the socket after error; onclose handles reconnect.
    };
  }

  private reconnect(): void {
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
    }
    this.clearTimers();
    if (this.channelHandlers.size > 0) {
      this.connect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    if (this.channelHandlers.size === 0) return; // nothing to listen for
    const delay = Math.max(MIN_BACKOFF_MS, Math.min(MAX_BACKOFF_MS, jitter(this.backoffMs)));
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
    this.backoffMs = Math.min(MAX_BACKOFF_MS, this.backoffMs * 2);
  }

  private startPingTimer(): void {
    if (this.pingTimer) return;
    this.pingTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({ type: "ping", ts: Date.now() });
      }
    }, PING_INTERVAL_MS);
  }

  private startBufferTimer(): void {
    if (this.bufferTimer) return;
    this.bufferTimer = setInterval(() => {
      if (!this.ws) return;
      if (this.ws.bufferedAmount > MAX_BUFFERED_BYTES) {
        log.warn({ buffered: this.ws.bufferedAmount }, "ws: backpressure — reconnecting");
        try {
          this.ws.close();
        } catch {
          // ignore
        }
      }
    }, 2_000);
  }

  private clearTimers(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    if (this.bufferTimer) {
      clearInterval(this.bufferTimer);
      this.bufferTimer = null;
    }
  }

  private setStatus(next: WsStatus): void {
    if (next === this.status) return;
    this.status = next;
    for (const h of this.statusHandlers) h(next);
  }

  private send(payload: unknown): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    try {
      this.ws.send(JSON.stringify(payload));
    } catch (err) {
      log.warn({ err }, "ws: send failed");
    }
  }

  private handleMessage(raw: unknown): void {
    if (typeof raw !== "string") return;
    let msg: ServerMessage;
    try {
      msg = JSON.parse(raw) as ServerMessage;
    } catch {
      return;
    }
    // pong / error are surfaced via debug logs; channel messages fan out.
    if (msg.type === "pong") return;
    if (msg.type === "error") {
      log.debug({ code: msg.code, message: msg.message }, "ws: server error");
      return;
    }
    if (!msg.channel) return;
    const set = this.channelHandlers.get(msg.channel);
    if (!set || set.size === 0) return;
    for (const h of set) {
      try {
        h(msg);
      } catch (err) {
        log.warn({ err }, "ws: handler threw");
      }
    }
  }
}

export { getEngineWsClient } from "./singleton";
