import { redirect } from "next/navigation";

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { TopNav } from "@/components/nav/top-nav";

/**
 * (app) shell — every authenticated, KYC-approved route lives in here.
 *
 * Three gates run server-side on every request:
 *   1. No Supabase session → /login
 *   2. Session but no `public.users` row OR kyc_status !== 'approved' → /onboarding/identity
 *   3. Otherwise → render with the full TopNav (logo + search + balance + bell + avatar).
 */
export default async function AppShellLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("id, username, email, kyc_status")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.kyc_status !== "approved") {
    redirect("/onboarding/identity");
  }

  // Account cash via service-role (accounts is RLS-locked tighter).
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
      <TopNav
        cashCents={cashCents}
        lockedCents={lockedCents}
        username={profile.username}
        email={profile.email}
      />

      <main id="main" className="container flex-1 py-6">
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
