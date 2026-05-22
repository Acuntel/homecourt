"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Mail } from "lucide-react";

import { emailSignUpSchema, type EmailSignUpInput } from "@homecourt/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

type Props = {
  onSent?: (email: string) => void;
};

export function EmailSignUpForm({ onSent }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const form = useForm<EmailSignUpInput>({
    resolver: zodResolver(emailSignUpSchema),
    defaultValues: { email: "", username: "", acceptedTerms: false as never },
  });

  const onSubmit = async (values: EmailSignUpInput) => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const json: { ok?: boolean; error?: string } = await res.json();
      if (!res.ok || !json.ok) {
        toast.error(json.error ?? "Couldn't send the magic link.");
        return;
      }
      toast.success("Check your email for the magic link.");
      onSent?.(values.email);
    } catch {
      toast.error("Couldn't reach the server. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3" noValidate>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="signup-email">Email</Label>
        <Input
          id="signup-email"
          type="email"
          autoComplete="email"
          placeholder="you@homecourt.test"
          aria-invalid={!!form.formState.errors.email}
          aria-describedby={form.formState.errors.email ? "signup-email-err" : undefined}
          {...form.register("email")}
        />
        {form.formState.errors.email ? (
          <p id="signup-email-err" className="text-no-500 text-xs">
            {form.formState.errors.email.message}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="signup-username">Username</Label>
        <Input
          id="signup-username"
          type="text"
          autoComplete="username"
          placeholder="court_rookie"
          aria-invalid={!!form.formState.errors.username}
          aria-describedby={form.formState.errors.username ? "signup-username-err" : undefined}
          {...form.register("username")}
        />
        {form.formState.errors.username ? (
          <p id="signup-username-err" className="text-no-500 text-xs">
            {form.formState.errors.username.message}
          </p>
        ) : null}
      </div>

      <div className="flex items-start gap-2 pt-1">
        <Checkbox
          id="signup-terms"
          checked={!!form.watch("acceptedTerms")}
          onCheckedChange={(v) =>
            form.setValue("acceptedTerms", v === true ? true : (false as never), {
              shouldValidate: true,
            })
          }
          aria-label="Accept terms"
        />
        <Label htmlFor="signup-terms" className="text-muted-fg text-xs leading-snug">
          I accept HOMECOURT&apos;s sweepstakes Terms and Privacy.
        </Label>
      </div>
      {form.formState.errors.acceptedTerms ? (
        <p className="text-no-500 -mt-2 text-xs">{form.formState.errors.acceptedTerms.message}</p>
      ) : null}

      <Button type="submit" disabled={submitting} className="mt-2 w-full justify-center gap-2">
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
        Continue with email
      </Button>
    </form>
  );
}
