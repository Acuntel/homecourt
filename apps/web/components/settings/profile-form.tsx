"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { updateProfileSchema, type UpdateProfileInput } from "@homecourt/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateProfileAction } from "@/lib/actions/settings";

interface ProfileFormProps {
  username: string;
  displayName: string;
  email: string;
  phone: string;
}

export function ProfileForm({ username, displayName, email, phone }: ProfileFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: { displayName, phone },
  });

  const onSubmit = async (values: UpdateProfileInput) => {
    setSubmitting(true);
    try {
      const result = await updateProfileAction(values);
      if (result?.serverError || result?.validationErrors) {
        toast.error("Couldn't save your profile. Try again.");
        return;
      }
      toast.success("Profile updated.");
      router.refresh();
    } catch {
      toast.error("Couldn't reach the server. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      noValidate
      data-testid="profile-form"
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="settings-username">Username</Label>
        <Input id="settings-username" value={username} readOnly disabled className="opacity-80" />
        <p className="text-muted-fg text-xs">Locked in P0. Contact support to change.</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="settings-display-name">Display name</Label>
        <Input
          id="settings-display-name"
          autoComplete="name"
          aria-invalid={!!form.formState.errors.displayName}
          {...form.register("displayName")}
        />
        {form.formState.errors.displayName ? (
          <p className="text-no-500 text-xs">{form.formState.errors.displayName.message}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="settings-email">Email</Label>
        <Input
          id="settings-email"
          type="email"
          value={email}
          readOnly
          disabled
          className="opacity-80"
        />
        <p className="text-muted-fg text-xs">Use magic-link from /login to change.</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="settings-phone">Phone</Label>
        <Input
          id="settings-phone"
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

      <div>
        <Button type="submit" disabled={submitting} className="gap-2">
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Save className="h-4 w-4" aria-hidden />
          )}
          Save changes
        </Button>
      </div>
    </form>
  );
}
