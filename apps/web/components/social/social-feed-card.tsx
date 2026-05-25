"use client";

// HOMECOURT — a Kalshi-style social post built from a market summary.
// Author line + the market it references + chance/multiplier + action row.
// "Buy" routes to the market where the numpad sheet lives.

import Link from "next/link";
import { Bookmark, Heart, Home, MessageCircle, Share2 } from "lucide-react";

import { formatMultiplier, multiplier } from "@/lib/trade/multiplier";
import { cn } from "@/lib/utils";
import type { MarketSummary } from "@homecourt/shared";

// Deterministic pseudo-handle so cards feel social without real authorship yet.
const HANDLES = ["atx.bull", "comp.king", "zip78704", "house.whale", "closer.tx", "spread.guy"];

function handleFor(slug: string): string {
  let h = 0;
  for (const ch of slug) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return HANDLES[h % HANDLES.length]!;
}

export function SocialFeedCard({ market }: { market: MarketSummary }) {
  const yes = market.yesPriceCents;
  const handle = handleFor(market.slug);

  return (
    <article className="border-border/70 flex flex-col gap-3 border-b pb-4">
      <div className="flex items-center gap-2">
        <span className="bg-court-500/15 text-court-500 flex h-8 w-8 items-center justify-center rounded-full">
          <Home className="h-4 w-4" aria-hidden />
        </span>
        <span className="text-foreground text-sm font-semibold">{handle}</span>
        <span className="text-muted-fg text-xs">· Now</span>
      </div>

      <Link
        href={`/markets/${market.slug}`}
        className="border-border bg-card hover:border-court-500/40 flex flex-col gap-1.5 rounded-xl border p-4 transition"
      >
        <span className="text-foreground truncate text-sm font-semibold">{market.address}</span>
        <span className="text-muted-fg text-xs">
          {market.city}, IL {market.zip}
        </span>
        <div className="mt-1 flex items-center justify-between">
          <span className="text-court-500 text-sm font-semibold">
            YES {formatMultiplier(multiplier(yes, "YES"))}
          </span>
          <span className="text-no-500 text-sm font-semibold">
            NO {formatMultiplier(multiplier(yes, "NO"))}
          </span>
        </div>
      </Link>

      <div className="text-muted-fg flex items-center justify-between">
        <div className="flex items-center gap-5">
          <Action icon={MessageCircle} label="Comment" />
          <Action icon={Heart} label="Like" />
          <Action icon={Share2} label="Share" />
          <Action icon={Bookmark} label="Save" />
        </div>
        <Link
          href={`/markets/${market.slug}`}
          className="border-border hover:border-court-500/50 hover:text-court-500 rounded-full border px-4 py-1.5 text-xs font-semibold transition"
        >
          Buy
        </Link>
      </div>
    </article>
  );
}

function Action({ icon: Icon, label }: { icon: typeof Heart; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn("hover:text-foreground transition-colors")}
    >
      <Icon className="h-4 w-4" aria-hidden />
    </button>
  );
}
