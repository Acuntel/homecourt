// HOMECOURT — full activity timeline for /activity.
// Server component. Each event is one row: icon + one-line + relative time.

import Link from "next/link";
import {
  ArrowDownToLine,
  ArrowUpToLine,
  CheckCircle2,
  CircleDollarSign,
  Receipt,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { formatRelative, formatSignedUsdCents } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ActivityEvent } from "@/lib/portfolio/activity";

interface ActivityFeedProps {
  events: ActivityEvent[];
}

const ICONS: Record<ActivityEvent["kind"], LucideIcon> = {
  deposit: ArrowDownToLine,
  withdraw: ArrowUpToLine,
  order_placed: Receipt,
  fill: CheckCircle2,
  order_cancelled: XCircle,
  settlement: CircleDollarSign,
};

const ICON_TONE: Record<ActivityEvent["kind"], string> = {
  deposit: "text-court-500 bg-court-500/15",
  withdraw: "text-no-500 bg-no-500/15",
  order_placed: "text-foreground bg-muted",
  fill: "text-court-500 bg-court-500/15",
  order_cancelled: "text-muted-fg bg-muted",
  settlement: "text-court-500 bg-court-500/15",
};

export function ActivityFeed({ events }: ActivityFeedProps) {
  if (events.length === 0) {
    return (
      <div
        role="status"
        className="border-border bg-card text-muted-fg rounded-lg border p-8 text-center text-sm"
      >
        Your activity will appear here as you trade.
      </div>
    );
  }

  return (
    <ul className="border-border bg-card divide-border flex flex-col divide-y overflow-hidden rounded-lg border">
      {events.map((e) => {
        const Icon = ICONS[e.kind];
        return (
          <li key={e.id} className="hover:bg-muted/20 flex items-center gap-3 p-3">
            <span
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                ICON_TONE[e.kind],
              )}
              aria-hidden
            >
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-foreground truncate text-sm">{e.title}</div>
              {e.detail ? (
                e.marketSlug ? (
                  <Link
                    href={`/markets/${e.marketSlug}`}
                    className="text-muted-fg hover:text-court-500 block truncate text-xs"
                  >
                    {e.detail}
                  </Link>
                ) : (
                  <div className="text-muted-fg truncate text-xs">{e.detail}</div>
                )
              ) : null}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-0.5">
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
              ) : null}
              <span className="text-muted-fg text-[11px]">{formatRelative(e.createdAt)}</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
