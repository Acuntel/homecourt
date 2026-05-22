"use client";

import Link from "next/link";
import Image from "next/image";

import { formatClosesIn, formatPriceCents, formatUsdCents } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { MarketSummary } from "@homecourt/shared";

interface RelatedMarketsCarouselProps {
  markets: MarketSummary[];
  className?: string;
}

export function RelatedMarketsCarousel({ markets, className }: RelatedMarketsCarouselProps) {
  if (markets.length === 0) {
    return (
      <section
        className={cn("border-border bg-card flex flex-col rounded-xl border", className)}
        aria-label="Related markets"
      >
        <header className="border-border border-b px-4 py-3">
          <h2 className="text-sm font-semibold tracking-tight">More in this ZIP</h2>
        </header>
        <p className="text-muted-fg px-4 py-6 text-center text-xs">
          No other live markets in this ZIP right now.
        </p>
      </section>
    );
  }

  return (
    <section
      className={cn("border-border bg-card flex flex-col rounded-xl border", className)}
      aria-label="Related markets"
    >
      <header className="border-border border-b px-4 py-3">
        <h2 className="text-sm font-semibold tracking-tight">More in this ZIP</h2>
      </header>
      <ul className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 py-4">
        {markets.map((m) => (
          <li key={m.slug} className="w-[240px] shrink-0 snap-start">
            <Link
              href={`/markets/${m.slug}`}
              className="border-border bg-ink-800 hover:border-court-500/40 focus-visible:ring-court-500 group flex h-full flex-col gap-2 rounded-lg border p-3 transition focus-visible:outline-none focus-visible:ring-2"
            >
              <div className="relative aspect-[4/3] overflow-hidden rounded-md">
                {m.photoUrl ? (
                  <Image
                    src={m.photoUrl}
                    alt={m.address}
                    fill
                    sizes="240px"
                    loading="lazy"
                    className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                ) : (
                  <div className="bg-muted h-full w-full" aria-hidden />
                )}
              </div>
              <div className="flex flex-col gap-1">
                <p className="truncate text-xs font-medium">{m.address}</p>
                <p className="text-muted-fg text-[11px]">
                  {m.zip} · {m.beds}bd · {m.sqft.toLocaleString("en-US")} sf
                </p>
                <div className="mt-1 flex items-baseline justify-between gap-2">
                  <span className="text-court-500 font-mono text-base font-semibold tabular-nums">
                    {formatPriceCents(m.yesPriceCents)}
                  </span>
                  <span className="text-muted-fg font-mono text-[10px] tabular-nums">
                    {formatUsdCents(m.volume24hCents)} · {formatClosesIn(m.closesAt)}
                  </span>
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
