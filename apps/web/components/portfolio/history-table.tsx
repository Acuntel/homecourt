// HOMECOURT — History tab: chronological list of all activity events.

import Link from "next/link";

import { EmptyState, Td, Th } from "@/components/portfolio/table-primitives";
import { formatRelative, formatSignedUsdCents } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ActivityEvent } from "@/lib/portfolio/activity";

interface HistoryTableProps {
  events: ActivityEvent[];
}

const KIND_LABEL: Record<ActivityEvent["kind"], string> = {
  deposit: "Deposit",
  withdraw: "Withdraw",
  order_placed: "Order placed",
  fill: "Fill",
  order_cancelled: "Cancelled",
  settlement: "Settlement",
};

export function HistoryTable({ events }: HistoryTableProps) {
  if (events.length === 0) {
    return <EmptyState>Your activity will appear here as you trade.</EmptyState>;
  }

  return (
    <div className="border-border bg-card overflow-hidden rounded-lg border">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-muted-fg text-xs">
            <tr>
              <Th>When</Th>
              <Th>Type</Th>
              <Th>Detail</Th>
              <Th>Amount</Th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {events.map((e) => (
              <tr key={e.id} className="hover:bg-muted/20">
                <Td>
                  <span className="text-muted-fg text-xs">{formatRelative(e.createdAt)}</span>
                </Td>
                <Td>
                  <span className="text-foreground text-xs">{KIND_LABEL[e.kind]}</span>
                </Td>
                <Td>
                  <div className="text-foreground text-sm">{e.title}</div>
                  {e.detail ? (
                    e.marketSlug ? (
                      <Link
                        href={`/markets/${e.marketSlug}`}
                        className="text-muted-fg hover:text-court-500 text-xs"
                      >
                        {e.detail}
                      </Link>
                    ) : (
                      <div className="text-muted-fg text-xs">{e.detail}</div>
                    )
                  ) : null}
                </Td>
                <Td>
                  {e.amountCents !== null ? (
                    <span
                      className={cn(
                        "font-mono text-xs tabular-nums",
                        e.amountCents > 0
                          ? "text-court-500"
                          : e.amountCents < 0
                            ? "text-no-500"
                            : "text-foreground",
                      )}
                    >
                      {formatSignedUsdCents(e.amountCents)}
                    </span>
                  ) : (
                    <span className="text-muted-fg">—</span>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
