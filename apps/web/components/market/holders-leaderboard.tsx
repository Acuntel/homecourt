"use client";

// HOMECOURT — Top 10 holders for a single (market, outcome) tuple.
// Hypothetical P&L = qty * (markCents - avgCostCents). avg cost isn't tracked
// at the seed level yet, so we use the bucket's current mark as the floor and
// show a neutral "—" for users who only have one position.

import { useMemo } from "react";

import { cn } from "@/lib/utils";
import { formatUsdCents } from "@/lib/format";
import type { MarketBucketWithPrice, MarketTopHolder } from "@homecourt/shared";

interface HoldersLeaderboardProps {
  holders: MarketTopHolder[];
  selectedOutcomeIdx: number;
  bucketsWithPrice: MarketBucketWithPrice[];
  className?: string;
}

interface Row {
  holder: MarketTopHolder;
  pnlCents: number | null;
}

function initials(username: string): string {
  const cleaned = username.replace(/[^a-zA-Z0-9]/g, "");
  if (cleaned.length === 0) return "?";
  if (cleaned.length === 1) return cleaned[0]!.toUpperCase();
  return (cleaned[0]! + cleaned[cleaned.length - 1]!).toUpperCase();
}

const AVATAR_PALETTE = [
  "bg-court-500/20 text-court-500",
  "bg-cobalt-500/20 text-cobalt-500",
  "bg-no-500/20 text-no-500",
  "bg-amber-500/20 text-amber-500",
  "bg-violet-500/20 text-violet-500",
];

function avatarColor(username: string): string {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = (hash * 31 + username.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % AVATAR_PALETTE.length;
  return AVATAR_PALETTE[idx] ?? AVATAR_PALETTE[0]!;
}

export function HoldersLeaderboard({
  holders,
  selectedOutcomeIdx,
  bucketsWithPrice,
  className,
}: HoldersLeaderboardProps) {
  const rows: Row[] = useMemo(() => {
    const filtered = holders.filter((h) => h.outcomeIdx === selectedOutcomeIdx);
    const bucket = bucketsWithPrice[selectedOutcomeIdx];
    const markYes = bucket?.yesPriceCents ?? 50;
    return filtered.map((h) => {
      // Without per-user avg cost we approximate vs a 50¢ "fair" prior; this is
      // intentionally rough — M8 brings true position-level P&L.
      const markForSide = h.side === "YES" ? markYes : Math.max(1, 100 - markYes);
      const fairPrior = 50;
      const pnlCents = h.qty * (markForSide - fairPrior);
      return { holder: h, pnlCents };
    });
  }, [holders, selectedOutcomeIdx, bucketsWithPrice]);

  return (
    <section
      className={cn("border-border bg-card flex flex-col rounded-xl border", className)}
      aria-label="Top holders"
    >
      <header className="border-border flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-sm font-semibold tracking-tight">Top holders</h2>
        <span className="text-muted-fg text-xs">Current bucket</span>
      </header>

      {rows.length === 0 ? (
        <p className="text-muted-fg px-4 py-6 text-center text-xs">No holders yet.</p>
      ) : (
        <ul className="flex flex-col">
          {rows.map((r, i) => (
            <li
              key={`${r.holder.userId}-${r.holder.side}`}
              className="border-border/60 grid grid-cols-12 items-center gap-2 border-b px-4 py-2 last:border-b-0"
            >
              <span className="text-muted-fg col-span-1 font-mono text-xs tabular-nums">
                {i + 1}
              </span>
              <span className="col-span-5 flex min-w-0 items-center gap-2">
                <span
                  aria-hidden
                  className={cn(
                    "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold uppercase",
                    avatarColor(r.holder.username),
                  )}
                >
                  {initials(r.holder.username)}
                </span>
                <span className="truncate text-sm font-medium">@{r.holder.username}</span>
              </span>
              <span className="col-span-2">
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                    r.holder.side === "YES"
                      ? "bg-court-500/15 text-court-500"
                      : "bg-no-500/15 text-no-500",
                  )}
                >
                  {r.holder.side}
                </span>
              </span>
              <span className="text-foreground col-span-2 text-right font-mono text-xs tabular-nums">
                {r.holder.qty.toLocaleString("en-US")}
              </span>
              <span
                className={cn(
                  "col-span-2 text-right font-mono text-xs tabular-nums",
                  r.pnlCents === null
                    ? "text-muted-fg"
                    : r.pnlCents >= 0
                      ? "text-court-500"
                      : "text-no-500",
                )}
              >
                {r.pnlCents === null
                  ? "—"
                  : `${r.pnlCents >= 0 ? "+" : "-"}${formatUsdCents(Math.abs(r.pnlCents))}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
