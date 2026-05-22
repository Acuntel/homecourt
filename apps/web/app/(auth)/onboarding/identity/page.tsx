import type { Metadata } from "next";

import { IdentityForm } from "@/components/onboarding/identity-form";

export const metadata: Metadata = {
  title: "Verify your identity",
  description: "Tell HOMECOURT who you are so we can settle markets to the right account.",
};

export default function IdentityPage() {
  return (
    <div className="flex w-full flex-col gap-5">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-xl font-semibold tracking-tight">Tell us who you are</h1>
        <p className="text-muted-fg text-sm">
          Real legal name and a working phone — required so we can settle markets to the right
          account.
        </p>
      </header>
      <IdentityForm />
    </div>
  );
}
