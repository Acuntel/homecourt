import type { Metadata } from "next";

import { KycWizard } from "@/components/onboarding/kyc-wizard";

export const metadata: Metadata = {
  title: "KYC",
  description: "Sweepstakes mode — KYC is auto-approved for HOMECOURT Phase 0.",
};

export default function KycPage() {
  return (
    <div className="flex w-full flex-col gap-5">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-xl font-semibold tracking-tight">Quick court check</h1>
        <p className="text-muted-fg text-sm">
          Sweepstakes only — no docs required. We auto-approve so you can start trading play-money
          coins.
        </p>
      </header>
      <KycWizard />
    </div>
  );
}
