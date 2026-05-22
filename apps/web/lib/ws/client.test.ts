// Smoke tests for EngineWsClient. We stub the global WebSocket so we can
// assert subscribe / message / unsubscribe behavior without a real socket.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EngineWsClient } from "./client";

interface SentFrame {
  type: string;
  channels?: string[];
  ts?: number;
}

class FakeWebSocket {
  static OPEN = 1;
  static CONNECTING = 0;
  static CLOSED = 3;

  url: string;
  readyState = FakeWebSocket.CONNECTING;
  bufferedAmount = 0;
  sent: SentFrame[] = [];

  onopen: (() => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.lastInstance = this;
    // Open asynchronously so callers can wire handlers first.
    queueMicrotask(() => {
      this.readyState = FakeWebSocket.OPEN;
      this.onopen?.();
    });
  }

  send(raw: string): void {
    this.sent.push(JSON.parse(raw) as SentFrame);
  }

  close(): void {
    this.readyState = FakeWebSocket.CLOSED;
    this.onclose?.();
  }

  // Test helper: inject a server frame.
  serverPush(payload: unknown): void {
    this.onmessage?.({ data: JSON.stringify(payload) });
  }

  static lastInstance: FakeWebSocket | null = null;
}

beforeEach(() => {
  // @ts-expect-error — stubbing global for jsdom
  globalThis.WebSocket = FakeWebSocket;
  FakeWebSocket.lastInstance = null;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("EngineWsClient", () => {
  it("opens on first subscribe and emits subscribe frame after open", async () => {
    const client = new EngineWsClient("ws://test/v1/ws");
    const handler = vi.fn();
    client.subscribe("orderbook:abc:0", handler);

    // Wait one microtask for onopen.
    await Promise.resolve();
    await Promise.resolve();

    expect(FakeWebSocket.lastInstance).not.toBeNull();
    expect(FakeWebSocket.lastInstance!.sent[0]).toMatchObject({
      type: "subscribe",
      channels: ["orderbook:abc:0"],
    });
  });

  it("fans out a channel message to matching handlers only", async () => {
    const client = new EngineWsClient("ws://test/v1/ws");
    const a = vi.fn();
    const b = vi.fn();
    client.subscribe("trade:abc", a);
    client.subscribe("trade:xyz", b);
    await Promise.resolve();
    await Promise.resolve();

    FakeWebSocket.lastInstance!.serverPush({
      channel: "trade:abc",
      type: "trade",
      price: 50,
      qty: 10,
      side: "buy",
    });

    expect(a).toHaveBeenCalledTimes(1);
    expect(b).not.toHaveBeenCalled();
    expect(a.mock.calls[0]![0]).toMatchObject({
      channel: "trade:abc",
      type: "trade",
      price: 50,
    });
  });

  it("ignores pong + error frames", async () => {
    const client = new EngineWsClient("ws://test/v1/ws");
    const h = vi.fn();
    client.subscribe("orderbook:abc:0", h);
    await Promise.resolve();
    await Promise.resolve();
    FakeWebSocket.lastInstance!.serverPush({ type: "pong", ts: 1 });
    FakeWebSocket.lastInstance!.serverPush({ type: "error", code: "x", message: "y" });
    expect(h).not.toHaveBeenCalled();
  });

  it("sends unsubscribe frame when last handler for a channel detaches", async () => {
    const client = new EngineWsClient("ws://test/v1/ws");
    const h = vi.fn();
    const unsub = client.subscribe("trade:abc", h);
    await Promise.resolve();
    await Promise.resolve();
    const ws = FakeWebSocket.lastInstance!;
    ws.sent = [];
    unsub();
    expect(ws.sent[0]).toMatchObject({ type: "unsubscribe", channels: ["trade:abc"] });
  });

  it("appends ?token=… when a JWT is set", async () => {
    const client = new EngineWsClient("ws://test/v1/ws");
    client.setToken("jwt.abc.123");
    client.subscribe("fill:user", vi.fn());
    await Promise.resolve();
    await Promise.resolve();
    expect(FakeWebSocket.lastInstance!.url).toContain("?token=jwt.abc.123");
  });

  it("reports status transitions: connecting → open → closed", async () => {
    const client = new EngineWsClient("ws://test/v1/ws");
    const seen: string[] = [];
    client.onStatus((s) => seen.push(s));
    client.subscribe("trade:abc", vi.fn());
    await Promise.resolve();
    await Promise.resolve();
    client.close();
    expect(seen[0]).toBe("closed"); // initial fire
    expect(seen).toContain("connecting");
    expect(seen).toContain("open");
    expect(seen[seen.length - 1]).toBe("closed");
  });
});
