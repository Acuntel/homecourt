// NATS publisher for market lifecycle events.
//
// Subjects:
//   engine.lifecycle.<slug>   — { type: 'settled', winning_outcome_idx, final_price_cents }
//
// This worker is publish-only. If NATS is unreachable we log + continue —
// settlement is durable in Postgres regardless.

import { connect, type NatsConnection, StringCodec } from "nats";
import { log } from "./db.js";

let conn: NatsConnection | null = null;
const codec = StringCodec();

export async function getNats(): Promise<NatsConnection | null> {
  if (conn !== null) return conn;
  const url = process.env.NATS_URL ?? "nats://localhost:4222";
  try {
    conn = await connect({
      servers: url,
      name: "homecourt-oracle",
      reconnect: true,
      maxReconnectAttempts: -1,
    });
    log.info({ url }, "nats connected");
    return conn;
  } catch (err) {
    log.warn({ err: errMsg(err), url }, "nats unavailable — settlement events skipped");
    conn = null;
    return null;
  }
}

export interface LifecyclePayload {
  type: "settled" | "voided";
  market_id: string;
  slug: string;
  winning_outcome_idx: number | null;
  final_price_cents: number | null;
  ts: string;
}

export async function publishLifecycle(slug: string, payload: LifecyclePayload): Promise<void> {
  const nc = await getNats();
  if (!nc) return;
  const subject = `engine.lifecycle.${slug}`;
  try {
    nc.publish(subject, codec.encode(JSON.stringify(payload)));
  } catch (err) {
    log.warn({ err: errMsg(err), subject }, "publish lifecycle failed");
  }
}

export async function closeNats(): Promise<void> {
  if (conn) {
    await conn.drain();
    conn = null;
  }
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
