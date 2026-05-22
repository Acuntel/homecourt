// HOMECOURT — Portfolio stats grid: top of /portfolio.
// Server component — receives pre-aggregated PortfolioBalance.

import { formatSignedUsdCents, formatUsdCents } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PortfolioBalance } from "@/lib/portfolio/balance";

interface PortfolioStatsBarProps {
  balance: PortfolioBalance;
}

export function PortfolioStatsBar({ balance }: PortfolioStatsBarProps) {
  return (
    <section
      aria-label="Portfolio summary"
      className="border-border bg-card grid grid-cols-2 gap-px overflow-hidden rounded-lg border md:grid-cols-5"
    >
      <Stat
        label="Total balance"
        value={formatUsdCents(balance.totalBalanceCents, { detailed: true })}
      />
      <Stat label="Cash" value={formatUsdCents(balance.cashCents, { detailed: true })} />
      <Stat label="Locked" value={formatUsdCents(balance.lockedCents, { detailed: true })} />
      <Stat
        label="P&L all-time"
        value={formatSignedUsdCents(balance.pnlTotalCents)}
        tone={balance.pnlTotalCents > 0 ? "up" : balance.pnlTotalCents < 0 ? "down" : "flat"}
      />
      <Stat
        label="P&L today"
        value={formatSignedUsdCents(balance.pnlTodayCents)}
        tone={balance.pnlTodayCents > 0 ? "up" : balance.pnlTodayCents < 0 ? "down" : "flat"}
      />
    </section>
  );
}

interface StatProps {
  label: string;
  value: string;
  tone?: "up" | "down" | "flat";
}

function Stat({ label, value, tone = "flat" }: StatProps) {
  return (
    <div className="bg-card flex flex-col gap-1 p-4">
      <span className="text-muted-fg text-xs">{label}</span>
      <span
        className={cn(
          "font-mono text-base tabular-nums",
          tone === "up" && "text-court-500",
          tone === "down" && "text-no-500",
          tone === "flat" && "text-foreground",
        )}
      >
        {value}
      </span>
    </div>
  );
}
