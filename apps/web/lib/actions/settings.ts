// HOMECOURT — settings server actions (M12).
"use server";

import { randomBytes } from "node:crypto";

import { updateProfileSchema, createApiKeySchema, revokeApiKeySchema } from "@homecourt/shared";
import type { Json } from "@homecourt/db";
import { authAction } from "@/lib/safe-action";
import { log } from "@/lib/log";
import { createServiceClient } from "@/lib/supabase/server";

/** Persist editable profile fields onto public.users. */
export const updateProfileAction = authAction
  .schema(updateProfileSchema)
  .action(async ({ parsedInput, ctx }) => {
    const db = createServiceClient();
    const phone = parsedInput.phone?.trim() ?? "";
    const { error } = await db
      .from("users")
      .update({
        display_name: parsedInput.displayName,
        phone: phone.length > 0 ? phone : null,
      })
      .eq("id", ctx.user.id);
    if (error) {
      log.error({ err: error.message }, "updateProfile failed");
      throw new Error(error.message);
    }
    return { ok: true as const };
  });

/**
 * P0 stub: generate a `hcrt_sk_<32-hex>` token, store the displayed value
 * inside a `notifications` row (kind=deposit, payload.api_key) since we don't
 * have a dedicated api_keys table yet. Returns the cleartext ONCE.
 */
export const createApiKeyAction = authAction
  .schema(createApiKeySchema)
  .action(async ({ parsedInput, ctx }) => {
    const db = createServiceClient();
    const token = `hcrt_sk_${randomBytes(16).toString("hex")}`;
    const last4 = token.slice(-4);
    const payload: Json = {
      api_key_name: parsedInput.name,
      api_key_last4: last4,
      api_key_created_at: new Date().toISOString(),
      stub: true,
    };
    const { error } = await db.from("notifications").insert({
      user_id: ctx.user.id,
      kind: "deposit",
      payload,
    });
    if (error) {
      log.error({ err: error.message }, "createApiKey insert failed");
      throw new Error(error.message);
    }
    return { ok: true as const, token, last4, name: parsedInput.name };
  });

/** Revoke (delete) the notifications-row that backs an API key stub. */
export const revokeApiKeyAction = authAction
  .schema(revokeApiKeySchema)
  .action(async ({ ctx, parsedInput }) => {
    const db = createServiceClient();
    const { error } = await db
      .from("notifications")
      .delete()
      .eq("id", parsedInput.notificationId)
      .eq("user_id", ctx.user.id);
    if (error) {
      log.error({ err: error.message }, "revokeApiKey failed");
      throw new Error(error.message);
    }
    return { ok: true as const };
  });
