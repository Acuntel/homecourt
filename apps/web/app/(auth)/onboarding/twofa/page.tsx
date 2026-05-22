import type { Metadata } from "next";

import { TwoFASetup } from "@/components/onboarding/twofa-setup";

export const metadata: Metadata = {
  title: "Enable 2FA",
  description: "Add a 6-digit code to keep your HOMECOURT account safe.",
};

export default function TwoFaPage() {
  return (
    <div className="flex w-full flex-col gap-5">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-xl font-semibold tracking-tight">Lock it down with 2FA</h1>
        <p className="text-muted-fg text-sm">
          Scan the QR with your authenticator and enter the 6-digit code. Or skip — you can enable
          it later from settings.
        </p>
      </header>
      <TwoFASetup />
    </div>
  );
}
