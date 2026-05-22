"use client";

import { Button } from "@/components/ui/button";
import { formatPriceCents } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { MarketBucketWithPrice } from "@homecourt/shared";

interface MultiOutcomeTableProps {
  buckets: MarketBucketWithPrice[];
  selectedIdx: number;
  onSelect: (idx: number) => void;
  /** Map outcomeIdx → 24h delta in cents. Optional. */
  deltas?: Map<number, number>;
  /** Stub click handlers for the Buy buttons — wired up in M7. */
  onBuy?: (outcomeIdx: number, side: "YES" | "NO") => void;
  className?: string;
}

function formatCompactUsd(cents: number): string {
  const dollars = cents / 100;
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1)}M`;
  if (dollars >= 1_000) return `$${(dollars / 1_000).toFixed(1)}K`;
  return `$${dollars.toFixed(0)}`;
}

export function MultiOutcomeTable({
  buckets,
  selectedIdx,
  onSelect,
  deltas,
  onBuy,
  className,
}: MultiOutcomeTableProps) {
  return (
    <section
      className={cn(
        "border-border bg-card flex flex-col overflow-hidden rounded-xl border",
        className,
      )}
      aria-label="Outcome buckets"
    >
      <header className="border-border text-muted-fg grid grid-cols-12 gap-2 border-b px-4 py-2 text-[11px] font-medium uppercase tracking-wide">
        <span className="col-span-4">Bucket</span>
        <span className="col-span-2 text-right">YES</span>
        <span className="col-span-2 text-right">24h Δ</span>
        <span className="col-span-2 text-right">Vol</span>
        <span className="col-span-2 text-right">Trade</span>
      </header>
      <ul className="flex flex-col">
        {buckets.map((b) => {
          const isSelected = b.idx === selectedIdx;
          const delta = deltas?.get(b.idx) ?? 0;
          const deltaUp = delta >= 0;
          return (
            <li key={b.idx}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => onSelect(b.idx)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(b.idx);
                  }
                }}
                aria-pressed={isSelected}
                className={cn(
                  "border-border/60 grid w-full cursor-pointer grid-cols-12 items-center gap-2 border-b px-4 py-3 text-left text-sm transition last:border-b-0",
                  "focus-visible:ring-court-500 focus-visible:outline-none focus-visible:ring-2",
                  isSelected ? "bg-court-500/10" : "hover:bg-muted/40",
                )}
              >
                <span className="col-span-4 font-medium tabular-nums">{b.label}</span>
                <span className="text-court-500 col-span-2 text-right font-mono font-medium tabular-nums">
                  {formatPriceCents(b.yesPriceCents)}
                </span>
                <span
                  className={cn(
                    "col-span-2 text-right font-mono text-xs tabular-nums",
                    deltaUp ? "text-court-500" : "text-no-500",
                  )}
                >
                  {deltaUp ? "+" : "-"}
                  {Math.abs(delta)}¢
                </span>
                <span className="text-muted-fg col-span-2 text-right font-mono text-xs tabular-nums">
                  {formatCompactUsd(b.volume24hCents)}
                </span>
                <span className="col-span-2 flex justify-end gap-1">
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    className="h-7 px-2 text-[11px]"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(b.idx);
                      onBuy?.(b.idx, "YES");
                    }}
                    aria-label={`Buy YES ${b.label}`}
                  >
                    YES
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-cobalt-500/50 text-cobalt-500 hover:bg-cobalt-500/10 h-7 px-2 text-[11px]"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(b.idx);
                      onBuy?.(b.idx, "NO");
                    }}
                    aria-label={`Buy NO ${b.label}`}
                  >
                    NO
                  </Button>
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
