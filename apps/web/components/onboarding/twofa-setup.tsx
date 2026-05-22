"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, KeyRound, SkipForward } from "lucide-react";

import { twoFaSchema, type TwoFaInput } from "@homecourt/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const STATIC_TOTP_SECRET = "ZX5K-7BQH-MJ2N-9LFC";

/**
 * TwoFASetup — P0 mocks the QR via a placeholder SVG. Any \d{6} code passes.
 * "Skip" advances without enrolling.
 */
export function TwoFASetup() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<TwoFaInput>({
    resolver: zodResolver(twoFaSchema),
    defaultValues: { code: "" },
  });

  const onSubmit = async (values: TwoFaInput) => {
    setSubmitting(true);
    try {
      // P0: regex already validates 6 digits. No server round-trip required.
      void values;
      toast.success("Two-factor enrolled.");
      router.push("/onboarding/fund");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="border-border bg-card grid grid-cols-[120px,1fr] items-start gap-4 rounded-md border p-4">
        <div
          aria-label="2FA QR code"
          className="bg-foreground/95 grid h-[120px] w-[120px] grid-cols-8 grid-rows-8 gap-px overflow-hidden rounded-md p-1"
        >
          {Array.from({ length: 64 }).map((_, i) => (
            <span
              key={i}
              className={((i * 7) % 3 === 0 ? "bg-background" : "bg-foreground") + " block"}
            />
          ))}
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">Scan with Google Authenticator or 1Password</p>
          <p className="text-muted-fg text-xs">Or enter the setup key by hand:</p>
          <code className="border-border bg-muted/50 text-foreground inline-flex w-fit rounded border px-2 py-1 font-mono text-xs">
            {STATIC_TOTP_SECRET}
          </code>
          <p className="text-muted-fg text-[11px]">
            Sweepstakes mode — any 6-digit code will be accepted.
          </p>
        </div>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3" noValidate>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="twofa-code">6-digit code</Label>
          <Input
            id="twofa-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            maxLength={6}
            aria-invalid={!!form.formState.errors.code}
            {...form.register("code")}
          />
          {form.formState.errors.code ? (
            <p className="text-no-500 text-xs">{form.formState.errors.code.message}</p>
          ) : null}
        </div>

        <div className="flex gap-2 pt-1">
          <Button type="submit" disabled={submitting} className="flex-1 justify-center gap-2">
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <KeyRound className="h-4 w-4" />
            )}
            Enable 2FA
          </Button>
          <Button
            type="button"
            variant="outline"
            className="justify-center gap-2"
            onClick={() => router.push("/onboarding/fund")}
          >
            <SkipForward className="h-4 w-4" />
            Skip
          </Button>
        </div>
      </form>
    </div>
  );
}
