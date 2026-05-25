"use client";

// HOMECOURT — Dev-only "skip login" button.
// Hits the existing /api/auth/dev-password-login route (which returns 404 in
// production) to sign in as a seeded demo user, then redirects to /markets.
// Visible only when NODE_ENV !== 'production' via the NEXT_PUBLIC_DEV_AUTH
// env hint exposed at build time.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const DEMO_USERS = [
  { email: "alice@homecourt.test", label: "alice" },
  { email: "bob@homecourt.test", label: "bob" },
  { email: "carol@homecourt.test", label: "carol" },
] as const;

const DEMO_PASSWORD = "Homecourt!2026";

export function DevSkipLogin() {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  // Hide outside dev/test builds.
  if (process.env.NODE_ENV === "production") return null;

  async function signInAs(email: string, label: string) {
    setBusy(email);
    try {
      const res = await fetch("/api/auth/dev-password-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: DEMO_PASSWORD }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(err.error ?? "Skip-login failed.");
        setBusy(null);
        return;
      }
      toast.success(`Signed in as ${label}.`);
      router.replace("/markets");
      router.refresh();
    } catch {
      toast.error("Network error.");
      setBusy(null);
    }
  }

  return (
    <div className="border-court-500/30 bg-court-500/5 flex flex-col gap-2 rounded-md border p-3">
      <div className="flex items-center gap-1.5">
        <Sparkles className="text-court-500 h-3.5 w-3.5" aria-hidden />
        <span className="text-foreground text-xs font-medium">Dev shortcut</span>
        <span className="text-muted-fg text-[11px]">(disabled in production)</span>
      </div>
      <p className="text-muted-fg text-[11px] leading-relaxed">
        Skip the magic-link round-trip and sign in as a seeded demo user.
      </p>
      <div className="flex flex-wrap gap-1.5">
        {DEMO_USERS.map((u) => (
          <Button
            key={u.email}
            type="button"
            variant="outline"
            size="sm"
            disabled={busy !== null}
            onClick={() => signInAs(u.email, u.label)}
            className="border-court-500/40 text-court-500 hover:bg-court-500/10 hover:text-court-500 h-7 px-2 text-[11px]"
            aria-label={`Sign in as ${u.label}`}
          >
            {busy === u.email ? "Signing in…" : `Sign in as ${u.label}`}
          </Button>
        ))}
      </div>
      <Separator className="bg-court-500/20 my-1" />
      <p className="text-muted-fg text-[10px] leading-relaxed">
        Each demo has 50,000 sweepstakes coins + seeded positions across the Deerfield, IL markets.
      </p>
    </div>
  );
}
