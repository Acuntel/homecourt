// HOMECOURT — pure helpers that turn a book snapshot + user input into the
// "Live computed" block shown above the CTA in <TradePanel>.
//
// All inputs are cents (1..99) and integer qty. Outputs avgPrice in cents
// (rounded), fee in cents, max payout in cents (qty * 100), profit in cents,
// and slippage as a percentage relative to the best quote.

import { calcFeeCents } from "@/lib/fees";
import type { BookLevel } from "@homecourt/shared";

export interface TradePreview {
  /** Whether the desired qty can be filled at all from the visible book. */
  canFill: boolean;
  /** Qty actually fillable from the book (≤ requested). */
  fillableQty: number;
  /** Weighted average fill price in cents (1..99). 0 if !canFill. */
  avgPriceCents: number;
  /** Best quote on the relevant side of the book in cents. 0 if absent. */
  bestPriceCents: number;
  /** Total cost (qty × avg price) in cents. */
  costCents: number;
  /** Taker fee in cents at the average price. */
  feeCents: number;
  /** Max payout in cents — $1.00 per contract on a winning side. */
  maxPayoutCents: number;
  /** Profit if the position settles in your favour. */
  profitIfWinCents: number;
  /** Slippage = (avg − best) / best, percentage, signed >= 0. */
  slippagePct: number;
}

const EMPTY_PREVIEW: TradePreview = {
  canFill: false,
  fillableQty: 0,
  avgPriceCents: 0,
  bestPriceCents: 0,
  costCents: 0,
  feeCents: 0,
  maxPayoutCents: 0,
  profitIfWinCents: 0,
  slippagePct: 0,
};

/**
 * For a "buy YES" market order, walk asks ascending; for "buy NO", invert
 * the YES asks (NO best ask price = 100 − YES best bid price) and walk
 * bids descending. The caller chooses which side to pass — this helper
 * just consumes a list of `[priceCents, qty]` levels in fill-priority
 * order (best first).
 */
export function buyMarketPreview(levels: BookLevel[], qty: number): TradePreview {
  if (qty <= 0 || levels.length === 0) return EMPTY_PREVIEW;

  let remaining = qty;
  let costCents = 0;
  let filled = 0;
  for (const [price, available] of levels) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, available);
    if (take <= 0) continue;
    costCents += take * price;
    filled += take;
    remaining -= take;
  }
  if (filled === 0) return EMPTY_PREVIEW;

  const avgPriceCents = Math.max(1, Math.min(99, Math.round(costCents / filled)));
  const bestPriceCents = levels[0]?.[0] ?? 0;
  const feeCents = calcFeeCents(avgPriceCents, filled);
  const maxPayoutCents = filled * 100;
  const profitIfWinCents = maxPayoutCents - costCents - feeCents;
  const slippagePct =
    bestPriceCents > 0 ? ((avgPriceCents - bestPriceCents) / bestPriceCents) * 100 : 0;

  return {
    canFill: remaining === 0,
    fillableQty: filled,
    avgPriceCents,
    bestPriceCents,
    costCents,
    feeCents,
    maxPayoutCents,
    profitIfWinCents,
    slippagePct: Math.max(0, slippagePct),
  };
}

/**
 * Build a preview for a limit "buy" order. With a known limit price the
 * fill is assumed at the limit (worst-case from the trader's point of view),
 * so cost and fees are deterministic — no book walk required.
 */
export function buyLimitPreview(priceCents: number, qty: number): TradePreview {
  if (qty <= 0 || priceCents < 1 || priceCents > 99) return EMPTY_PREVIEW;
  const costCents = priceCents * qty;
  const feeCents = calcFeeCents(priceCents, qty);
  const maxPayoutCents = qty * 100;
  return {
    canFill: true,
    fillableQty: qty,
    avgPriceCents: priceCents,
    bestPriceCents: priceCents,
    costCents,
    feeCents,
    maxPayoutCents,
    profitIfWinCents: maxPayoutCents - costCents - feeCents,
    slippagePct: 0,
  };
}

/**
 * Convert the YES book into the NO side. NO ask at price P corresponds to
 * the YES bid at (100 − P), and vice versa. Levels are returned in
 * fill-priority order (best first).
 */
export function noAsksFromYesBook(bids: BookLevel[]): BookLevel[] {
  // Best NO ask = cheapest place to buy NO = 100 − highest YES bid.
  return [...bids]
    .sort((a, b) => b[0] - a[0])
    .map(([price, qty]): BookLevel => [Math.max(1, Math.min(99, 100 - price)), qty]);
}

/** Best YES ask = cheapest to buy YES; levels sorted ascending. */
export function yesAsksSorted(asks: BookLevel[]): BookLevel[] {
  return [...asks].sort((a, b) => a[0] - b[0]);
}

/**
 * Convert a whole-dollar amount into a contract qty at a given price (cents).
 * Returns integer contracts, rounded down so we never overcommit cash.
 */
export function dollarsToQty(dollarAmount: number, priceCents: number): number {
  if (dollarAmount <= 0 || priceCents <= 0) return 0;
  return Math.floor((dollarAmount * 100) / priceCents);
}
