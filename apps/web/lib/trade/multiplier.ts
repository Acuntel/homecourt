// HOMECOURT — consumer "multiplier" framing of a binary contract.
//
// Kalshi shows the casual trader three numbers instead of an order book:
//   • chance   — the market's implied probability (= the price in cents)
//   • payout   — the multiplier on each dollar staked  (100 / priceCents)
//   • return   — what you collect if you're right  (stake × multiplier)
//
// A binary contract priced at p¢ costs p¢ and pays $1.00 (100¢) if it
// resolves in your favour. YES trades at the anchor price; NO trades at the
// complementary price (100 − p). All money is integer cents.

import type { TradeSide } from "@homecourt/shared";

/** Clamp a contract price into the tradeable 1..99¢ band. */
export function clampPriceCents(priceCents: number): number {
  return Math.max(1, Math.min(99, Math.round(priceCents)));
}

/** Price (cents) of the chosen side, given the market's YES price. */
export function sidePriceCents(yesPriceCents: number, side: TradeSide): number {
  const yes = clampPriceCents(yesPriceCents);
  return side === "YES" ? yes : clampPriceCents(100 - yes);
}

/** Implied chance (0..100) of the chosen side resolving in your favour. */
export function chancePct(yesPriceCents: number, side: TradeSide): number {
  return sidePriceCents(yesPriceCents, side);
}

/** Payout multiplier on each dollar staked — e.g. 57¢ → 1.75x. */
export function multiplier(yesPriceCents: number, side: TradeSide): number {
  return 100 / sidePriceCents(yesPriceCents, side);
}

/** Format a multiplier as "1.76x" (2 decimals, trailing zeros kept). */
export function formatMultiplier(mult: number): string {
  return `${mult.toFixed(2)}x`;
}

export interface MultiplierQuote {
  /** Side price in cents (1..99). */
  priceCents: number;
  /** Implied chance as a percentage (1..99). */
  chancePct: number;
  /** Payout multiplier (100 / priceCents). */
  multiplier: number;
  /** Whole contracts the stake buys at this price (floored). */
  contracts: number;
  /** Actual amount spent in cents (contracts × priceCents). */
  costCents: number;
  /** Total returned if right, in cents (contracts × 100 = stake × multiplier). */
  payoutCents: number;
  /** Net profit if right, in cents (payout − cost). */
  profitCents: number;
}

/**
 * Build the full consumer quote for a stake (in cents) on a side.
 * Contracts are floored so we never spend more than the stake; the displayed
 * cost reflects the whole-contract spend, with any remainder returned.
 */
export function quote(stakeCents: number, yesPriceCents: number, side: TradeSide): MultiplierQuote {
  const priceCents = sidePriceCents(yesPriceCents, side);
  const contracts = stakeCents > 0 ? Math.floor(stakeCents / priceCents) : 0;
  const costCents = contracts * priceCents;
  const payoutCents = contracts * 100;
  return {
    priceCents,
    chancePct: priceCents,
    multiplier: 100 / priceCents,
    contracts,
    costCents,
    payoutCents,
    profitCents: payoutCents - costCents,
  };
}
