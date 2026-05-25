"use client";

import Image from "next/image";
import Link from "next/link";
import { Home } from "lucide-react";

import { formatClosesIn, formatPriceCents, formatShortDate, formatUsdCents } from "@/lib/format";
import { formatMultiplier, multiplier } from "@/lib/trade/multiplier";
import { cn } from "@/lib/utils";
import { WatchlistHeart } from "@/components/markets/watchlist-heart";
import { Sparkline } from "@/components/markets/sparkline";
import type { MarketSummary } from "@homecourt/shared";

interface MarketCardProps {
  market: MarketSummary;
  onWatchChange?: (slug: string, watching: boolean) => void;
}

function formatCompactUsd(cents: number): string {
  const dollars = cents / 100;
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1)}M`;
  if (dollars >= 1000) return `$${(dollars / 1000).toFixed(1)}K`;
  return `$${dollars.toFixed(0)}`;
}

function formatOpenInterest(qty: number): string {
  if (qty >= 1000) return `${(qty / 1000).toFixed(1)}K`;
  return qty.toLocaleString("en-US");
}

export function MarketCard({ market, onWatchChange }: MarketCardProps) {
  const anchor = market.buckets[market.anchorBucketIdx];
  const yesPrice = market.yesPriceCents;
  const noPrice = Math.max(1, 100 - yesPrice);

  const rangeLabel = anchor
    ? `Closes between ${formatCompactUsd(anchor.loCents)} and ${formatCompactUsd(anchor.hiCents)} by ${formatShortDate(market.closesAt)}`
    : `Closes by ${formatShortDate(market.closesAt)}`;

  return (
    <Link
      href={`/markets/${market.slug}`}
      aria-label={`${market.address} — ${formatPriceCents(yesPrice)} YES`}
      className={cn(
        "border-border bg-card focus-visible:ring-court-500 group relative flex flex-col gap-3 rounded-xl border p-4 shadow-sm transition",
        "hover:border-court-500/40 hover:-translate-y-0.5 hover:shadow-md",
        "focus-visible:outline-none focus-visible:ring-2",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="bg-muted relative h-16 w-16 shrink-0 overflow-hidden rounded-md">
          {market.photoUrl ? (
            <Image
              src={market.photoUrl}
              alt=""
              fill
              sizes="64px"
              loading="lazy"
              className="object-cover"
            />
          ) : (
            <div className="text-muted-fg flex h-full w-full items-center justify-center">
              <Home className="h-5 w-5" aria-hidden />
            </div>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center gap-2">
            <Home className="text-muted-fg h-3.5 w-3.5 shrink-0" aria-hidden />
            <p className="text-foreground truncate text-sm font-medium" title={market.address}>
              {market.address}
            </p>
          </div>
          <p className="text-muted-fg text-xs">
            {market.city}, TX {market.zip} · {market.beds}bd · {market.sqft.toLocaleString("en-US")}{" "}
            sqft
          </p>
          {anchor ? (
            <span className="bg-court-500/10 text-court-500 mt-1 inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">
              {anchor.label}
            </span>
          ) : null}
        </div>
      </div>

      <p className="text-muted-fg line-clamp-1 text-xs" title={rangeLabel}>
        {rangeLabel}
      </p>

      <div className="flex items-end justify-between gap-2">
        <div className="flex flex-col">
          <span className="text-court-500 font-mono text-2xl font-semibold tabular-nums leading-none">
            {yesPrice}%
            <span className="text-muted-fg ml-1 text-xs font-normal uppercase tracking-wide">
              YES
            </span>
          </span>
          <span className="text-muted-fg mt-1 text-xs tabular-nums">
            <span className="text-court-500">{formatMultiplier(multiplier(yesPrice, "YES"))}</span>{" "}
            · <span className="text-no-500">{noPrice}% NO</span>
          </span>
        </div>
        <Sparkline points={market.sparkline} fallbackPriceCents={yesPrice} />
      </div>

      <div className="text-muted-fg flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 truncate">
          <span title="24h volume">Vol {formatCompactUsd(market.volume24hCents)}</span>
          <span aria-hidden>·</span>
          <span>{formatClosesIn(market.closesAt).replace("Closes in ", "")} left</span>
          <span aria-hidden>·</span>
          <span title="Open interest (24h)">OI {formatOpenInterest(market.openInterest)}</span>
        </div>
        <WatchlistHeart
          slug={market.slug}
          initialWatching={market.watching}
          onChange={(w) => onWatchChange?.(market.slug, w)}
        />
      </div>

      <span className="sr-only">
        Zestimate {formatUsdCents(market.zestimateCents)}, list price{" "}
        {formatUsdCents(market.listPriceCents)}.
      </span>
    </Link>
  );
}
