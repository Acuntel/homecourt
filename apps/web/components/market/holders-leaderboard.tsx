"use client";

// HOMECOURT — Top 10 holders for a single (market, outcome) tuple.
// M10: live-updates via TanStack Query. Initial data ships from the SSR detail
// payload, then the WsProvider invalidates ["holders", slug] when fills land,
// triggering a refetch against GET /api/markets/:slug/holders.

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { User } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatCompact, formatUsdCents } from "@/lib/format";
import type { MarketBucketWithPrice, MarketTopHolder } from "@homecourt/shared";

interface HoldersLeaderboardProps {
  slug: string;
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

async function fetchHolders(slug: string): Promise<MarketTopHolder[]> {
  const res = await fetch(`/api/markets/${encodeURIComponent(slug)}/holders`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as { holders?: MarketTopHolder[] };
  return json.holders ?? [];
}

export function HoldersLeaderboard({
  slug,
  holders,
  selectedOutcomeIdx,
  bucketsWithPrice,
  className,
}: HoldersLeaderboardProps) {
  const { data: liveHolders = holders } = useQuery<MarketTopHolder[]>({
    queryKey: ["holders", slug],
    queryFn: () => fetchHolders(slug),
    initialData: holders,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const rows: Row[] = useMemo(() => {
    const filtered = liveHolders.filter((h) => h.outcomeIdx === selectedOutcomeIdx);
    const bucket = bucketsWithPrice[selectedOutcomeIdx];
    const markYes = bucket?.yesPriceCents ?? 50;
    return filtered.map((h) => {
      const markForSide = h.side === "YES" ? markYes : Math.max(1, 100 - markYes);
      const fairPrior = 50;
      const pnlCents = h.qty * (markForSide - fairPrior);
      return { holder: h, pnlCents };
    });
  }, [liveHolders, selectedOutcomeIdx, bucketsWithPrice]);

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
          {rows.map((r, i) => {
            const displayUsername = r.holder.username || "user";
            const clean = displayUsername.replace(/[^a-zA-Z0-9]/g, "");
            const showIconFallback = clean.length < 2;
            return (
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
                      avatarColor(displayUsername),
                    )}
                  >
                    {showIconFallback ? (
                      <User className="h-3.5 w-3.5" aria-hidden />
                    ) : (
                      initials(displayUsername)
                    )}
                  </span>
                  <span className="truncate text-sm font-medium">@{displayUsername}</span>
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
                <span
                  className="text-foreground col-span-2 text-right font-mono text-xs tabular-nums"
                  title={r.holder.qty.toLocaleString("en-US")}
                >
                  {formatCompact(r.holder.qty)}
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
            );
          })}
        </ul>
      )}
    </section>
  );
}
