import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { Wordmark } from "@/components/marketing/wordmark";
import { BalancePill } from "@/components/funding/balance-pill";

/**
 * (app) shell — every authenticated, KYC-approved route lives in here.
 *
 * Three gates run server-side on every request:
 *   1. No Supabase session → /login
 *   2. Session but no `public.users` row OR kyc_status !== 'approved' → /onboarding/identity
 *   3. Otherwise → render with a thin TopNav (logo + BalancePill). The full
 *      TopNav (search, watchlist, profile menu, mobile drawer) ships in M4.
 */
export default async function AppShellLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // RLS lets the user read their own row.
  const { data: profile } = await supabase
    .from("users")
    .select("id, username, kyc_status")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.kyc_status !== "approved") {
    redirect("/onboarding/identity");
  }

  // Read account cash via service-role (accounts is RLS-locked tighter).
  const db = createServiceClient();
  const { data: account } = await db
    .from("accounts")
    .select("cash_cents, locked_cents")
    .eq("user_id", user.id)
    .maybeSingle();

  const cashCents = Number(account?.cash_cents ?? 0);
  const lockedCents = Number(account?.locked_cents ?? 0);

  return (
    <div className="bg-background text-foreground flex min-h-screen flex-col">
      <header className="border-border/60 bg-background/80 sticky top-0 z-30 border-b backdrop-blur-md">
        <div className="container flex h-14 items-center justify-between gap-4">
          <Link href="/markets" aria-label="HOMECOURT home" className="rounded-md">
            <Wordmark />
          </Link>
          <div className="flex items-center gap-3">
            <BalancePill cashCents={cashCents} lockedCents={lockedCents} />
          </div>
        </div>
      </header>

      <main id="main" className="container flex-1 py-8">
        {children}
      </main>

      <footer className="border-border/60 border-t">
        <div className="container py-6">
          <p className="text-muted-fg text-[11px] leading-relaxed">
            HOMECOURT Phase 0 is a free-to-play sweepstakes. No purchase necessary. Void where
            prohibited.
          </p>
        </div>
      </footer>
    </div>
  );
}
