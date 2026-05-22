// HOMECOURT — provision an account row + welcome deposit for a brand-new user.
// Idempotent: re-running this is safe. Uses the service-role client because
// users.accounts is otherwise RLS-locked on insert.

import "server-only";

import { createServiceClient } from "@/lib/supabase/server";
import { sweepstakesStartingCoins } from "@/lib/supabase/config";
import { log } from "@/lib/log";

export type ProvisionResult = {
  ok: true;
  alreadyProvisioned: boolean;
  cashCents: number;
};

/**
 * Make sure the given userId has:
 *   1. A `public.accounts` row,
 *   2. At least the starting-coins balance via a `journal` deposit entry.
 *
 * Returns `{alreadyProvisioned: true}` if a deposit already existed.
 * Throws on unexpected DB errors so the caller can surface them.
 */
export async function provisionStartingFunds(userId: string): Promise<ProvisionResult> {
  const db = createServiceClient();
  const starting = sweepstakesStartingCoins();

  // 1. Ensure an accounts row exists.
  const { data: existingAccount, error: accountSelectErr } = await db
    .from("accounts")
    .select("id, cash_cents")
    .eq("user_id", userId)
    .maybeSingle();
  if (accountSelectErr) throw new Error(accountSelectErr.message);

  if (!existingAccount) {
    const { error: insertAccountErr } = await db
      .from("accounts")
      .insert({ user_id: userId, cash_cents: 0, locked_cents: 0 });
    if (insertAccountErr) throw new Error(insertAccountErr.message);
  }

  // 2. Check if an initial deposit already exists.
  const { data: priorDeposits, error: priorErr } = await db
    .from("journal")
    .select("id")
    .eq("user_id", userId)
    .eq("kind", "deposit")
    .eq("ref", "signup_bonus")
    .limit(1);
  if (priorErr) throw new Error(priorErr.message);

  if (priorDeposits && priorDeposits.length > 0) {
    const { data: acc } = await db
      .from("accounts")
      .select("cash_cents")
      .eq("user_id", userId)
      .maybeSingle();
    return {
      ok: true,
      alreadyProvisioned: true,
      cashCents: Number(acc?.cash_cents ?? 0),
    };
  }

  // 3. Insert the welcome deposit. The `journal_sync_account` trigger updates
  //    accounts.cash_cents = balance_after_cents.
  const { error: depositErr } = await db.from("journal").insert({
    user_id: userId,
    kind: "deposit",
    amount_cents: starting,
    balance_after_cents: starting,
    ref: "signup_bonus",
  });
  if (depositErr) throw new Error(depositErr.message);

  log.info({ userId, starting }, "provisioned starting funds");
  return { ok: true, alreadyProvisioned: false, cashCents: starting };
}
