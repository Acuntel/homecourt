// HOMECOURT — order schemas.
//
// Two surfaces:
//   1. `orderFormSchema` — discriminated union driving the <TradePanel> form
//      (Quick / Limit modes with mode-specific fields).
//   2. `placeOrderSchema` — flat body the client sends to POST /api/orders
//      (and the route re-validates before forwarding to the engine).

import { z } from "zod";

// ---------------------------------------------------------------------------
// Form-level schema — drives the trade panel UI via react-hook-form.
// ---------------------------------------------------------------------------

export const tradeSideSchema = z.enum(["YES", "NO"]);
export type TradeSide = z.infer<typeof tradeSideSchema>;

export const tradeAmountModeSchema = z.enum(["contracts", "dollars"]);
export type TradeAmountMode = z.infer<typeof tradeAmountModeSchema>;

export const tradeExpirySchema = z.enum(["gtc", "1h", "1d", "eod"]);
export type TradeExpiry = z.infer<typeof tradeExpirySchema>;

export const quickOrderSchema = z.object({
  mode: z.literal("quick"),
  side: tradeSideSchema,
  amountMode: tradeAmountModeSchema,
  /** Either contracts (qty) or whole-dollar amount, depending on amountMode. */
  amount: z.number().int().positive("Enter an amount."),
});

export const limitOrderSchema = z.object({
  mode: z.literal("limit"),
  side: tradeSideSchema,
  priceCents: z.number().int().min(1, "Min 1¢.").max(99, "Max 99¢."),
  amountMode: tradeAmountModeSchema,
  amount: z.number().int().positive("Enter an amount."),
  expiry: tradeExpirySchema,
});

export const orderFormSchema = z.discriminatedUnion("mode", [quickOrderSchema, limitOrderSchema]);

export type QuickOrderInput = z.infer<typeof quickOrderSchema>;
export type LimitOrderInput = z.infer<typeof limitOrderSchema>;
export type OrderFormInput = z.infer<typeof orderFormSchema>;

// ---------------------------------------------------------------------------
// Wire schema — what POST /api/orders accepts.
// ---------------------------------------------------------------------------

export const orderIdempotencyKeyRegex = /^hcrt_order_[0-9a-f-]{36}$/;

export const placeOrderSchema = z.object({
  marketSlug: z.string().min(1, "Missing market."),
  outcome: z.number().int().min(0).max(4),
  side: z.enum(["buy", "sell"]),
  priceCents: z.number().int().min(1, "Min 1¢.").max(99, "Max 99¢."),
  qty: z.number().int().min(1, "At least 1 share.").max(10_000, "Max 10,000 shares per order."),
  /** Optional — server generates if omitted. */
  idempotencyKey: z.string().regex(orderIdempotencyKeyRegex).optional(),
});

export type PlaceOrderInput = z.infer<typeof placeOrderSchema>;
