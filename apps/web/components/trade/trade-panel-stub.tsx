"use client";

import { Wrench } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatPriceCents } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { MarketBucketWithPrice } from "@homecourt/shared";

interface TradePanelStubProps {
  bucket: MarketBucketWithPrice;
  className?: string;
}

export function TradePanelStub({ bucket, className }: TradePanelStubProps) {
  const yes = bucket.yesPriceCents;
  const no = Math.max(1, 100 - yes);

  return (
    <aside
      className={cn(
        "border-border bg-card flex w-full flex-col gap-4 rounded-xl border p-5",
        className,
      )}
      aria-label="Trade panel"
    >
      <header className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-tight">Trade</h2>
        <span className="text-muted-fg bg-muted inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium">
          <Wrench className="h-3 w-3" aria-hidden />
          M7 preview
        </span>
      </header>

      <div className="border-border/60 bg-muted/30 flex flex-col gap-2 rounded-md border p-3">
        <span className="text-muted-fg text-[11px] uppercase tracking-wide">Selected</span>
        <span className="text-foreground text-sm font-medium">{bucket.label}</span>
        <div className="mt-2 flex items-baseline justify-between gap-3">
          <span className="text-court-500 font-mono text-3xl font-semibold tabular-nums leading-none">
            {formatPriceCents(yes)}
            <span className="text-muted-fg ml-1.5 text-[10px] font-normal uppercase tracking-wide">
              YES
            </span>
          </span>
          <span className="text-no-500 font-mono text-base font-medium tabular-nums">
            {formatPriceCents(no)}
            <span className="text-muted-fg ml-1 text-[10px] font-normal uppercase tracking-wide">
              NO
            </span>
          </span>
        </div>
      </div>

      <div className="text-muted-fg flex flex-col gap-2 text-xs leading-relaxed">
        <p>
          The full trade panel ships in M7 — limit + quick orders, fee preview, slippage warnings,
          and one-tap fills.
        </p>
        <p>For now, pick any bucket on the left to preview pricing.</p>
      </div>

      <Button
        type="button"
        size="default"
        className="w-full"
        disabled
        aria-label="Review trade (coming in M7)"
      >
        Review trade — coming in M7
      </Button>
    </aside>
  );
}
