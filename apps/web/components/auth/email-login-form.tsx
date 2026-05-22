"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Mail } from "lucide-react";

import { emailLoginSchema, type EmailLoginInput } from "@homecourt/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  onSent?: (email: string) => void;
};

export function EmailLoginForm({ onSent }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const form = useForm<EmailLoginInput>({
    resolver: zodResolver(emailLoginSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = async (values: EmailLoginInput) => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
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
        <Label htmlFor="login-email">Email</Label>
        <Input
          id="login-email"
          type="email"
          autoComplete="email"
          placeholder="you@homecourt.test"
          aria-invalid={!!form.formState.errors.email}
          aria-describedby={form.formState.errors.email ? "login-email-err" : undefined}
          {...form.register("email")}
        />
        {form.formState.errors.email ? (
          <p id="login-email-err" className="text-no-500 text-xs">
            {form.formState.errors.email.message}
          </p>
        ) : null}
      </div>

      <Button type="submit" disabled={submitting} className="mt-1 w-full justify-center gap-2">
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
        Continue with email
      </Button>
    </form>
  );
}
