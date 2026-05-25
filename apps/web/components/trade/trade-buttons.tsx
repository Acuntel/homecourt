"use client";

// HOMECOURT — the two big multiplier buttons from Kalshi's market detail.
// "YES 1.76x" (green) / "NO 2.09x" (red). Tapping either opens the
// full-screen <NumpadTradeSheet> pre-selected to that side.

import { useState } from "react";

import { NumpadTradeSheet } from "@/components/trade/numpad-trade-sheet";
import { sidePriceCents } from "@/lib/trade/multiplier";
import { formatPriceCents } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TradeSide } from "@homecourt/shared";

interface TradeButtonsProps {
  marketSlug: string;
  outcomeIdx: number;
  title: string;
  question: string;
  yesPriceCents: number;
  availableCents?: number;
  className?: string;
}

export function TradeButtons({
  marketSlug,
  outcomeIdx,
  title,
  question,
  yesPriceCents,
  availableCents,
  className,
}: TradeButtonsProps) {
  const [open, setOpen] = useState(false);
  const [side, setSide] = useState<TradeSide>("YES");

  function launch(s: TradeSide) {
    setSide(s);
    setOpen(true);
  }

  return (
    <>
      <div className={cn("grid grid-cols-2 gap-3", className)}>
        <BigSideButton
          side="YES"
          priceCents={sidePriceCents(yesPriceCents, "YES")}
          onClick={() => launch("YES")}
        />
        <BigSideButton
          side="NO"
          priceCents={sidePriceCents(yesPriceCents, "NO")}
          onClick={() => launch("NO")}
        />
      </div>

      <NumpadTradeSheet
        open={open}
        onOpenChange={setOpen}
        marketSlug={marketSlug}
        outcomeIdx={outcomeIdx}
        title={title}
        question={question}
        yesPriceCents={yesPriceCents}
        {...(availableCents != null ? { availableCents } : {})}
        defaultSide={side}
      />
    </>
  );
}

function BigSideButton({
  side,
  priceCents,
  onClick,
}: {
  side: TradeSide;
  priceCents: number;
  onClick: () => void;
}) {
  const isYes = side === "YES";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Buy ${side} at ${formatPriceCents(priceCents)}`}
      className={cn(
        "flex items-center justify-center gap-2 rounded-full py-3.5 font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
        isYes
          ? "bg-court-500 text-ink-950 hover:bg-court-400"
          : "bg-no-500 hover:bg-no-500/90 text-white",
      )}
    >
      <span className="text-base leading-none">{side}</span>
      <span className="font-mono text-base font-semibold tabular-nums">
        {formatPriceCents(priceCents)}
      </span>
    </button>
  );
}
