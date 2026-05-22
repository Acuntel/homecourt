"use client";

import { useState, useId } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Coins } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { depositSchema, type DepositInput } from "@homecourt/shared";

const CHIPS: { label: string; cents: number | "custom" }[] = [
  { label: "$25", cents: 2500 },
  { label: "$100", cents: 10000 },
  { label: "$500", cents: 50000 },
  { label: "Custom", cents: "custom" },
];

function newIdempotencyKey(): string {
  // crypto.randomUUID is available in Node 19+ and all modern browsers.
  return `hcrt_deposit_${crypto.randomUUID()}`;
}

type Props = {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  defaultAmountCents?: number;
  onSuccess?: (cashCents: number) => void;
};

export function DepositSheet({ open, onOpenChange, defaultAmountCents = 50000, onSuccess }: Props) {
  const id = useId();
  const [chip, setChip] = useState<number | "custom">(defaultAmountCents);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<DepositInput>({
    resolver: zodResolver(depositSchema),
    defaultValues: {
      amountCents: defaultAmountCents,
      idempotencyKey: newIdempotencyKey(),
    },
  });

  const selectChip = (v: number | "custom") => {
    setChip(v);
    if (typeof v === "number") {
      form.setValue("amountCents", v, { shouldValidate: true });
    } else {
      form.setValue("amountCents", 0, { shouldValidate: false });
    }
  };

  const onSubmit = async (values: DepositInput) => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/funding/deposit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": values.idempotencyKey,
        },
        body: JSON.stringify(values),
      });
      const json: { ok?: boolean; cashCents?: number; error?: string } = await res.json();
      if (!res.ok || !json.ok) {
        toast.error(json.error ?? "Couldn't add coins.");
        return;
      }
      toast.success("Coins added — you're trading with sweepstakes credits.");
      onSuccess?.(json.cashCents ?? 0);
      onOpenChange(false);
    } catch {
      toast.error("Couldn't reach the server. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const amountErr = form.formState.errors.amountCents?.message;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-5 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Add play-money coins</SheetTitle>
          <SheetDescription>Sweepstakes credits only — no real money moves.</SheetDescription>
        </SheetHeader>

        <form
          id={id}
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
          noValidate
        >
          <div className="grid grid-cols-4 gap-2">
            {CHIPS.map((c) => {
              const active = c.cents === "custom" ? chip === "custom" : chip === c.cents;
              return (
                <button
                  key={c.label}
                  type="button"
                  onClick={() => selectChip(c.cents)}
                  className={cn(
                    "border-border bg-card focus-visible:ring-court-500 rounded-md border px-3 py-2 text-sm transition focus-visible:outline-none focus-visible:ring-2",
                    active
                      ? "border-court-500 bg-court-500/10 text-foreground"
                      : "hover:border-court-500/40 text-foreground",
                  )}
                >
                  {c.label}
                </button>
              );
            })}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="deposit-amount">Amount (USD)</Label>
            <div className="relative">
              <span
                aria-hidden
                className="text-muted-fg absolute left-3 top-1/2 -translate-y-1/2 text-sm"
              >
                $
              </span>
              <Input
                id="deposit-amount"
                type="number"
                inputMode="decimal"
                min={1}
                step={1}
                className="pl-6"
                value={
                  chip === "custom"
                    ? form.watch("amountCents") === 0
                      ? ""
                      : Math.round(form.watch("amountCents") / 100)
                    : Math.round(form.watch("amountCents") / 100)
                }
                onChange={(e) => {
                  const dollars = Number(e.target.value || 0);
                  setChip("custom");
                  form.setValue("amountCents", Math.round(dollars * 100), {
                    shouldValidate: true,
                  });
                }}
                aria-invalid={!!amountErr}
              />
            </div>
            {amountErr ? <p className="text-no-500 text-xs">{amountErr}</p> : null}
          </div>

          <Button type="submit" disabled={submitting} className="mt-2 justify-center gap-2">
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Coins className="h-4 w-4" />
            )}
            Add play-money coins
          </Button>
        </form>

        <p className="text-muted-fg mt-auto text-[11px] leading-relaxed">
          HOMECOURT Phase 0 is a free-to-play sweepstakes. No purchase necessary. Void where
          prohibited.
        </p>
      </SheetContent>
    </Sheet>
  );
}
