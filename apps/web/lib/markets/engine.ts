// HOMECOURT — typed fetch helpers for the Go matching engine.
// Used by the market detail SSR loader to pull initial L2 snapshots.

import { log } from "@/lib/log";
import type { BookLevel, MarketBookSnapshot } from "@homecourt/shared";

interface EngineBookResponse {
  market_id?: string;
  market_slug?: string;
  outcome?: number;
  seq?: number | string;
  bids?: unknown;
  asks?: unknown;
}

function engineBaseUrl(): string {
  const raw = process.env.ENGINE_URL ?? "http://localhost:8080";
  return raw.replace(/\/$/, "");
}

function asLevel(raw: unknown): BookLevel | null {
  if (!Array.isArray(raw) || raw.length < 2) return null;
  const price = Number(raw[0]);
  const qty = Number(raw[1]);
  if (!Number.isFinite(price) || !Number.isFinite(qty)) return null;
  return [Math.round(price), Math.round(qty)];
}

function coerceLevels(raw: unknown): BookLevel[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(asLevel)
    .filter((l): l is BookLevel => l !== null)
    .slice(0, 20);
}

/**
 * Fetch a single L2 snapshot for one outcome bucket from the engine.
 * Returns null on any failure (engine offline, market not registered, …)
 * — the page falls back to an empty book.
 */
export async function fetchBookSnapshot(
  slugOrId: string,
  outcomeIdx: number,
  signal?: AbortSignal,
): Promise<MarketBookSnapshot | null> {
  const url = `${engineBaseUrl()}/v1/book/${encodeURIComponent(slugOrId)}/${outcomeIdx}`;
  try {
    const init: RequestInit = {
      cache: "no-store",
      headers: { accept: "application/json" },
    };
    if (signal) init.signal = signal;
    const res = await fetch(url, init);
    if (!res.ok) {
      // 404 means the market isn't loaded by the engine yet — that's expected
      // in dev when no engine is running. Log warn, not error.
      log.warn({ status: res.status, slugOrId, outcomeIdx }, "engine book snapshot non-ok");
      return null;
    }
    const json = (await res.json()) as EngineBookResponse;
    return {
      outcomeIdx,
      seq: Number(json.seq ?? 0),
      bids: coerceLevels(json.bids),
      asks: coerceLevels(json.asks),
    };
  } catch (err) {
    log.warn({ err, slugOrId, outcomeIdx }, "engine book snapshot fetch failed");
    return null;
  }
}

/**
 * Fetch L2 snapshots for all five outcome buckets in parallel.
 * Failed fetches are filled with an empty book snapshot so the UI is
 * always renderable.
 */
export async function fetchAllBookSnapshots(
  slug: string,
  bucketCount: number,
): Promise<MarketBookSnapshot[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2_000);
  try {
    const results = await Promise.all(
      Array.from({ length: bucketCount }, (_, idx) =>
        fetchBookSnapshot(slug, idx, controller.signal),
      ),
    );
    return results.map(
      (snap, idx) =>
        snap ?? {
          outcomeIdx: idx,
          seq: 0,
          bids: [],
          asks: [],
        },
    );
  } finally {
    clearTimeout(timer);
  }
}
