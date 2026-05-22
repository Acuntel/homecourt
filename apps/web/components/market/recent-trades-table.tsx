"use client";

// HOMECOURT — Recent fills table (last 50). Tail-fades older rows.
//
// Initial rows come from the SSR snapshot. When `slug` is provided the
// component subscribes to `trade:<slug>` and prepends new fills in real
// time. Each new row fades+slides in via Framer Motion. Trades for
// outcomes other than the currently selected `outcomeIdx` are dropped
// client-side.

import { useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";

import { useEngineWebSocket } from "@/hooks/useEngineWebSocket";
import { formatPriceCents, formatUsdCents } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { MarketRecentFill } from "@homecourt/shared";

interface RecentTradesTableProps {
  fills: MarketRecentFill[];
  /** Only fills matching this outcomeIdx are shown. */
  outcomeIdx: number;
  /** When provided, subscribes to live trade WS frames for this market. */
  slug?: string;
  className?: string;
}

const TAIL_FADE_FLOOR = 0.6;
const MAX_ROWS = 50;

export function RecentTradesTable({ fills, outcomeIdx, slug, className }: RecentTradesTableProps) {
  const [liveFills, setLiveFills] = useState<MarketRecentFill[]>(fills);
  const { subscribe } = useEngineWebSocket();

  // Reseed when the parent passes a new SSR snapshot.
  useEffect(() => {
    setLiveFills(fills);
  }, [fills]);

  // Live trade subscription.
  useEffect(() => {
    if (!slug) return;
    const channel = `trade:${slug}`;
    const unsub = subscribe(channel, (msg) => {
      if (msg.type !== "trade") return;
      if (typeof msg.price !== "number" || typeof msg.qty !== "number") return;
      const outIdx = typeof msg.outcome === "number" ? msg.outcome : -1;
      const side = msg.side === "sell" ? "NO" : "YES";
      const id = `${msg.ts ?? Date.now()}-${outIdx}-${msg.price}-${msg.qty}-${Math.random().toString(36).slice(2, 8)}`;
      const next: MarketRecentFill = {
        id,
        outcomeIdx: outIdx,
        side,
        priceCents: msg.price,
        qty: msg.qty,
        createdAt: msg.ts ?? new Date().toISOString(),
      };
      setLiveFills((prev) => [next, ...prev].slice(0, MAX_ROWS * 2));
    });
    return unsub;
  }, [slug, subscribe]);

  const rows = useMemo(
    () => liveFills.filter((f) => f.outcomeIdx === outcomeIdx).slice(0, MAX_ROWS),
    [liveFills, outcomeIdx],
  );

  return (
    <section
      className={cn("border-border bg-card flex flex-col rounded-xl border", className)}
      aria-label="Recent trades"
    >
      <header className="border-border flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-sm font-semibold tracking-tight">Recent trades</h2>
        <span className="text-muted-fg text-xs">Last {rows.length || 0}</span>
      </header>

      {rows.length === 0 ? (
        <p className="text-muted-fg px-4 py-6 text-center text-xs">No trades yet — be the first.</p>
      ) : (
        <div className="overflow-hidden">
          <div className="border-border text-muted-fg bg-card sticky top-0 z-10 grid grid-cols-12 gap-2 border-b px-4 py-1.5 text-[10px] font-medium uppercase tracking-wide">
            <span className="col-span-4">Time</span>
            <span className="col-span-2">Side</span>
            <span className="col-span-2 text-right">Price</span>
            <span className="col-span-2 text-right">Qty</span>
            <span className="col-span-2 text-right">Value</span>
          </div>
          <ul className="flex flex-col">
            {rows.map((f, i) => {
              const fade =
                rows.length <= 1
                  ? 1
                  : 1 - ((1 - TAIL_FADE_FLOOR) * i) / Math.max(1, rows.length - 1);
              return (
                <li
                  key={f.id}
                  style={{ opacity: fade }}
                  className="trade-row-in border-border/60 grid grid-cols-12 items-center gap-2 border-b px-4 py-2 font-mono text-xs tabular-nums last:border-b-0"
                >
                  <span className="text-muted-fg col-span-4">
                    {formatDistanceToNow(new Date(f.createdAt), { addSuffix: true })}
                  </span>
                  <span className="col-span-2">
                    <SideChip side={f.side} />
                  </span>
                  <span className="text-foreground col-span-2 text-right">
                    {formatPriceCents(f.priceCents)}
                  </span>
                  <span className="text-foreground col-span-2 text-right">
                    {f.qty.toLocaleString("en-US")}
                  </span>
                  <span className="text-muted-fg col-span-2 text-right">
                    {formatUsdCents(f.priceCents * f.qty)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

function SideChip({ side }: { side: "YES" | "NO" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
        side === "YES" ? "bg-court-500/15 text-court-500" : "bg-no-500/15 text-no-500",
      )}
    >
      {side}
    </span>
  );
}
