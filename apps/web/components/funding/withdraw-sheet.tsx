"use client";

import { Info } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

type Props = {
  open: boolean;
  onOpenChange: (next: boolean) => void;
};

/**
 * WithdrawSheet — disabled in P0 sweepstakes. Shows the BUILD.md sweepstakes
 * message and offers a button to join the real-money waitlist (placeholder).
 */
export function WithdrawSheet({ open, onOpenChange }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-5 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Withdraw</SheetTitle>
          <SheetDescription>Currently in sweepstakes mode.</SheetDescription>
        </SheetHeader>

        <div className="border-cobalt-500/30 bg-cobalt-500/5 flex items-start gap-3 rounded-md border p-4">
          <Info aria-hidden className="text-cobalt-500 mt-0.5 h-5 w-5 shrink-0" />
          <p className="text-foreground text-sm leading-relaxed">
            Withdrawals open when HOMECOURT goes live with real-money via Kalshi DCM. You&apos;ll be
            first to know.
          </p>
        </div>

        <Button type="button" variant="outline" disabled aria-disabled className="justify-center">
          Withdrawals disabled (sweepstakes)
        </Button>

        <p className="text-muted-fg mt-auto text-[11px] leading-relaxed">
          HOMECOURT Phase 0 is a free-to-play sweepstakes. No purchase necessary. Void where
          prohibited.
        </p>
      </SheetContent>
    </Sheet>
  );
}
