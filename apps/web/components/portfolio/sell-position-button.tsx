"use client";

// HOMECOURT — small client button that POSTs a counter-market-order to
// /api/orders to close out a position. For a YES (buy) position we send a
// SELL of the same outcome at 1¢ (market-take). For a NO (sell) position
// we send a BUY at 99¢. Engine matches against the resting book.
//
// This is the same toast-on-fill pattern as TradeConfirmModal — keep it
// thin so users get instant feedback.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

interface ApiOk {
  ok: true;
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

interface SellPositionButtonProps {
  marketSlug: string;
  outcome: number;
  side: "YES" | "NO";
  qty: number;
}

export function SellPositionButton({ marketSlug, outcome, side, qty }: SellPositionButtonProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [, startTransition] = useTransition();

  async function onClick() {
    if (submitting || qty <= 0) return;
    setSubmitting(true);
    try {
      // Counter-order: YES position → SELL @ 1¢ (sweep bids).
      // NO position  → BUY  @ 99¢ (sweep asks).
      const counterSide = side === "YES" ? "sell" : "buy";
      const priceCents = side === "YES" ? 1 : 99;

      const res = await fetch("/api/orders", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marketSlug,
          outcome,
          side: counterSide,
          priceCents,
          qty,
        }),
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => ({ error: "request_failed" }))) as ApiErr;
        toast.error(err.message ?? err.error ?? "Sell failed.");
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
        toast.success("Sell order placed — resting on the book.");
      }
      startTransition(() => router.refresh());
    } catch {
      toast.error("Network error — try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Button
      size="sm"
      variant="outline"
      type="button"
      onClick={onClick}
      disabled={submitting}
      className="h-7 px-2 text-xs"
    >
      {submitting ? "Selling…" : "Sell"}
    </Button>
  );
}
