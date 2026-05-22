import type { Metadata } from "next";

import { FundStep } from "@/components/onboarding/fund-step";

export const metadata: Metadata = {
  title: "Fund your account",
  description: "Add play-money coins and start trading on HOMECOURT.",
};

export default function FundPage() {
  return (
    <div className="flex w-full flex-col gap-5">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-xl font-semibold tracking-tight">Add play-money coins</h1>
        <p className="text-muted-fg text-sm">
          Sweepstakes credits only — no real money moves. Pick an amount to start trading.
        </p>
      </header>
      <FundStep />
    </div>
  );
}
