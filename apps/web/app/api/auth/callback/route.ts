// HOMECOURT — Supabase auth callback. Exchanges the magic-link `code` for a
// session cookie, then redirects to `next` (defaults to /onboarding/identity).

import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { log } from "@/lib/log";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = searchParams.get("next") ?? "/onboarding/identity";

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    log.warn({ err: error.message }, "exchangeCodeForSession failed");
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      type: type as any,
      token_hash: tokenHash,
    });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    log.warn({ err: error.message }, "verifyOtp failed");
  }

  // Failure → bounce to login with an error flag.
  const url = new URL("/login", origin);
  url.searchParams.set("error", "auth_callback_failed");
  return NextResponse.redirect(url);
}
