// HOMECOURT — Resting Orders table (open + partial).

import Link from "next/link";

import { CancelOrderButton } from "@/components/portfolio/cancel-order-button";
import {
  EmptyState,
  SideChip,
  Td,
  TdRight,
  Th,
  ThRight,
} from "@/components/portfolio/table-primitives";
import { formatPriceCents, formatRelative } from "@/lib/format";
import type { RestingOrder } from "@/lib/portfolio/positions";

interface RestingOrdersTableProps {
  orders: RestingOrder[];
}

export function RestingOrdersTable({ orders }: RestingOrdersTableProps) {
  if (orders.length === 0) {
    return <EmptyState>No resting limit orders.</EmptyState>;
  }

  return (
    <div className="border-border bg-card overflow-hidden rounded-lg border">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-muted-fg text-xs">
            <tr>
              <Th>Market</Th>
              <Th>Side</Th>
              <ThRight>Limit</ThRight>
              <ThRight>Qty</ThRight>
              <ThRight>Filled</ThRight>
              <ThRight>Remaining</ThRight>
              <Th>Placed</Th>
              <Th>{""}</Th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {orders.map((o) => (
              <tr key={o.id} className="hover:bg-muted/20">
                <Td>
                  <Link
                    href={`/markets/${o.marketSlug}`}
                    className="text-foreground hover:text-court-500"
                  >
                    {o.address}
                  </Link>
                  <div className="text-muted-fg text-xs">{o.bucketLabel}</div>
                </Td>
                <Td>
                  <SideChip side={o.side} />
                </Td>
                <TdRight>{formatPriceCents(o.priceCents)}</TdRight>
                <TdRight>{o.qty.toLocaleString("en-US")}</TdRight>
                <TdRight>{o.filledQty.toLocaleString("en-US")}</TdRight>
                <TdRight>{o.remainingQty.toLocaleString("en-US")}</TdRight>
                <Td>
                  <span className="text-muted-fg text-xs">{formatRelative(o.createdAt)}</span>
                </Td>
                <Td>
                  <CancelOrderButton orderId={o.id} />
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
