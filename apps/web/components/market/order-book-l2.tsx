"use client";

// HOMECOURT — L2 order book ladder.
//
// Renders top-10 levels per side. Initial state comes from the SSR
// snapshot (bids/asks/seq props). When a `slug` is provided, the
// component subscribes to `orderbook:<slug>:<outcomeIdx>` via the
// shared engine WebSocket and replaces its local snapshot whenever the
// engine publishes a new one. The "Live" pulse dot lights up green when
// the WS is open.

import { useEffect, useMemo, useState } from "react";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEngineWebSocket } from "@/hooks/useEngineWebSocket";
import { formatPriceCents } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { BookLevel } from "@homecourt/shared";

interface OrderBookL2Props {
  outcomeIdx: number;
  bids: BookLevel[];
  asks: BookLevel[];
  seq: number;
  /** When provided, the book subscribes to live WS updates for this market. */
  slug?: string;
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

interface BookState {
  bids: BookLevel[];
  asks: BookLevel[];
  seq: number;
}

export function OrderBookL2({ outcomeIdx, bids, asks, seq, slug, className }: OrderBookL2Props) {
  const [side, setSide] = useState<"YES" | "NO">("YES");
  const [book, setBook] = useState<BookState>({ bids, asks, seq });
  const { status, subscribe } = useEngineWebSocket();

  // When the SSR snapshot props change (e.g. parent re-renders with a new
  // outcomeIdx and a different selectedBook), reseed local state.
  useEffect(() => {
    setBook({ bids, asks, seq });
  }, [bids, asks, seq]);

  // Live subscription to the per-outcome orderbook channel.
  useEffect(() => {
    if (!slug) return;
    const channel = `orderbook:${slug}:${outcomeIdx}`;
    const unsub = subscribe(channel, (msg) => {
      // Engine sends `{type:"orderbook_delta", bids:[[p,q]...], asks:[...], seq}`
      // with a *full* snapshot of the top-20 levels (see services/engine
      // internal/api/publish.go). We also accept "snapshot" for safety.
      if (msg.type !== "orderbook_delta" && msg.type !== "snapshot" && msg.type !== "orderbook")
        return;
      const nextBids = (msg.bids ?? []) as BookLevel[];
      const nextAsks = (msg.asks ?? []) as BookLevel[];
      setBook((prev) => {
        const nextSeq = typeof msg.seq === "number" ? msg.seq : prev.seq;
        if (nextSeq < prev.seq) return prev; // stale frame
        return { bids: nextBids, asks: nextAsks, seq: nextSeq };
      });
    });
    return unsub;
  }, [slug, outcomeIdx, subscribe]);

  const yesBids = useMemo(() => buildRows(book.bids, true), [book.bids]);
  const yesAsks = useMemo(() => buildRows(book.asks, false), [book.asks]);

  const noBids = useMemo(
    () =>
      buildRows(
        book.asks.map(([p, q]) => [Math.max(1, Math.min(99, 100 - p)), q] as BookLevel),
        true,
      ),
    [book.asks],
  );
  const noAsks = useMemo(
    () =>
      buildRows(
        book.bids.map(([p, q]) => [Math.max(1, Math.min(99, 100 - p)), q] as BookLevel),
        false,
      ),
    [book.bids],
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
          {slug ? <LiveDot status={status} /> : null}
          {spread !== null ? (
            <span className="text-muted-fg font-mono text-xs tabular-nums">Spread {spread}¢</span>
          ) : null}
          <span className="text-muted-fg font-mono text-[10px] tabular-nums">seq {book.seq}</span>
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

function LiveDot({ status }: { status: "connecting" | "open" | "closed" }) {
  const open = status === "open";
  return (
    <span
      className="text-muted-fg inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wide"
      aria-live="polite"
      aria-label={`Connection ${status}`}
    >
      <span
        className={cn(
          "relative inline-block h-1.5 w-1.5 rounded-full",
          open ? "bg-court-500" : status === "connecting" ? "bg-amber-500" : "bg-muted-fg/60",
        )}
      >
        {open ? (
          <span
            aria-hidden
            className="bg-court-500/60 absolute inset-0 -z-10 animate-ping rounded-full"
          />
        ) : null}
      </span>
      {open ? "Live" : status}
    </span>
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
