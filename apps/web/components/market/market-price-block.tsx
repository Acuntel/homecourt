"use client";

import { TrendingUp, TrendingDown } from "lucide-react";

import { formatPriceCents } from "@/lib/format";
import { formatMultiplier, multiplier } from "@/lib/trade/multiplier";
import { cn } from "@/lib/utils";
import type { MarketBucketWithPrice } from "@homecourt/shared";

interface MarketPriceBlockProps {
  bucket: MarketBucketWithPrice;
  /** Delta cents vs 24h-ago (positive = up). */
  deltaCents?: number;
  volume24hCents: number;
  openInterest: number;
  className?: string;
}

function formatCompactUsd(cents: number): string {
  const dollars = cents / 100;
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1)}M`;
  if (dollars >= 1_000) return `$${(dollars / 1_000).toFixed(1)}K`;
  return `$${dollars.toFixed(0)}`;
}

export function MarketPriceBlock({
  bucket,
  deltaCents = 0,
  volume24hCents,
  openInterest,
  className,
}: MarketPriceBlockProps) {
  const yes = bucket.yesPriceCents;
  const no = Math.max(1, 100 - yes);
  const up = deltaCents >= 0;
  const DeltaIcon = up ? TrendingUp : TrendingDown;
  const deltaText = `${up ? "+" : "-"}${Math.abs(deltaCents)}¢ today`;
  const chanceText = `${yes}% chance`;
  const yesMult = formatMultiplier(multiplier(yes, "YES"));
  const noMult = formatMultiplier(multiplier(yes, "NO"));

  return (
    <section
      className={cn("border-border bg-card flex flex-col gap-4 rounded-xl border p-5", className)}
      aria-label={`Current price for ${bucket.label}`}
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-muted-fg text-xs font-medium uppercase tracking-wide">
            {bucket.label}
          </span>
          <span className="text-court-500 font-mono text-4xl font-semibold tabular-nums leading-none">
            {formatPriceCents(yes)}
            <span className="text-muted-fg ml-2 text-xs font-normal uppercase tracking-wide">
              YES
            </span>
          </span>
          <span
            className={cn(
              "mt-2 inline-flex items-center gap-1.5 text-xs",
              up ? "text-court-500" : "text-no-500",
            )}
          >
            <span>≈ {chanceText}</span>
            <span className="text-muted-fg" aria-hidden>
              ·
            </span>
            <span className="text-court-500 tabular-nums">{yesMult} payout</span>
            <span className="text-muted-fg" aria-hidden>
              ·
            </span>
            <DeltaIcon className="h-3 w-3" aria-hidden />
            <span>{deltaText}</span>
          </span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-no-500 font-mono text-xl font-medium tabular-nums">
            {formatPriceCents(no)}
            <span className="text-muted-fg ml-1 text-[10px] font-normal uppercase tracking-wide">
              NO
            </span>
          </span>
          <span className="text-no-500 mt-1 text-[11px] tabular-nums">{noMult} payout</span>
        </div>
      </div>

      <div className="text-muted-fg flex flex-wrap items-center gap-2 text-xs">
        <span className="bg-muted inline-flex items-center gap-1 rounded-full px-2.5 py-1">
          <span>24h vol</span>
          <span className="text-foreground tabular-nums">{formatCompactUsd(volume24hCents)}</span>
        </span>
        <span className="bg-muted inline-flex items-center gap-1 rounded-full px-2.5 py-1">
          <span>OI</span>
          <span className="text-foreground tabular-nums">
            {openInterest.toLocaleString("en-US")}
          </span>
        </span>
      </div>
    </section>
  );
}
