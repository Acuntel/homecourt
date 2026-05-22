"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Coins, SkipForward } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DepositSheet } from "@/components/funding/deposit-sheet";

/**
 * FundStep — final onboarding screen. Opens the DepositSheet by default
 * pre-filled to $500 (per BUILD.md spec). On success or skip, routes to
 * /markets with a `welcome=1` flag so the markets page can show the
 * sonner welcome toast.
 */
export function FundStep() {
  const router = useRouter();
  const [open, setOpen] = useState(true);

  const goToMarkets = () => {
    router.push("/markets?welcome=1");
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="border-court-500/30 bg-court-500/5 flex items-start gap-3 rounded-md border p-4">
        <Coins className="text-court-500 mt-0.5 h-5 w-5 shrink-0" aria-hidden />
        <div className="flex flex-col gap-1">
          <p className="text-foreground text-sm font-medium">
            Sweepstakes only — no purchase necessary.
          </p>
          <p className="text-muted-fg text-xs leading-relaxed">
            We&apos;ll credit play-money coins to your account so you can place your first trade.
            You can top up or cash out (back to coins) anytime.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button onClick={() => setOpen(true)} className="flex-1 justify-center gap-2">
          <Coins className="h-4 w-4" />
          Add play-money coins
        </Button>
        <Button variant="outline" onClick={goToMarkets} className="justify-center gap-2">
          <SkipForward className="h-4 w-4" />
          Skip for now
        </Button>
      </div>

      <DepositSheet
        open={open}
        onOpenChange={setOpen}
        defaultAmountCents={50000}
        onSuccess={() => goToMarkets()}
      />
    </div>
  );
}
