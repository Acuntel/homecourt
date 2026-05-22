// HOMECOURT — Open Positions table.
// Server component — receives pre-aggregated Position rows.

import Link from "next/link";

import { SellPositionButton } from "@/components/portfolio/sell-position-button";
import {
  EmptyState,
  SideChip,
  Td,
  TdRight,
  Th,
  ThRight,
} from "@/components/portfolio/table-primitives";
import { formatPriceCents, formatSignedUsdCents, formatUsdCents } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Position } from "@/lib/portfolio/positions";

interface PositionsTableProps {
  positions: Position[];
}

export function PositionsTable({ positions }: PositionsTableProps) {
  if (positions.length === 0) {
    return (
      <EmptyState>
        No open positions yet.{" "}
        <Link href="/markets" className="text-court-500 hover:underline">
          Browse markets →
        </Link>
      </EmptyState>
    );
  }

  return (
    <div className="border-border bg-card overflow-hidden rounded-lg border">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-muted-fg text-xs">
            <tr>
              <Th>Market</Th>
              <Th>Bucket</Th>
              <Th>Side</Th>
              <ThRight>Qty</ThRight>
              <ThRight>Avg</ThRight>
              <ThRight>Mark</ThRight>
              <ThRight>Unrealized</ThRight>
              <ThRight>Max payout</ThRight>
              <Th>{""}</Th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {positions.map((p) => (
              <tr key={`${p.marketId}:${p.outcome}:${p.side}`} className="hover:bg-muted/20">
                <Td>
                  <Link
                    href={`/markets/${p.marketSlug}`}
                    className="text-foreground hover:text-court-500"
                  >
                    {p.address}
                  </Link>
                </Td>
                <Td>
                  <span className="text-muted-fg text-xs">{p.bucketLabel}</span>
                </Td>
                <Td>
                  <SideChip side={p.side} />
                </Td>
                <TdRight>{p.qty.toLocaleString("en-US")}</TdRight>
                <TdRight>{formatPriceCents(p.avgCostCents)}</TdRight>
                <TdRight>{formatPriceCents(p.markCents)}</TdRight>
                <TdRight>
                  <span
                    className={cn(
                      p.unrealizedPnlCents > 0
                        ? "text-court-500"
                        : p.unrealizedPnlCents < 0
                          ? "text-no-500"
                          : "text-muted-fg",
                    )}
                  >
                    {formatSignedUsdCents(p.unrealizedPnlCents)}
                  </span>
                </TdRight>
                <TdRight>{formatUsdCents(p.maxPayoutCents, { detailed: true })}</TdRight>
                <Td>
                  <SellPositionButton
                    marketSlug={p.marketSlug}
                    outcome={p.outcome}
                    side={p.side}
                    qty={p.qty}
                  />
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
