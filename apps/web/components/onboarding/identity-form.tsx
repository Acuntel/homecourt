"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, ArrowRight } from "lucide-react";

import { identitySchema, type IdentityInput } from "@homecourt/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * IdentityForm — step 1 of onboarding. Captures name/DOB/phone, plus a mocked
 * phone-verify code (000000). Posts to /api/auth/verify-phone for the code,
 * then to the saveIdentity server action to persist on public.users.
 */
export function IdentityForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [stage, setStage] = useState<"details" | "verify">("details");
  const [phoneCode, setPhoneCode] = useState("");
  const [phoneCodeErr, setPhoneCodeErr] = useState<string | null>(null);

  const form = useForm<IdentityInput>({
    resolver: zodResolver(identitySchema),
    defaultValues: {
      legalFirstName: "",
      legalLastName: "",
      dob: "",
      phone: "",
    },
  });

  const onSendCode = async (values: IdentityInput) => {
    setSubmitting(true);
    try {
      // P0: pretend we sent a 6-digit code; user must enter 000000 to pass.
      toast.info("Mock code sent. Use 000000 to verify.");
      setStage("verify");
      void values;
    } finally {
      setSubmitting(false);
    }
  };

  const onVerify = async () => {
    setPhoneCodeErr(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/verify-phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: phoneCode }),
      });
      const json: { ok?: boolean; error?: string } = await res.json();
      if (!res.ok || !json.ok) {
        setPhoneCodeErr(json.error ?? "Invalid code.");
        return;
      }
      // Persist identity to public.users.
      const values = form.getValues();
      const save = await fetch("/api/onboarding/identity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const savedJson: { ok?: boolean; error?: string } = await save.json();
      if (!save.ok || !savedJson.ok) {
        toast.error(savedJson.error ?? "Couldn't save your identity.");
        return;
      }
      toast.success("Phone verified.");
      router.push("/onboarding/kyc");
    } catch {
      toast.error("Couldn't reach the server. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (stage === "verify") {
    return (
      <div className="flex flex-col gap-4">
        <div className="border-border bg-muted/30 rounded-md border p-3">
          <p className="text-foreground text-sm font-medium">Verify your phone</p>
          <p className="text-muted-fg text-xs">
            Enter the 6-digit code we sent to{" "}
            <span className="text-foreground">{form.getValues("phone")}</span>. (P0: use{" "}
            <code className="font-mono text-xs">000000</code>.)
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="phone-code">6-digit code</Label>
          <Input
            id="phone-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="000000"
            value={phoneCode}
            onChange={(e) => setPhoneCode(e.target.value)}
            aria-invalid={!!phoneCodeErr}
          />
          {phoneCodeErr ? <p className="text-no-500 text-xs">{phoneCodeErr}</p> : null}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => setStage("details")}>
            Edit details
          </Button>
          <Button
            type="button"
            onClick={onVerify}
            disabled={submitting || phoneCode.length !== 6}
            className="flex-1 justify-center gap-2"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="h-4 w-4" />
            )}
            Verify
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(onSendCode)} className="flex flex-col gap-4" noValidate>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="first-name">First name</Label>
          <Input
            id="first-name"
            autoComplete="given-name"
            aria-invalid={!!form.formState.errors.legalFirstName}
            {...form.register("legalFirstName")}
          />
          {form.formState.errors.legalFirstName ? (
            <p className="text-no-500 text-xs">{form.formState.errors.legalFirstName.message}</p>
          ) : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="last-name">Last name</Label>
          <Input
            id="last-name"
            autoComplete="family-name"
            aria-invalid={!!form.formState.errors.legalLastName}
            {...form.register("legalLastName")}
          />
          {form.formState.errors.legalLastName ? (
            <p className="text-no-500 text-xs">{form.formState.errors.legalLastName.message}</p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="dob">Date of birth</Label>
        <Input
          id="dob"
          type="date"
          autoComplete="bday"
          aria-invalid={!!form.formState.errors.dob}
          {...form.register("dob")}
        />
        {form.formState.errors.dob ? (
          <p className="text-no-500 text-xs">{form.formState.errors.dob.message}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="phone">Mobile phone</Label>
        <Input
          id="phone"
          type="tel"
          autoComplete="tel"
          placeholder="+1 555 555 5555"
          aria-invalid={!!form.formState.errors.phone}
          {...form.register("phone")}
        />
        {form.formState.errors.phone ? (
          <p className="text-no-500 text-xs">{form.formState.errors.phone.message}</p>
        ) : null}
      </div>

      <Button type="submit" disabled={submitting} className="mt-1 justify-center gap-2">
        {submitting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ArrowRight className="h-4 w-4" />
        )}
        Send 6-digit code
      </Button>
    </form>
  );
}
