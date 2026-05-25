"use client";

// HOMECOURT — Featured rail at the top of /markets.
// 6 markets, horizontal scroll on narrow viewports, 3-up grid on desktop.
// Designed to lower the feed's "120 cards at once" cognitive load by
// surfacing a curated set above the long-tail browse.

import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Flame } from "lucide-react";

import { formatClosesIn, formatUsdCents } from "@/lib/format";
import { formatMultiplier, multiplier } from "@/lib/trade/multiplier";
import { cn } from "@/lib/utils";
import type { MarketSummary } from "@homecourt/shared";

interface FeaturedRailProps {
  markets: MarketSummary[];
  className?: string;
}

export function FeaturedRail({ markets, className }: FeaturedRailProps) {
  if (markets.length === 0) return null;
  const top = markets.slice(0, 6);
  return (
    <section className={cn("flex flex-col gap-3", className)} aria-label="Featured markets">
      <header className="flex items-baseline justify-between gap-3">
        <div className="flex items-center gap-2">
          <Flame className="text-court-500 h-4 w-4" aria-hidden />
          <h2 className="text-foreground text-sm font-semibold tracking-tight">
            Hot in Deerfield this week
          </h2>
        </div>
        <span className="text-muted-fg text-[11px]">{markets.length}+ live markets</span>
      </header>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {top.map((m) => (
          <li key={m.slug}>
            <FeaturedCard market={m} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function FeaturedCard({ market }: { market: MarketSummary }) {
  const yes = market.yesPriceCents;
  return (
    <Link
      href={`/markets/${market.slug}`}
      className="border-border bg-card hover:border-court-500/50 focus-visible:ring-court-500 group relative flex h-full flex-col overflow-hidden rounded-xl border transition focus-visible:outline-none focus-visible:ring-2"
    >
      <div className="bg-ink-900 relative aspect-[16/9] w-full overflow-hidden">
        {market.photoUrl ? (
          <Image
            src={market.photoUrl}
            alt={market.address}
            fill
            sizes="(max-width: 640px) 100vw, 33vw"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.04]"
            loading="lazy"
          />
        ) : null}
        <div className="from-ink-950 via-ink-950/60 absolute inset-x-0 bottom-0 bg-gradient-to-t to-transparent p-3">
          <p className="text-foreground truncate text-sm font-semibold">{market.address}</p>
          <p className="text-muted-fg text-[11px]">
            {market.zip} · {market.beds}bd · {market.sqft.toLocaleString("en-US")} sf
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 p-3">
        <div className="flex items-center gap-2">
          <Pill side="YES" yesPriceCents={yes} />
          <Pill side="NO" yesPriceCents={yes} />
        </div>
        <span className="text-muted-fg font-mono text-[10px] tabular-nums">
          {formatUsdCents(market.volume24hCents)} · {formatClosesIn(market.closesAt)}
        </span>
      </div>
      <span className="text-court-500 bg-ink-950/70 absolute right-3 top-3 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium uppercase tracking-wide opacity-0 backdrop-blur transition group-hover:opacity-100">
        Trade
        <ArrowRight className="h-2.5 w-2.5" aria-hidden />
      </span>
    </Link>
  );
}

function Pill({ side, yesPriceCents }: { side: "YES" | "NO"; yesPriceCents: number }) {
  const isYes = side === "YES";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[11px] tabular-nums",
        isYes ? "bg-court-500/15 text-court-500" : "bg-no-500/15 text-no-500",
      )}
    >
      <span className="text-[9px] font-medium uppercase tracking-wide opacity-80">{side}</span>
      {formatMultiplier(multiplier(yesPriceCents, side))}
    </span>
  );
}
