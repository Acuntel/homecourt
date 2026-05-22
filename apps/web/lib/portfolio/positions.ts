// HOMECOURT — portfolio positions aggregator (Open + Settled + Resting).
//
// Derived from filled orders (filled_qty > 0). One position per
// (market_id, outcome, side). For each open position:
//   - qty:               sum of filled_qty
//   - avgCostCents:      volume-weighted avg of price_cents
//   - markCents:         current YES price (from last fill) or 50¢ fallback
//   - unrealizedPnlCents: (mark - avg) * qty
//   - maxPayoutCents:    qty * 100
//
// Markets in state="settled"/"voided" are handled by `loadSettledPositions`.

import { createServiceClient } from "@/lib/supabase/server";
import { log } from "@/lib/log";
import {
  bucketLabelFor,
  groupFilledOrders,
  parseBuckets,
  type FillRow,
  type MarketRow,
  type MarketWithProperty,
  type OrderRow,
} from "@/lib/portfolio/internal";

export interface Position {
  marketId: string;
  marketSlug: string;
  marketState: MarketRow["state"];
  address: string;
  outcome: number;
  bucketLabel: string;
  side: "YES" | "NO";
  qty: number;
  avgCostCents: number;
  markCents: number;
  unrealizedPnlCents: number;
  maxPayoutCents: number;
}

export interface SettledPosition {
  marketId: string;
  marketSlug: string;
  address: string;
  outcome: number;
  bucketLabel: string;
  side: "YES" | "NO";
  qty: number;
  avgCostCents: number;
  finalPriceCents: number;
  netPnlCents: number;
}

export interface RestingOrder {
  id: string;
  marketId: string;
  marketSlug: string;
  address: string;
  outcome: number;
  bucketLabel: string;
  side: "YES" | "NO";
  priceCents: number;
  qty: number;
  filledQty: number;
  remainingQty: number;
  status: "open" | "partial";
  createdAt: string;
}

export async function loadOpenPositions(userId: string): Promise<Position[]> {
  const db = createServiceClient();

  const { data: orderRows, error } = await db
    .from("orders")
    .select("market_id, outcome, side, price_cents, filled_qty, qty, status")
    .eq("user_id", userId)
    .gt("filled_qty", 0)
    .returns<OrderRow[]>();

  if (error) {
    log.error({ err: error.message, userId }, "loadOpenPositions orders failed");
    return [];
  }
  if (!orderRows || orderRows.length === 0) return [];

  const grouped = groupFilledOrders(orderRows);
  const marketIds = Array.from(new Set(Array.from(grouped.values(), (g) => g.marketId)));
  if (marketIds.length === 0) return [];

  const { data: marketsData, error: mkErr } = await db
    .from("markets")
    .select("id, slug, state, buckets, properties:property_id (address, city, zip)")
    .in("id", marketIds)
    .returns<MarketWithProperty[]>();

  if (mkErr) {
    log.error({ err: mkErr.message, userId }, "loadOpenPositions markets failed");
    return [];
  }
  const markets = new Map<string, MarketWithProperty>();
  for (const m of marketsData ?? []) markets.set(m.id, m);

  // Most recent fill price per (market, outcome) → use as `mark`.
  const { data: fillRows } = await db
    .from("fills")
    .select("market_id, outcome, price_cents, created_at")
    .in("market_id", marketIds)
    .order("created_at", { ascending: false })
    .limit(5000)
    .returns<FillRow[]>();

  const lastFill = new Map<string, number>();
  for (const f of fillRows ?? []) {
    const k = `${f.market_id}:${f.outcome}`;
    if (!lastFill.has(k)) lastFill.set(k, f.price_cents);
  }

  const positions: Position[] = [];
  for (const g of grouped.values()) {
    const market = markets.get(g.marketId);
    if (!market) continue;
    if (market.state === "settled" || market.state === "voided") continue;

    const buckets = parseBuckets(market.buckets);
    const avg = g.qty > 0 ? Math.round(g.costCents / g.qty) : 0;
    const sideLabel: "YES" | "NO" = g.side === "buy" ? "YES" : "NO";
    const markYes = lastFill.get(`${g.marketId}:${g.outcome}`) ?? 50;
    const mark = sideLabel === "YES" ? markYes : 100 - markYes;

    positions.push({
      marketId: g.marketId,
      marketSlug: market.slug,
      marketState: market.state,
      address: market.properties?.address ?? "—",
      outcome: g.outcome,
      bucketLabel: bucketLabelFor(buckets, g.outcome),
      side: sideLabel,
      qty: g.qty,
      avgCostCents: avg,
      markCents: mark,
      unrealizedPnlCents: (mark - avg) * g.qty,
      maxPayoutCents: g.qty * 100,
    });
  }

  positions.sort((a, b) => Math.abs(b.unrealizedPnlCents) - Math.abs(a.unrealizedPnlCents));
  return positions;
}

