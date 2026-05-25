"use client";

// HOMECOURT — full-screen Kalshi-style trade sheet.
//
//   X  ·  market title                              Dollars
//   🏠 outcome name
//            [ YES | NO ]   ← pill toggle
//
//                 $150
//        $264.39 payout if right        ← or "54% chance · 1.76x payout"
//
//        ───────  $X available  ───────
//
//                  numpad
//              ▶  Slide to Buy
//
// YES → buy the anchor outcome, NO → sell it (the engine's binary mechanic:
// YES at p¢, NO at 100−p¢). Stake is entered in whole dollars via the numpad.

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Delete, Home, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { DialogOverlay, DialogPortal } from "@/components/ui/dialog";
import { SlideToConfirm } from "@/components/trade/slide-to-confirm";
import { formatMultiplier, quote } from "@/lib/trade/multiplier";
import { formatUsdCents } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TradeSide } from "@homecourt/shared";

export interface NumpadTradeSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  marketSlug: string;
  /** Anchor outcome index traded as the binary YES. */
  outcomeIdx: number;
  /** Short market label, e.g. the address. */
  title: string;
  /** The YES question, e.g. "Sells above $650K list". */
  question: string;
  yesPriceCents: number;
  availableCents?: number;
  defaultSide?: TradeSide;
  onTraded?: () => void;
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "del"] as const;

export function NumpadTradeSheet(props: NumpadTradeSheetProps) {
  const { open, onOpenChange, marketSlug, outcomeIdx, title, question } = props;
  const router = useRouter();
  const queryClient = useQueryClient();

  const [side, setSide] = useState<TradeSide>(props.defaultSide ?? "YES");
  const [amountStr, setAmountStr] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Reset when (re)opened so each launch starts clean on the chosen side.
  useEffect(() => {
    if (open) {
      setSide(props.defaultSide ?? "YES");
      setAmountStr("");
      setSubmitting(false);
    }
  }, [open, props.defaultSide]);

  const amountCents = useMemo(() => {
    const n = Number.parseFloat(amountStr);
    return Number.isFinite(n) ? Math.round(n * 100) : 0;
  }, [amountStr]);

  const q = useMemo(
    () => quote(amountCents, props.yesPriceCents, side),
    [amountCents, props.yesPriceCents, side],
  );

  const overBalance = props.availableCents != null && q.costCents > props.availableCents;
  const canBuy = q.contracts > 0 && !overBalance && !submitting;

  function pressKey(key: (typeof KEYS)[number]) {
    setAmountStr((prev) => {
      if (key === "del") return prev.slice(0, -1);
      if (key === ".") return prev.includes(".") ? prev : prev === "" ? "0." : `${prev}.`;
      // Block more than 2 decimal places.
      if (prev.includes(".") && prev.split(".")[1]!.length >= 2) return prev;
      // Avoid leading zeros like "00".
      if (prev === "0") return key;
      if (prev.replace(".", "").length >= 7) return prev;
      return prev + key;
    });
  }

  async function submit() {
    if (!canBuy) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          marketSlug,
          outcome: outcomeIdx,
          side: side === "YES" ? "buy" : "sell",
          priceCents: q.priceCents,
          qty: q.contracts,
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
        toast.error(err.message ?? err.error ?? "Order rejected.");
        return;
      }
      toast.success(`${side} placed — ${q.contracts} contracts.`);
      await queryClient.invalidateQueries({ queryKey: ["orderbook"] });
      await queryClient.invalidateQueries({ queryKey: ["balance"] });
      props.onTraded?.();
      router.refresh();
      onOpenChange(false);
    } catch {
      toast.error("Network error — try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const accent = side === "YES" ? "text-court-500" : "text-no-500";
  const display = amountStr === "" ? "$0" : `$${amountStr}`;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="bg-ink-950/95" />
        <DialogPrimitive.Content
          className="bg-ink-950 fixed inset-0 z-50 mx-auto flex w-full max-w-md flex-col px-6 pb-8 pt-5 outline-none"
          aria-describedby={undefined}
        >
          <DialogPrimitive.Title className="sr-only">
            Trade {title} — {side}
          </DialogPrimitive.Title>

          {/* Top bar */}
          <div className="flex items-center justify-between">
            <DialogPrimitive.Close
              aria-label="Close"
              className="text-foreground/80 hover:text-foreground -ml-1 rounded-md p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              <X className="h-6 w-6" aria-hidden />
            </DialogPrimitive.Close>
            <span className="border-border text-muted-fg rounded-full border px-3 py-1 text-sm">
              Dollars
            </span>
          </div>

          {/* Market + outcome */}
          <div className="mt-5">
            <p className="text-muted-fg truncate text-sm">{title}</p>
            <div className="mt-1 flex items-center gap-2">
              <Home className="text-muted-fg h-5 w-5 shrink-0" aria-hidden />
              <h2 className="text-foreground truncate text-xl font-semibold">{question}</h2>
            </div>
          </div>

          {/* YES / NO toggle */}
          <div className="bg-muted/50 mt-5 flex w-full max-w-[260px] self-center rounded-full p-1">
            <SideToggle side="YES" active={side === "YES"} onClick={() => setSide("YES")} />
            <SideToggle side="NO" active={side === "NO"} onClick={() => setSide("NO")} />
          </div>

          {/* Big amount + payout line */}
          <div className="flex flex-1 flex-col items-center justify-center gap-2 py-4">
            <span className="text-foreground text-7xl font-bold tabular-nums">{display}</span>
            {amountCents === 0 ? (
              <span className={cn("text-base font-semibold", accent)}>
                {q.chancePct}% chance · {formatMultiplier(q.multiplier)} payout
              </span>
            ) : overBalance ? (
              <span className="text-no-500 text-base font-semibold">Not enough balance</span>
            ) : (
              <span className={cn("text-base font-semibold", accent)}>
                {formatUsdCents(q.payoutCents, { detailed: true })} payout if right
              </span>
            )}
          </div>

          {/* Available */}
          {props.availableCents != null ? (
            <div className="text-muted-fg flex items-center gap-3 text-xs">
              <span className="bg-border h-px flex-1" aria-hidden />
              {formatUsdCents(props.availableCents, { detailed: true })} available
              <span className="bg-border h-px flex-1" aria-hidden />
            </div>
          ) : null}

          {/* Numpad */}
          <div className="mt-4 grid grid-cols-3 gap-y-3">
            {KEYS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => pressKey(k)}
                aria-label={k === "del" ? "Delete" : k}
                className="text-foreground mx-auto flex h-12 w-16 items-center justify-center rounded-lg text-2xl font-semibold tabular-nums hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
              >
                {k === "del" ? <Delete className="h-6 w-6" aria-hidden /> : k}
              </button>
            ))}
          </div>

          {/* Slide to buy */}
          <div className="mt-5">
            <SlideToConfirm
              label={`Slide to Buy ${side}`}
              accent={side === "YES" ? "yes" : "no"}
              disabled={!canBuy}
              loading={submitting}
              onConfirm={submit}
            />
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </DialogPrimitive.Root>
  );
}

function SideToggle({
  side,
  active,
  onClick,
}: {
  side: TradeSide;
  active: boolean;
  onClick: () => void;
}) {
  const activeCls = side === "YES" ? "bg-court-500 text-ink-950" : "bg-no-500 text-white";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex-1 rounded-full py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
        active ? activeCls : "text-muted-fg hover:text-foreground",
      )}
    >
      {side}
    </button>
  );
}
