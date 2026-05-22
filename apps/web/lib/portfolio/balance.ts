// HOMECOURT — extended balance helpers for the portfolio page.
//
// BalancePill (M3) just shows cash + locked. The Portfolio stats bar needs:
//   - cashCents             — accounts.cash_cents
//   - lockedCents           — accounts.locked_cents
//   - totalBalanceCents     — cash + locked + sum(qty * mark) over open positions
//   - pnlTodayCents         — realised + unrealised change since 00:00 UTC today
//   - pnlTotalCents         — sum(unrealised on open) + sum(net on settled)
//
// All numbers are BIGINT cents. The today vs. total split is approximate in
// Phase 0: we read journal entries since 00:00 UTC for the realised side and
// snapshot open positions for the unrealised side.

import { createServiceClient } from "@/lib/supabase/server";
import { log } from "@/lib/log";
import { loadOpenPositions, loadSettledPositions } from "@/lib/portfolio/positions";

export interface PortfolioBalance {
  cashCents: number;
  lockedCents: number;
  /** cash + locked + sum(mark * qty) over open positions */
  totalBalanceCents: number;
  /** sum of unrealised P&L on open + net P&L on settled */
  pnlTotalCents: number;
  /** journal-derived realised + unrealised delta since 00:00 UTC */
  pnlTodayCents: number;
}

interface AccountRow {
  cash_cents: number;
  locked_cents: number;
}

interface JournalRow {
  amount_cents: number;
  kind:
    | "deposit"
    | "withdraw"
    | "order_lock"
    | "order_release"
    | "fill_debit"
    | "fill_credit"
    | "fee"
    | "settlement"
    | "adjustment";
}

const REALISED_KINDS: ReadonlyArray<JournalRow["kind"]> = [
  "fill_debit",
  "fill_credit",
  "fee",
  "settlement",
];

export async function loadPortfolioBalance(userId: string): Promise<PortfolioBalance> {
  const db = createServiceClient();

  const { data: account, error: acctErr } = await db
    .from("accounts")
    .select("cash_cents, locked_cents")
    .eq("user_id", userId)
    .maybeSingle();

  if (acctErr) {
    log.error({ err: acctErr.message, userId }, "loadPortfolioBalance accounts failed");
  }

  const cashCents = Number((account as AccountRow | null)?.cash_cents ?? 0);
  const lockedCents = Number((account as AccountRow | null)?.locked_cents ?? 0);

  const [open, settled] = await Promise.all([
    loadOpenPositions(userId),
    loadSettledPositions(userId),
  ]);

  const positionsMarkCents = open.reduce((sum, p) => sum + p.markCents * p.qty, 0);
  const totalBalanceCents = cashCents + lockedCents + positionsMarkCents;

  const unrealisedPnl = open.reduce((sum, p) => sum + p.unrealizedPnlCents, 0);
  const settledPnl = settled.reduce((sum, p) => sum + p.netPnlCents, 0);
  const pnlTotalCents = unrealisedPnl + settledPnl;

  // pnl today = realised since 00:00 UTC. We don't track intraday unrealised
  // delta (no t-1 snapshot in Phase 0); MVP just sums the journal.
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const { data: journalRows } = await db
    .from("journal")
    .select("amount_cents, kind")
    .eq("user_id", userId)
    .gte("created_at", startOfDay.toISOString())
    .in("kind", REALISED_KINDS as unknown as string[])
    .returns<JournalRow[]>();

  const pnlTodayCents = (journalRows ?? []).reduce((sum, row) => sum + row.amount_cents, 0);

  return {
    cashCents,
    lockedCents,
    totalBalanceCents,
    pnlTotalCents,
    pnlTodayCents,
  };
}
