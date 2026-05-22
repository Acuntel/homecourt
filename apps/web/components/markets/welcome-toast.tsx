"use client";

import { useEffect } from "react";
import { toast } from "sonner";

/**
 * Fires once on mount when the user lands on /markets?welcome=1 right after
 * completing onboarding. Exact microcopy per BUILD.md §12.
 */
export function WelcomeToast() {
  useEffect(() => {
    toast.success("Welcome to HOMECOURT — here's $500 in play-money to start.");
  }, []);

  return null;
}
