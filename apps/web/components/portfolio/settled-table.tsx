// HOMECOURT — Settled tab: positions whose markets have resolved.

import Link from "next/link";

import {
  EmptyState,
  SideChip,
  Td,
  TdRight,
  Th,
  ThRight,
} from "@/components/portfolio/table-primitives";
import { formatPriceCents, formatSignedUsdCents } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { SettledPosition } from "@/lib/portfolio/positions";

interface SettledTableProps {
  positions: SettledPosition[];
}

export function SettledTable({ positions }: SettledTableProps) {
  if (positions.length === 0) {
    return <EmptyState>Nothing settled yet.</EmptyState>;
  }

  return (
    <div className="border-border bg-card overflow-hidden rounded-lg border">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-muted-fg text-xs">
            <tr>
              <Th>Market</Th>
              <Th>Side</Th>
              <ThRight>Qty in</ThRight>
              <ThRight>Avg in</ThRight>
              <ThRight>Settle</ThRight>
              <ThRight>Net P&L</ThRight>
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
                  <div className="text-muted-fg text-xs">{p.bucketLabel}</div>
                </Td>
                <Td>
                  <SideChip side={p.side} />
                </Td>
                <TdRight>{p.qty.toLocaleString("en-US")}</TdRight>
                <TdRight>{formatPriceCents(p.avgCostCents)}</TdRight>
                <TdRight>{formatPriceCents(p.finalPriceCents)}</TdRight>
                <TdRight>
                  <span
                    className={cn(
                      p.netPnlCents > 0
                        ? "text-court-500"
                        : p.netPnlCents < 0
                          ? "text-no-500"
                          : "text-muted-fg",
                    )}
                  >
                    {formatSignedUsdCents(p.netPnlCents)}
                  </span>
                </TdRight>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
