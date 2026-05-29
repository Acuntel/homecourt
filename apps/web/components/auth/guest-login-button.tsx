"use client";

// HOMECOURT — "Continue as guest" button. Skips signup/magic-link entirely:
// hits /api/auth/guest-login, which provisions a throwaway account with the
// sweepstakes starting balance, then drops the user straight into /markets.
// Works in production.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export function GuestLoginButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function continueAsGuest() {
    setBusy(true);
    try {
      const res = await fetch("/api/auth/guest-login", { method: "POST" });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(err.error ?? "Could not start guest session.");
        setBusy(false);
        return;
      }
      router.replace("/markets");
      router.refresh();
    } catch {
      toast.error("Network error.");
      setBusy(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="w-full gap-2"
      disabled={busy}
      onClick={continueAsGuest}
      aria-label="Continue as guest without signing up"
    >
      <Sparkles className="h-4 w-4" aria-hidden />
      {busy ? "Starting guest session…" : "Skip login — continue as guest"}
    </Button>
  );
}
