"use client";

import { toast } from "sonner";

import { Button } from "@/components/ui/button";

// Inline brand icons keep the bundle small + a11y-friendly.
function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.75h3.57c2.08-1.92 3.28-4.74 3.28-8.07Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.68l-3.57-2.75c-.99.66-2.26 1.05-3.71 1.05-2.85 0-5.27-1.93-6.13-4.52H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.87 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.36-2.1V7.07H2.18A11 11 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.69-2.83Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.07L5.87 9.9C6.73 7.31 9.15 5.38 12 5.38Z"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4 fill-current">
      <path d="M16.365 1.43c0 1.14-.46 2.23-1.21 3.04-.81.88-2.14 1.55-3.21 1.47-.13-1.1.43-2.25 1.16-3.03.8-.88 2.21-1.55 3.26-1.48ZM20.5 17.36c-.55 1.27-.82 1.83-1.54 2.94-1 1.55-2.43 3.49-4.18 3.5-1.55.02-1.95-1.01-4.06-1-2.1.01-2.55 1.02-4.1 1-1.75-.02-3.1-1.77-4.1-3.32C.31 17.13-.05 11.84 2.2 9.05c1.6-1.98 4.12-3.15 6.5-3.15 2.4 0 3.92 1.32 5.92 1.32 1.93 0 3.1-1.33 5.88-1.33 2.1 0 4.34 1.15 5.94 3.14-5.21 2.85-4.36 10.3-5.94 8.33Z" />
    </svg>
  );
}

const STUB = () =>
  toast.info("OAuth coming soon — use the email magic-link option for sweepstakes mode.");

export function GoogleButton() {
  return (
    <Button
      type="button"
      variant="outline"
      className="w-full justify-center gap-2"
      onClick={STUB}
      aria-label="Continue with Google"
    >
      <GoogleIcon />
      Continue with Google
    </Button>
  );
}

export function AppleButton() {
  return (
    <Button
      type="button"
      variant="outline"
      className="w-full justify-center gap-2"
      onClick={STUB}
      aria-label="Continue with Apple"
    >
      <AppleIcon />
      Continue with Apple
    </Button>
  );
}
