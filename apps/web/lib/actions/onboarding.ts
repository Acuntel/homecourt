// HOMECOURT — onboarding server actions (identity, phone verify, KYC, 2FA).
"use server";

import { z } from "zod";

import { authAction } from "@/lib/safe-action";
import { identitySchema, verifyPhoneSchema, twoFaSchema } from "@homecourt/shared";
import { log } from "@/lib/log";
import { provisionStartingFunds } from "@/lib/onboarding/provision";
import { createServiceClient } from "@/lib/supabase/server";

/** Step 1 — save identity details onto public.users. */
export const saveIdentityAction = authAction
  .schema(identitySchema)
  .action(async ({ parsedInput, ctx }) => {
    const db = createServiceClient();
    const fullName = `${parsedInput.legalFirstName} ${parsedInput.legalLastName}`.trim();
    const { error } = await db
      .from("users")
      .update({
        display_name: fullName,
        phone: parsedInput.phone,
      })
      .eq("id", ctx.user.id);
    if (error) {
      log.error({ err: error.message }, "saveIdentity failed");
      throw new Error(error.message);
    }
    return { ok: true as const };
  });

/** Mock phone verification — code `000000` works. */
export const verifyPhoneAction = authAction
  .schema(verifyPhoneSchema)
  .action(async ({ parsedInput }) => {
    if (parsedInput.code !== "000000") {
      throw new Error("Invalid code. Use 000000 in sweepstakes mode.");
    }
    return { ok: true as const };
  });

/** Mock 2FA — accepts any 6 digits (validated by schema). */
export const setupTwoFaAction = authAction.schema(twoFaSchema).action(async () => {
  return { ok: true as const };
});

/** Skip 2FA — no-op, just signals the wizard advances. */
export const skipTwoFaAction = authAction
  .schema(z.object({}))
  .action(async () => ({ ok: true as const }));

/** Sweepstakes-mode KYC submit = auto-approve. */
export const submitKycAction = authAction.schema(z.object({})).action(async ({ ctx }) => {
  const db = createServiceClient();
  const { error } = await db.from("users").update({ kyc_status: "approved" }).eq("id", ctx.user.id);
  if (error) {
    log.error({ err: error.message }, "submitKyc failed");
    throw new Error(error.message);
  }
  // Ensure an accounts row exists in case we want to deposit on /fund.
  await provisionAccountOnly(ctx.user.id);
  return { ok: true as const };
});

async function provisionAccountOnly(userId: string) {
  const db = createServiceClient();
  const { data: existing } = await db
    .from("accounts")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!existing) {
    await db.from("accounts").insert({ user_id: userId });
  }
}

/** Credit the welcome bonus + send the user to /markets. Idempotent. */
export const completeOnboardingAction = authAction.schema(z.object({})).action(async ({ ctx }) => {
  const result = await provisionStartingFunds(ctx.user.id);
  return { ...result, ok: true as const };
});
