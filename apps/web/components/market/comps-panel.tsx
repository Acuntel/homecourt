"use client";

import { formatDistanceToNow } from "date-fns";

import { formatUsdCents } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { MarketDetailComp } from "@homecourt/shared";

interface CompsPanelProps {
  comps: MarketDetailComp[];
  className?: string;
}

function metersToMiles(m: number): string {
  const miles = m / 1609.34;
  if (miles < 0.1) return "<0.1 mi";
  return `${miles.toFixed(1)} mi`;
}

export function CompsPanel({ comps, className }: CompsPanelProps) {
  return (
    <section
      className={cn("border-border bg-card flex flex-col rounded-xl border", className)}
      aria-label="Recent comps"
    >
      <header className="border-border flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-sm font-semibold tracking-tight">Recent comps</h2>
        <span className="text-muted-fg text-xs">Within 1 mile</span>
      </header>

      {comps.length === 0 ? (
        <p className="text-muted-fg px-4 py-6 text-center text-xs">
          No recent comps found within 1 mile.
        </p>
      ) : (
        <ul className="flex flex-col">
          {comps.slice(0, 3).map((c) => (
            <li
              key={c.propertyId}
              className="border-border/60 grid grid-cols-12 items-center gap-2 border-b px-4 py-3 text-xs last:border-b-0"
            >
              <span className="text-foreground col-span-5 truncate font-medium">{c.address}</span>
              <span className="text-muted-fg col-span-3">
                {c.soldDate ? formatDistanceToNow(new Date(c.soldDate), { addSuffix: true }) : "—"}
              </span>
              <span className="text-foreground col-span-2 text-right font-mono tabular-nums">
                {c.soldPriceCents !== null ? formatUsdCents(c.soldPriceCents) : "—"}
              </span>
              <span className="text-muted-fg col-span-1 text-right font-mono tabular-nums">
                {c.pricePerSqftCents > 0 ? `$${Math.round(c.pricePerSqftCents / 100)}/sf` : "—"}
              </span>
              <span className="text-muted-fg col-span-1 text-right font-mono tabular-nums">
                {metersToMiles(c.distanceMeters)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
