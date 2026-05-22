// HOMECOURT — Supabase middleware helper. Refreshes auth cookies on every request
// and performs auth-aware redirects per BUILD.md M3 spec.

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@homecourt/db";

import { supabaseAnonKey, supabaseUrl } from "./config";

// Routes that REQUIRE a session. Anonymous users hitting these get bounced to /login.
const PROTECTED_PREFIXES = ["/markets", "/portfolio", "/watchlist", "/onboarding"];

// Routes a logged-in user should NEVER be on (we redirect them onward).
const AUTH_ONLY_PREFIXES = ["/signup", "/login"];

const ONBOARDING_PREFIXES = ["/onboarding"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // IMPORTANT: do not run code between createServerClient and getUser().
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
  const isAuthOnly = AUTH_ONLY_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
  const isOnboarding = ONBOARDING_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );

  // Logged-out + protected → /login
  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Logged-in + auth-only → punt to /markets (final redirect target decided below)
  if (user && isAuthOnly) {
    const url = request.nextUrl.clone();
    url.pathname = "/markets";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // For logged-in users hitting protected (non-onboarding) routes, ensure they've
  // finished onboarding. The DB has the source of truth.
  if (user && isProtected && !isOnboarding) {
    const { data: row } = await supabase
      .from("users")
      .select("kyc_status, display_name, phone")
      .eq("id", user.id)
      .maybeSingle();

    if (!row || row.kyc_status !== "approved") {
      const url = request.nextUrl.clone();
      // Pick the right onboarding step.
      if (!row || !row.display_name || !row.phone) {
        url.pathname = "/onboarding/identity";
      } else {
        url.pathname = "/onboarding/kyc";
      }
      return NextResponse.redirect(url);
    }
  }

  return response;
}
