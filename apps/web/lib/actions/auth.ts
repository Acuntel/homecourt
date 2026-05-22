// HOMECOURT — auth server actions (magic-link + OAuth flows).
"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { action } from "@/lib/safe-action";
import { emailSignUpSchema, emailLoginSchema } from "@homecourt/shared";
import { log } from "@/lib/log";

/** Signup with email magic-link. Username stored in user_metadata; the
 * `handle_new_auth_user` trigger mirrors it into public.users. */
export const signupAction = action.schema(emailSignUpSchema).action(async ({ parsedInput }) => {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsedInput.email,
    options: {
      emailRedirectTo: `${getSiteUrl()}/auth/callback?next=/onboarding/identity`,
      data: {
        username: parsedInput.username,
        display_name: parsedInput.username,
      },
      shouldCreateUser: true,
    },
  });
  if (error) {
    log.warn({ err: error.message }, "signup magic-link failed");
    throw new Error(error.message);
  }
  return { ok: true as const };
});

/** Login = magic link too. shouldCreateUser is false so we don't auto-signup
 * someone who typo'd their email. */
export const loginAction = action.schema(emailLoginSchema).action(async ({ parsedInput }) => {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsedInput.email,
    options: {
      emailRedirectTo: `${getSiteUrl()}/auth/callback?next=/markets`,
      shouldCreateUser: false,
    },
  });
  if (error) {
    log.warn({ err: error.message }, "login magic-link failed");
    throw new Error(error.message);
  }
  return { ok: true as const };
});

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? process.env.VERCEL_URL ?? "http://localhost:3000";
}
