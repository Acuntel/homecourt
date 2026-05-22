"use client";

// HOMECOURT — review-trade confirmation Dialog.
// Posts to /api/orders with idempotency-keyed body; toast on fill/partial/rest.

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FeeTooltip } from "@/components/trade/fee-tooltip";
import { formatPriceCents, formatUsdCents } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TradePreview } from "@/lib/trade/preview";
import type { TradeSide } from "@homecourt/shared";

interface TradeConfirmModalProps {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  slug: string;
  bucketLabel: string;
  side: TradeSide;
  outcomeIdx: number;
  priceCents: number;
  qty: number;
  preview: TradePreview;
  mode: "quick" | "limit";
}

interface ApiOk {
  ok: true;
  idempotentReplay?: boolean;
  order: {
    order_id: string;
    status: "open" | "partial" | "filled" | "cancelled";
    filled_qty: number;
    resting_qty: number;
  };
}

interface ApiErr {
  error: string;
  message?: string;
}

export function TradeConfirmModal({
  open,
  onOpenChange,
  slug,
  bucketLabel,
  side,
  outcomeIdx,
  priceCents,
  qty,
  preview,
  mode,
}: TradeConfirmModalProps) {
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marketSlug: slug,
          outcome: outcomeIdx,
          // YES = buy the outcome share; NO = sell the outcome share. The
          // engine matches buys against sells on the same outcome bucket.
          side: side === "YES" ? "buy" : "sell",
          priceCents,
          qty,
        }),
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => ({ error: "request_failed" }))) as ApiErr;
        toast.error(err.message ?? err.error ?? "Order rejected.");
        return;
      }

      const body = (await res.json()) as ApiOk;
      const status = body.order.status;
      if (status === "filled") {
        toast.success(`Filled — ${body.order.filled_qty} contracts.`);
      } else if (status === "partial") {
        toast.success(
          `Partial — ${body.order.filled_qty} filled, ${body.order.resting_qty} resting.`,
        );
      } else {
        toast.success(`Order placed — resting on the book.`);
      }
      // Refresh queries so feed/portfolio see the new fill.
      await queryClient.invalidateQueries({ queryKey: ["markets"] });
      await queryClient.invalidateQueries({ queryKey: ["orderbook"] });
      onOpenChange(false);
    } catch {
      toast.error("Network error — try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Review your trade</DialogTitle>
          <DialogDescription className="text-muted-fg text-xs">
            Sweepstakes mode — no real money is at risk in Phase 0.
          </DialogDescription>
        </DialogHeader>

        <dl className="border-border bg-muted/30 my-1 flex flex-col gap-2 rounded-md border p-3 text-sm">
          <Row label="Side" value={`Buy ${side}`} accent={side === "YES" ? "ok" : "no"} />
          <Row label="Bucket" value={bucketLabel} />
          <Row label="Mode" value={mode === "limit" ? "Limit" : "Quick (market)"} />
          <Row label="Price" value={`${formatPriceCents(priceCents)} per contract`} />
          <Row label="Qty" value={`${qty.toLocaleString("en-US")} contracts`} />
          <Row
            label={
              <span className="inline-flex items-center gap-1">
                Fee <FeeTooltip />
              </span>
            }
            value={formatUsdCents(preview.feeCents, { detailed: true })}
          />
          <Row label="Cost" value={formatUsdCents(preview.costCents, { detailed: true })} />
          <Row
            label="Max payout"
            value={formatUsdCents(preview.maxPayoutCents, { detailed: true })}
            accent="ok"
          />
        </dl>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" type="button" onClick={() => onOpenChange(false)}>
            Back
          </Button>
          <Button type="button" onClick={submit} disabled={submitting} className="min-w-[140px]">
            {submitting ? "Placing…" : "Confirm trade"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface RowProps {
  label: React.ReactNode;
  value: string;
  accent?: "ok" | "no";
}

function Row({ label, value, accent }: RowProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-fg text-xs">{label}</dt>
      <dd
        className={cn(
          "font-mono text-xs tabular-nums",
          accent === "ok" ? "text-court-500" : accent === "no" ? "text-no-500" : "text-foreground",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
