// HOMECOURT — funding server actions (deposit + withdraw).
"use server";

import { authAction } from "@/lib/safe-action";
import { depositSchema, withdrawSchema } from "@homecourt/shared";
import { createServiceClient } from "@/lib/supabase/server";
import { log } from "@/lib/log";

/** Credit the user's account via a journal `deposit` entry. The
 * `journal_sync_account` trigger updates accounts.cash_cents. Idempotent
 * on (user_id, idempotencyKey). */
export const depositAction = authAction
  .schema(depositSchema)
  .action(async ({ parsedInput, ctx }) => {
    const db = createServiceClient();

    // Idempotency check — look for an existing journal entry with this ref.
    const { data: existing } = await db
      .from("journal")
      .select("id")
      .eq("user_id", ctx.user.id)
      .eq("ref", parsedInput.idempotencyKey)
      .limit(1);
    if (existing && existing.length > 0) {
      const { data: acc } = await db
        .from("accounts")
        .select("cash_cents")
        .eq("user_id", ctx.user.id)
        .maybeSingle();
      return {
        ok: true as const,
        idempotent: true as const,
        cashCents: Number(acc?.cash_cents ?? 0),
      };
    }

    // Make sure an accounts row exists.
    const { data: account } = await db
      .from("accounts")
      .select("id, cash_cents")
      .eq("user_id", ctx.user.id)
      .maybeSingle();
    let currentCash = Number(account?.cash_cents ?? 0);
    if (!account) {
      const { error: e } = await db.from("accounts").insert({ user_id: ctx.user.id });
      if (e) throw new Error(e.message);
      currentCash = 0;
    }

    const newBalance = currentCash + parsedInput.amountCents;
    const { error } = await db.from("journal").insert({
      user_id: ctx.user.id,
      kind: "deposit",
      amount_cents: parsedInput.amountCents,
      balance_after_cents: newBalance,
      ref: parsedInput.idempotencyKey,
    });
    if (error) {
      log.error({ err: error.message }, "deposit failed");
      throw new Error(error.message);
    }
    return { ok: true as const, idempotent: false as const, cashCents: newBalance };
  });

/** P0 sweepstakes: withdrawals are disabled. */
export const withdrawAction = authAction
  .schema(withdrawSchema)
  .action(async () => ({ ok: false as const, reason: "sweepstakes" as const }));
