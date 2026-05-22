// HOMECOURT — Aggregate fills into OHLC candles for the PriceChart.
// Used by /api/markets/[slug]/candlesticks and the SSR detail page.

import { createServiceClient } from "@/lib/supabase/server";
import { log } from "@/lib/log";
import type {
  CandlestickInterval,
  MarketCandlestick,
  MarketCandlesticksResponse,
} from "@homecourt/shared";

interface IntervalConfig {
  /** Bucket width in ms. */
  bucketMs: number;
  /** Lookback in ms. null = ALL. */
  lookbackMs: number | null;
}

const INTERVALS: Record<CandlestickInterval, IntervalConfig> = {
  "1H": { bucketMs: 60_000, lookbackMs: 60 * 60_000 },
  "6H": { bucketMs: 5 * 60_000, lookbackMs: 6 * 60 * 60_000 },
  "1D": { bucketMs: 15 * 60_000, lookbackMs: 24 * 60 * 60_000 },
  "1W": { bucketMs: 60 * 60_000, lookbackMs: 7 * 24 * 60 * 60_000 },
  "1M": { bucketMs: 6 * 60 * 60_000, lookbackMs: 30 * 24 * 60 * 60_000 },
  ALL: { bucketMs: 24 * 60 * 60_000, lookbackMs: null },
};

export function parseInterval(raw: string | null | undefined): CandlestickInterval {
  switch ((raw ?? "1D").toUpperCase()) {
    case "1H":
      return "1H";
    case "6H":
      return "6H";
    case "1D":
      return "1D";
    case "1W":
      return "1W";
    case "1M":
      return "1M";
    case "ALL":
      return "ALL";
    default:
      return "1D";
  }
}

interface FillRow {
  price_cents: number;
  qty: number;
  created_at: string;
}

/** Aggregate fills for (marketId, outcome) into OHLC candles at `interval`. */
export async function loadCandlesticks(
  marketId: string,
  outcomeIdx: number,
  interval: CandlestickInterval,
  fallbackPriceCents: number,
): Promise<MarketCandlesticksResponse> {
  const supabase = createServiceClient();
  const cfg = INTERVALS[interval];
  const now = Date.now();
  const since = cfg.lookbackMs ? new Date(now - cfg.lookbackMs).toISOString() : null;

  let query = supabase
    .from("fills")
    .select("price_cents, qty, created_at")
    .eq("market_id", marketId)
    .eq("outcome", outcomeIdx)
    .order("created_at", { ascending: true });
  if (since) query = query.gte("created_at", since);

  const { data: fills, error } = await query.returns<FillRow[]>();
  if (error) {
    log.warn({ err: error, marketId, outcomeIdx }, "candlestick fills query failed");
    return {
      outcomeIdx,
      interval,
      candles: [],
      implicitPriceCents: fallbackPriceCents,
    };
  }

  if (!fills || fills.length === 0) {
    return {
      outcomeIdx,
      interval,
      candles: [],
      implicitPriceCents: fallbackPriceCents,
    };
  }

  const candles = aggregateFills(fills, cfg.bucketMs);
  return {
    outcomeIdx,
    interval,
    candles,
    implicitPriceCents: candles[candles.length - 1]?.c ?? fallbackPriceCents,
  };
}

function aggregateFills(fills: FillRow[], bucketMs: number): MarketCandlestick[] {
  const buckets = new Map<number, { o: number; h: number; l: number; c: number; v: number }>();
  for (const f of fills) {
    const ts = new Date(f.created_at).getTime();
    const bucketKey = Math.floor(ts / bucketMs) * bucketMs;
    const existing = buckets.get(bucketKey);
    const price = f.price_cents;
    const qty = f.qty;
    if (!existing) {
      buckets.set(bucketKey, { o: price, h: price, l: price, c: price, v: qty });
    } else {
      existing.h = Math.max(existing.h, price);
      existing.l = Math.min(existing.l, price);
      existing.c = price;
      existing.v += qty;
    }
  }
  return Array.from(buckets.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([ts, agg]) => ({
      ts: new Date(ts).toISOString(),
      o: agg.o,
      h: agg.h,
      l: agg.l,
      c: agg.c,
      v: agg.v,
    }));
}
