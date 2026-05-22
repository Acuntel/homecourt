"use client";

// HOMECOURT — L2 order book ladder. Static snapshot for M5; M9 wires WS deltas.
// Two-column bid/ask ladder, top 10 levels each side, depth bars proportional
// to cumulative qty on each side.

import { useMemo, useState } from "react";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatPriceCents } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { BookLevel } from "@homecourt/shared";

interface OrderBookL2Props {
  outcomeIdx: number;
  bids: BookLevel[];
  asks: BookLevel[];
  seq: number;
  className?: string;
}

const ROW_LIMIT = 10;

interface DisplayRow {
  priceCents: number;
  qty: number;
  cumQty: number;
  depthPct: number;
}

function buildRows(levels: BookLevel[], sortDesc: boolean): DisplayRow[] {
  if (levels.length === 0) return [];
  const sorted = [...levels].sort((a, b) => (sortDesc ? b[0] - a[0] : a[0] - b[0]));
  const sliced = sorted.slice(0, ROW_LIMIT);
  let running = 0;
  const total = sliced.reduce((acc, [, qty]) => acc + qty, 0);
  return sliced.map(([priceCents, qty]) => {
    running += qty;
    const depthPct = total > 0 ? Math.min(100, Math.round((running / total) * 100)) : 0;
    return { priceCents, qty, cumQty: running, depthPct };
  });
}

function formatQty(qty: number): string {
  return qty.toLocaleString("en-US");
}

export function OrderBookL2({ outcomeIdx, bids, asks, seq, className }: OrderBookL2Props) {
  const [side, setSide] = useState<"YES" | "NO">("YES");

  // For the NO book we invert: NO bids = inverted YES asks (100 - price), and
  // vice versa. This is the standard derivation in binary outcome markets.
  const yesBids = useMemo(() => buildRows(bids, true), [bids]);
  const yesAsks = useMemo(() => buildRows(asks, false), [asks]);

  const noBids = useMemo(
    () =>
      buildRows(
        asks.map(([p, q]) => [Math.max(1, Math.min(99, 100 - p)), q] as BookLevel),
        true,
      ),
    [asks],
  );
  const noAsks = useMemo(
    () =>
      buildRows(
        bids.map(([p, q]) => [Math.max(1, Math.min(99, 100 - p)), q] as BookLevel),
        false,
      ),
    [bids],
  );

  const activeBids = side === "YES" ? yesBids : noBids;
  const activeAsks = side === "YES" ? yesAsks : noAsks;
  const empty = activeBids.length === 0 && activeAsks.length === 0;

  const bestBid = activeBids[0]?.priceCents;
  const bestAsk = activeAsks[0]?.priceCents;
  const spread =
    typeof bestBid === "number" && typeof bestAsk === "number"
      ? Math.max(0, bestAsk - bestBid)
      : null;

  return (
    <section
      className={cn("border-border bg-card flex flex-col rounded-xl border", className)}
      aria-label={`Order book for outcome ${outcomeIdx + 1}`}
    >
      <header className="border-border flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <h2 className="text-sm font-semibold tracking-tight">Order book</h2>
        <div className="flex items-center gap-3">
          {spread !== null ? (
            <span className="text-muted-fg font-mono text-xs tabular-nums">Spread {spread}¢</span>
          ) : null}
          <span className="text-muted-fg font-mono text-[10px] tabular-nums">seq {seq}</span>
          <Tabs value={side} onValueChange={(v) => setSide(v === "NO" ? "NO" : "YES")}>
            <TabsList className="h-7 p-0.5">
              <TabsTrigger value="YES" className="px-2.5 text-[11px]">
                YES
              </TabsTrigger>
              <TabsTrigger value="NO" className="px-2.5 text-[11px]">
                NO
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </header>

      {empty ? (
        <p className="text-muted-fg px-4 py-6 text-center text-xs">No resting orders yet.</p>
      ) : (
        <div className="bg-border/40 grid grid-cols-2 gap-px">
          <BookColumn
            label="Bids"
            rows={activeBids}
            side="bid"
            colorClass="bg-court-500/15"
            textClass="text-court-500"
          />
          <BookColumn
            label="Asks"
            rows={activeAsks}
            side="ask"
            colorClass="bg-no-500/15"
            textClass="text-no-500"
          />
        </div>
      )}
    </section>
  );
}

interface BookColumnProps {
  label: string;
  rows: DisplayRow[];
  side: "bid" | "ask";
  colorClass: string;
  textClass: string;
}

function BookColumn({ label, rows, side, colorClass, textClass }: BookColumnProps) {
  const isBid = side === "bid";
  return (
    <div className="bg-card flex flex-col">
      <div className="border-border text-muted-fg bg-card sticky top-0 z-10 grid grid-cols-3 gap-2 border-b px-3 py-1.5 text-[10px] font-medium uppercase tracking-wide">
        <span className={cn(isBid ? "" : "text-right")}>{isBid ? "Price" : "Qty"}</span>
        <span className="text-center">{isBid ? "Qty" : "Cum"}</span>
        <span className={cn(isBid ? "text-right" : "text-left")}>{isBid ? "Cum" : "Price"}</span>
      </div>
      {rows.length === 0 ? (
        <p className="text-muted-fg px-3 py-3 text-center text-[11px]">No {label.toLowerCase()}.</p>
      ) : (
        <ul className="flex flex-col">
          {rows.map((r, i) => (
            <li
              key={`${side}-${r.priceCents}-${i}`}
              className="relative grid grid-cols-3 items-center gap-2 px-3 py-1 font-mono text-[12px] tabular-nums"
            >
              <span
                aria-hidden
                className={cn("absolute inset-y-0 z-0", colorClass)}
                style={{
                  width: `${r.depthPct}%`,
                  ...(isBid ? { right: 0 } : { left: 0 }),
                }}
              />
              {isBid ? (
                <>
                  <span className={cn("relative z-10", textClass)}>
                    {formatPriceCents(r.priceCents)}
                  </span>
                  <span className="relative z-10 text-center">{formatQty(r.qty)}</span>
                  <span className="text-muted-fg relative z-10 text-right">
                    {formatQty(r.cumQty)}
                  </span>
                </>
              ) : (
                <>
                  <span className="relative z-10">{formatQty(r.qty)}</span>
                  <span className="text-muted-fg relative z-10 text-center">
                    {formatQty(r.cumQty)}
                  </span>
                  <span className={cn("relative z-10 text-left", textClass)}>
                    {formatPriceCents(r.priceCents)}
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
