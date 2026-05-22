// HOMECOURT — /portfolio (M8): top stats bar + four-tab portfolio view.

import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { ExportCsvButton } from "@/components/portfolio/export-csv-button";
import { HistoryTable } from "@/components/portfolio/history-table";
import { PortfolioStatsBar } from "@/components/portfolio/portfolio-stats-bar";
import { PortfolioTabs } from "@/components/portfolio/portfolio-tabs";
import { PositionsTable } from "@/components/portfolio/positions-table";
import { RestingOrdersTable } from "@/components/portfolio/resting-orders-table";
import { SettledTable } from "@/components/portfolio/settled-table";
import { loadActivity } from "@/lib/portfolio/activity";
import { loadPortfolioBalance } from "@/lib/portfolio/balance";
import {
  loadOpenPositions,
  loadRestingOrders,
  loadSettledPositions,
} from "@/lib/portfolio/positions";

export const metadata: Metadata = {
  title: "Portfolio",
  description: "Your HOMECOURT positions, resting orders, settled markets, and history.",
};

export default async function PortfolioPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [balance, openPositions, restingOrders, settledPositions, events] = await Promise.all([
    loadPortfolioBalance(user.id),
    loadOpenPositions(user.id),
    loadRestingOrders(user.id),
    loadSettledPositions(user.id),
    loadActivity(user.id, { limit: 200 }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Portfolio</h1>
          <p className="text-muted-fg text-sm">
            Sweepstakes balance, open positions, and trade history.
          </p>
        </div>
        <ExportCsvButton />
      </header>

      <PortfolioStatsBar balance={balance} />

      <PortfolioTabs
        positionsCount={openPositions.length}
        restingCount={restingOrders.length}
        settledCount={settledPositions.length}
        historyCount={events.length}
        openTab={<PositionsTable positions={openPositions} />}
        restingTab={<RestingOrdersTable orders={restingOrders} />}
        settledTab={<SettledTable positions={settledPositions} />}
        historyTab={<HistoryTable events={events} />}
      />
    </div>
  );
}
