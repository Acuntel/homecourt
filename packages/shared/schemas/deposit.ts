// HOMECOURT — deposit / withdraw zod schemas.

import { z } from "zod";

const idempotencyKeyRegex = /^hcrt_(deposit|withdraw)_[0-9a-f-]{36}$/;

export const depositSchema = z.object({
  amountCents: z.coerce
    .number()
    .int("Whole cents only.")
    .min(100, "Minimum 100 coins.")
    .max(1_000_000, "Maximum 1,000,000 coins per deposit."),
  idempotencyKey: z.string().regex(idempotencyKeyRegex, "Invalid idempotency key."),
});

export const withdrawSchema = z.object({
  amountCents: z.coerce
    .number()
    .int("Whole cents only.")
    .min(100, "Minimum 100 coins.")
    .max(10_000_000, "Maximum 10,000,000 coins per withdrawal."),
  idempotencyKey: z.string().regex(idempotencyKeyRegex, "Invalid idempotency key."),
});

export type DepositInput = z.infer<typeof depositSchema>;
export type WithdrawInput = z.infer<typeof withdrawSchema>;
