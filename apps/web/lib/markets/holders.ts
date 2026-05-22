// HOMECOURT — leaderboard helper: top holders for a single market.
// Aggregates orders.filled_qty grouped by user/outcome/side. The M2 seed
// inserts orders rather than fills, so we read directly from `orders` here.

import { createServiceClient } from "@/lib/supabase/server";
import { log } from "@/lib/log";
import type { MarketTopHolder } from "@homecourt/shared";

const HOLDER_LIMIT = 10;

interface OrderAggRow {
  user_id: string;
  outcome: number;
  side: "buy" | "sell";
  filled_qty: number;
}

interface UserRow {
  id: string;
  username: string;
  display_name: string | null;
}

export async function loadMarketHolders(marketId: string): Promise<MarketTopHolder[]> {
  const supabase = createServiceClient();

  const { data: rows, error } = await supabase
    .from("orders")
    .select("user_id, outcome, side, filled_qty")
    .eq("market_id", marketId)
    .gt("filled_qty", 0)
    .returns<OrderAggRow[]>();

  if (error) {
    log.warn({ err: error, marketId }, "holders lookup failed");
    return [];
  }
  if (!rows || rows.length === 0) return [];

  const grouped = new Map<
    string,
    { userId: string; outcome: number; side: "YES" | "NO"; qty: number }
  >();
  for (const r of rows) {
    const sideLabel = r.side === "buy" ? "YES" : "NO";
    const key = `${r.user_id}:${r.outcome}:${sideLabel}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.qty += r.filled_qty;
    } else {
      grouped.set(key, {
        userId: r.user_id,
        outcome: r.outcome,
        side: sideLabel,
        qty: r.filled_qty,
      });
    }
  }

  const top = Array.from(grouped.values())
    .sort((a, b) => b.qty - a.qty)
    .slice(0, HOLDER_LIMIT);

  const userIds = Array.from(new Set(top.map((t) => t.userId)));
  const { data: users } = await supabase
    .from("users")
    .select("id, username, display_name")
    .in("id", userIds)
    .returns<UserRow[]>();
  const userById = new Map<string, UserRow>();
  for (const u of users ?? []) userById.set(u.id, u);

  return top.map((t) => ({
    userId: t.userId,
    username: userById.get(t.userId)?.username ?? "user",
    outcomeIdx: t.outcome,
    side: t.side,
    qty: t.qty,
  }));
}
