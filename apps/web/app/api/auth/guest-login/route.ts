// HOMECOURT — POST /api/auth/guest-login.
// "Skip login" / guest entry: provisions a fresh throwaway account (unique
// generated email + random password) via the service-role admin API, grants
// the sweepstakes starting balance, then signs that user into the request's
// session cookies. Lets people try the app without a magic-link round-trip or
// signup. Safe in production — each click is its own isolated guest account.

import { NextResponse } from "next/server";

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { provisionStartingFunds } from "@/lib/onboarding/provision";
import { log } from "@/lib/log";

export async function POST() {
  const admin = createServiceClient();

  // Unique, non-colliding identity. users.email is UNIQUE NOT NULL, so we
  // can't lean on Supabase anonymous sign-ins (those have a null email and
  // would collide in the public.users mirror trigger).
  const id = crypto.randomUUID();
  const short = id.slice(0, 8);
  const email = `guest-${id}@guest.homecourt.app`;
  const password = `Gst!${crypto.randomUUID()}`;
  const username = `guest-${short}`;

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username, display_name: `Guest ${short}`, is_guest: true },
  });
  if (createErr || !created.user) {
    log.error({ err: createErr?.message }, "guest-login createUser failed");
    return NextResponse.json({ error: "Could not start guest session." }, { status: 500 });
  }

  // Grant starting coins + account row (idempotent).
  try {
    await provisionStartingFunds(created.user.id);
  } catch (err) {
    log.error({ err: (err as Error).message }, "guest-login provisioning failed");
    return NextResponse.json({ error: "Could not provision guest funds." }, { status: 500 });
  }

  // Mark the guest as fully onboarded so the auth middleware lets them straight
  // into /markets instead of bouncing through the identity/KYC wizard.
  const { error: onboardErr } = await admin
    .from("users")
    .update({ kyc_status: "approved", display_name: `Guest ${short}`, phone: "guest" })
    .eq("id", created.user.id);
  if (onboardErr) {
    log.error({ err: onboardErr.message }, "guest-login onboarding skip failed");
    return NextResponse.json({ error: "Could not finalize guest session." }, { status: 500 });
  }

  // Sign in on the cookie-bound client so the session cookies land on the
  // response (this is a Route Handler, so cookie mutation is allowed).
  const supabase = await createClient();
  const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
  if (signInErr) {
    log.error({ err: signInErr.message }, "guest-login sign-in failed");
    return NextResponse.json({ error: "Could not sign in guest." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, userId: created.user.id });
}
