// HOMECOURT — shared types + helpers used across portfolio aggregators.

import type { Database } from "@homecourt/db";

export type MarketRow = Database["public"]["Tables"]["markets"]["Row"];
export type PropertyRow = Database["public"]["Tables"]["properties"]["Row"];

export interface OrderRow {
  market_id: string;
  outcome: number;
  side: "buy" | "sell";
  price_cents: number;
  filled_qty: number;
  qty: number;
  status: string;
}

export interface FillRow {
  market_id: string;
  outcome: number;
  price_cents: number;
  created_at: string;
}

export interface MarketWithProperty extends Pick<MarketRow, "id" | "slug" | "state" | "buckets"> {
  properties: Pick<PropertyRow, "address" | "city" | "zip"> | null;
}

export interface BucketJson {
  idx: number;
  loCents: number;
  hiCents: number;
  label: string;
}

export function parseBuckets(buckets: unknown): BucketJson[] {
  if (!Array.isArray(buckets)) return [];
  return buckets
    .filter((b): b is Record<string, unknown> => typeof b === "object" && b !== null)
    .map((b) => ({
      idx: typeof b.idx === "number" ? b.idx : 0,
      loCents: typeof b.loCents === "number" ? b.loCents : 0,
      hiCents: typeof b.hiCents === "number" ? b.hiCents : 0,
      label: typeof b.label === "string" ? b.label : "—",
    }));
}

export function bucketLabelFor(buckets: BucketJson[], idx: number): string {
  return buckets.find((b) => b.idx === idx)?.label ?? `Bucket ${idx}`;
}

/**
 * Group filled orders by (market_id, outcome, side). Sums qty and
 * cost (= sum(filled_qty * price_cents)).
 */
export function groupFilledOrders(rows: OrderRow[]): Map<
  string,
  {
    marketId: string;
    outcome: number;
    side: "buy" | "sell";
    qty: number;
    costCents: number;
  }
> {
  const grouped = new Map<
    string,
    {
      marketId: string;
      outcome: number;
      side: "buy" | "sell";
      qty: number;
      costCents: number;
    }
  >();
  for (const row of rows) {
    const key = `${row.market_id}:${row.outcome}:${row.side}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.qty += row.filled_qty;
      existing.costCents += row.filled_qty * row.price_cents;
    } else {
      grouped.set(key, {
        marketId: row.market_id,
        outcome: row.outcome,
        side: row.side,
        qty: row.filled_qty,
        costCents: row.filled_qty * row.price_cents,
      });
    }
  }
  return grouped;
}
