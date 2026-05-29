// HOMECOURT — pure helpers used by lib/markets/feed.ts.
// Split out so the main loader stays under 300 lines.

import type { MarketBucket } from "@homecourt/shared";

export interface RawBucket {
  label: string;
  low_cents: number;
  high_cents: number;
}

export function parseCursor(cursor: string | null | undefined): number {
  if (!cursor) return 0;
  try {
    const decoded = JSON.parse(Buffer.from(cursor, "base64").toString("utf-8")) as {
      offset?: number;
    };
    return typeof decoded.offset === "number" && decoded.offset >= 0 ? decoded.offset : 0;
  } catch {
    return 0;
  }
}

export function encodeCursor(offset: number): string {
  return Buffer.from(JSON.stringify({ offset }), "utf-8").toString("base64");
}

export function coerceBuckets(raw: unknown): MarketBucket[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((b, idx) => {
    const obj = b as Partial<RawBucket>;
    return {
      idx,
      label: String(obj.label ?? ""),
      loCents: Number(obj.low_cents ?? 0),
      hiCents: Number(obj.high_cents ?? 0),
    };
  });
}

export function findAnchorBucket(buckets: MarketBucket[], listPriceCents: number): number {
  if (buckets.length === 0) return 0;
  const hit = buckets.findIndex((b) => listPriceCents >= b.loCents && listPriceCents < b.hiCents);
  if (hit >= 0) return hit;
  let best = 0;
  let bestDelta = Number.POSITIVE_INFINITY;
  buckets.forEach((b, idx) => {
    const mid = (b.loCents + b.hiCents) / 2;
    const delta = Math.abs(mid - listPriceCents);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = idx;
    }
  });
  return best;
}

export function firstPhoto(photos: unknown): string | null {
  if (!Array.isArray(photos)) return null;
  const first = photos[0];
  return typeof first === "string" && first.length > 0 ? first : null;
}

export function clampPriceCents(value: number): number {
  if (!Number.isFinite(value)) return 50;
  return Math.max(1, Math.min(99, Math.round(value)));
}

/** Implied YES price for the anchor bucket. Priority:
 *  1. last real fill on the anchor outcome (real trading),
 *  2. the persisted model opening line (data-derived, no RNG),
 *  3. an even 1/N prior as a last resort. */
export function deriveYesPriceCents(
  fillsByMarket: Map<string, Map<number, number>>,
  marketId: string,
  anchorIdx: number,
  bucketCount: number,
  openingYesPriceCents?: number | null,
): number {
  const byOutcome = fillsByMarket.get(marketId);
  if (byOutcome && byOutcome.has(anchorIdx)) {
    return clampPriceCents(byOutcome.get(anchorIdx) ?? 0);
  }
  if (openingYesPriceCents != null) {
    return clampPriceCents(openingYesPriceCents);
  }
  const prior = Math.round(100 / Math.max(1, bucketCount));
  return clampPriceCents(prior);
}
