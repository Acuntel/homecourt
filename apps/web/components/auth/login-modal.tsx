"use client";

import Link from "next/link";
import { useState } from "react";

import { Separator } from "@/components/ui/separator";
import { GoogleButton, AppleButton } from "@/components/auth/oauth-buttons";
import { EmailLoginForm } from "@/components/auth/email-login-form";
import { DevSkipLogin } from "@/components/auth/dev-skip-login";

export function LoginModal() {
  const [sentTo, setSentTo] = useState<string | null>(null);

  return (
    <div className="flex w-full max-w-sm flex-col gap-5">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-xl font-semibold tracking-tight">Welcome back to HOMECOURT</h1>
        <p className="text-muted-fg text-sm">
          Already have an account? Pick a sign-in method below.
        </p>
      </header>

      <div className="flex flex-col gap-2">
        <GoogleButton />
        <AppleButton />
      </div>

      <div className="flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-muted-fg text-xs uppercase tracking-wide">or</span>
        <Separator className="flex-1" />
      </div>

      {sentTo ? (
        <SentNotice email={sentTo} onReset={() => setSentTo(null)} />
      ) : (
        <EmailLoginForm onSent={(e) => setSentTo(e)} />
      )}

      <DevSkipLogin />

      <p className="text-muted-fg pt-1 text-[11px] leading-relaxed">
        New to HOMECOURT?{" "}
        <Link href="/signup" className="text-cobalt-500 underline-offset-2 hover:underline">
          Create an account
        </Link>
        .
      </p>
    </div>
  );
}

function SentNotice({ email, onReset }: { email: string; onReset: () => void }) {
  return (
    <div className="border-border bg-muted/40 flex flex-col gap-2 rounded-md border p-4">
      <div className="text-foreground text-sm font-medium">Magic link sent.</div>
      <p className="text-muted-fg text-xs">
        We emailed a sign-in link to <span className="text-foreground">{email}</span>. Open it to
        log in.
      </p>
      <button
        type="button"
        onClick={onReset}
        className="text-cobalt-500 self-start text-xs underline-offset-2 hover:underline"
      >
        Use a different email
      </button>
    </div>
  );
}