/**
 * Settled positions — markets with state=settled/voided. P&L:
 *   YES: (final == outcome ? 100 : 0 - avg) * qty
 *   NO:  inverse.
 */
export async function loadSettledPositions(userId: string): Promise<SettledPosition[]> {
  const db = createServiceClient();

  const { data: orderRows, error } = await db
    .from("orders")
    .select("market_id, outcome, side, price_cents, filled_qty, qty, status")
    .eq("user_id", userId)
    .gt("filled_qty", 0)
    .returns<OrderRow[]>();

  if (error) {
    log.error({ err: error.message, userId }, "loadSettledPositions orders failed");
    return [];
  }
  if (!orderRows || orderRows.length === 0) return [];

  const grouped = groupFilledOrders(orderRows);
  const marketIds = Array.from(new Set(Array.from(grouped.values(), (g) => g.marketId)));
  if (marketIds.length === 0) return [];

  const { data: marketsData } = await db
    .from("markets")
    .select("id, slug, state, buckets, final_bucket, properties:property_id (address, city, zip)")
    .in("id", marketIds)
    .in("state", ["settled", "voided"])
    .returns<(MarketWithProperty & { final_bucket: number | null })[]>();

  const settledMarkets = new Map<string, MarketWithProperty & { final_bucket: number | null }>();
  for (const m of marketsData ?? []) settledMarkets.set(m.id, m);

  const out: SettledPosition[] = [];
  for (const g of grouped.values()) {
    const market = settledMarkets.get(g.marketId);
    if (!market) continue;

    const buckets = parseBuckets(market.buckets);
    const avg = g.qty > 0 ? Math.round(g.costCents / g.qty) : 0;
    const sideLabel: "YES" | "NO" = g.side === "buy" ? "YES" : "NO";
    const yesFinal = market.final_bucket === g.outcome ? 100 : 0;
    const finalCents = sideLabel === "YES" ? yesFinal : 100 - yesFinal;

    out.push({
      marketId: g.marketId,
      marketSlug: market.slug,
      address: market.properties?.address ?? "—",
      outcome: g.outcome,
      bucketLabel: bucketLabelFor(buckets, g.outcome),
      side: sideLabel,
      qty: g.qty,
      avgCostCents: avg,
      finalPriceCents: finalCents,
      netPnlCents: (finalCents - avg) * g.qty,
    });
  }

  out.sort((a, b) => Math.abs(b.netPnlCents) - Math.abs(a.netPnlCents));
  return out;
}

/** Resting orders — status in (open, partial) with remaining qty > 0. */
export async function loadRestingOrders(userId: string): Promise<RestingOrder[]> {
  const db = createServiceClient();

  interface RestRow {
    id: string;
    market_id: string;
    outcome: number;
    side: "buy" | "sell";
    price_cents: number;
    qty: number;
    filled_qty: number;
    status: "open" | "partial";
    created_at: string;
  }

  const { data, error } = await db
    .from("orders")
    .select("id, market_id, outcome, side, price_cents, qty, filled_qty, status, created_at")
    .eq("user_id", userId)
    .in("status", ["open", "partial"])
    .order("created_at", { ascending: false })
    .limit(200)
    .returns<RestRow[]>();

  if (error) {
    log.error({ err: error.message, userId }, "loadRestingOrders failed");
    return [];
  }
  const rows = data ?? [];
  if (rows.length === 0) return [];

  const marketIds = Array.from(new Set(rows.map((r) => r.market_id)));
  const { data: marketsData } = await db
    .from("markets")
    .select("id, slug, state, buckets, properties:property_id (address, city, zip)")
    .in("id", marketIds)
    .returns<MarketWithProperty[]>();

  const markets = new Map<string, MarketWithProperty>();
  for (const m of marketsData ?? []) markets.set(m.id, m);

  const out: RestingOrder[] = [];
  for (const r of rows) {
    const remaining = r.qty - r.filled_qty;
    if (remaining <= 0) continue;
    const market = markets.get(r.market_id);
    const buckets = parseBuckets(market?.buckets);
    out.push({
      id: r.id,
      marketId: r.market_id,
      marketSlug: market?.slug ?? "",
      address: market?.properties?.address ?? "—",
      outcome: r.outcome,
      bucketLabel: bucketLabelFor(buckets, r.outcome),
      side: r.side === "buy" ? "YES" : "NO",
      priceCents: r.price_cents,
      qty: r.qty,
      filledQty: r.filled_qty,
      remainingQty: remaining,
      status: r.status,
      createdAt: r.created_at,
    });
  }
  return out;
}
