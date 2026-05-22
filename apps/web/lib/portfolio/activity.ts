// HOMECOURT — unified activity feed.
//
// One chronological list combining:
//   - deposits / withdrawals (journal kind = deposit | withdraw)
//   - order placed           (orders.created_at)
//   - fills                  (fills table, joined via the user's order ids)
//   - cancels                (orders.cancelled_at, status=cancelled)
//   - settlements            (settlements.created_at — for markets user held)
//
// We cap at the requested limit (default 200) for the portfolio history tab
// and the /activity feed.

import { createServiceClient } from "@/lib/supabase/server";
import { log } from "@/lib/log";

export type ActivityKind =
  | "deposit"
  | "withdraw"
  | "order_placed"
  | "fill"
  | "order_cancelled"
  | "settlement";

export interface ActivityEvent {
  id: string;
  kind: ActivityKind;
  createdAt: string;
  title: string;
  detail: string | null;
  marketSlug: string | null;
  /** positive = credit, negative = debit. Null if N/A. */
  amountCents: number | null;
}

interface JournalRow {
  id: number;
  kind: string;
  amount_cents: number;
  ref: string | null;
  created_at: string;
  market_id: string | null;
}

interface OrderRowJoined {
  id: string;
  market_id: string;
  outcome: number;
  side: "buy" | "sell";
  price_cents: number;
  qty: number;
  filled_qty: number;
  status: string;
  created_at: string;
  cancelled_at: string | null;
  markets: { slug: string; properties: { address: string } | null } | null;
}

interface FillRow {
  id: string;
  market_id: string;
  outcome: number;
  price_cents: number;
  qty: number;
  created_at: string;
  maker_order_id: string;
  taker_order_id: string;
  markets: { slug: string; properties: { address: string } | null } | null;
}

interface SettlementRow {
  id: string;
  market_id: string;
  final_bucket: number;
  final_price_cents: number;
  created_at: string;
  markets: { slug: string; properties: { address: string } | null } | null;
}

interface ActivityOpts {
  limit?: number;
}

export async function loadActivity(
  userId: string,
  opts: ActivityOpts = {},
): Promise<ActivityEvent[]> {
  const limit = opts.limit ?? 200;
  const db = createServiceClient();

  // Journal + orders run in parallel; fills + settlements depend on the order
  // ids and market ids respectively, so we sequence them.
  const [journalRes, ordersRes] = await Promise.all([
    db
      .from("journal")
      .select("id, kind, amount_cents, ref, created_at, market_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit),
    db
      .from("orders")
      .select(
        "id, market_id, outcome, side, price_cents, qty, filled_qty, status, created_at, cancelled_at, markets:market_id (slug, properties:property_id (address))",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit),
  ]);

  if (journalRes.error) log.warn({ err: journalRes.error.message, userId }, "activity journal");
  if (ordersRes.error) log.warn({ err: ordersRes.error.message, userId }, "activity orders");

  const orderRows = (ordersRes.data ?? []) as unknown as OrderRowJoined[];
  const orderIds = orderRows.map((o) => o.id);

  const [fillsMakerRes, fillsTakerRes] = await Promise.all([
    orderIds.length
      ? db
          .from("fills")
          .select(
            "id, market_id, outcome, price_cents, qty, created_at, maker_order_id, taker_order_id, markets:market_id (slug, properties:property_id (address))",
          )
          .in("maker_order_id", orderIds)
          .order("created_at", { ascending: false })
          .limit(limit)
      : Promise.resolve({ data: [] as unknown as FillRow[], error: null }),
    orderIds.length
      ? db
          .from("fills")
          .select(
            "id, market_id, outcome, price_cents, qty, created_at, maker_order_id, taker_order_id, markets:market_id (slug, properties:property_id (address))",
          )
          .in("taker_order_id", orderIds)
          .order("created_at", { ascending: false })
          .limit(limit)
      : Promise.resolve({ data: [] as unknown as FillRow[], error: null }),
  ]);

  if (fillsMakerRes.error) log.warn({ err: fillsMakerRes.error.message }, "activity fills maker");
  if (fillsTakerRes.error) log.warn({ err: fillsTakerRes.error.message }, "activity fills taker");

  const events: ActivityEvent[] = [];

  // Journal entries we surface in the timeline.
  for (const row of (journalRes.data ?? []) as JournalRow[]) {
    if (row.kind === "deposit") {
      events.push({
        id: `j:${row.id}`,
        kind: "deposit",
        createdAt: row.created_at,
        title: "Deposit",
        detail: row.ref ?? null,
        marketSlug: null,
        amountCents: row.amount_cents,
      });
    } else if (row.kind === "withdraw") {
      events.push({
        id: `j:${row.id}`,
        kind: "withdraw",
        createdAt: row.created_at,
        title: "Withdraw",
        detail: row.ref ?? null,
        marketSlug: null,
        amountCents: row.amount_cents,
      });
    }
  }

  // Orders → emit "order_placed" + optional "order_cancelled".
  for (const row of orderRows) {
    const address = row.markets?.properties?.address ?? null;
    const sideLabel = row.side === "buy" ? "YES" : "NO";
    const summary = `${sideLabel} ${row.qty} @ ${row.price_cents}¢`;
    events.push({
      id: `op:${row.id}`,
      kind: "order_placed",
      createdAt: row.created_at,
      title: `Order placed — ${summary}`,
      detail: address,
      marketSlug: row.markets?.slug ?? null,
      amountCents: null,
    });
    if (row.cancelled_at && row.status === "cancelled") {
      events.push({
        id: `oc:${row.id}`,
        kind: "order_cancelled",
        createdAt: row.cancelled_at,
        title: `Order cancelled — ${summary}`,
        detail: address,
        marketSlug: row.markets?.slug ?? null,
        amountCents: null,
      });
    }
  }

  // Fills — dedupe by id (a single fill could appear in maker+taker lists if
  // the user trades with themselves, which never happens in practice).
  const fillIds = new Set<string>();
  const fillRows = [
    ...((fillsMakerRes.data ?? []) as unknown as FillRow[]),
    ...((fillsTakerRes.data ?? []) as unknown as FillRow[]),
  ];
  for (const f of fillRows) {
    if (fillIds.has(f.id)) continue;
    fillIds.add(f.id);
    events.push({
      id: `f:${f.id}`,
      kind: "fill",
      createdAt: f.created_at,
      title: `Filled ${f.qty} @ ${f.price_cents}¢`,
      detail: f.markets?.properties?.address ?? null,
      marketSlug: f.markets?.slug ?? null,
      amountCents: null,
    });
  }

  // Settlements — only emit for markets the user actually held.
  const userMarketIds = new Set<string>();
  for (const o of orderRows) {
    if (o.filled_qty > 0) userMarketIds.add(o.market_id);
  }
  if (userMarketIds.size > 0) {
    const { data: settled } = await db
      .from("settlements")
      .select(
        "id, market_id, final_bucket, final_price_cents, created_at, markets:market_id (slug, properties:property_id (address))",
      )
      .in("market_id", Array.from(userMarketIds))
      .order("created_at", { ascending: false })
      .limit(limit);

    for (const s of (settled ?? []) as unknown as SettlementRow[]) {
      events.push({
        id: `s:${s.id}`,
        kind: "settlement",
        createdAt: s.created_at,
        title: `Settled — bucket ${s.final_bucket}`,
        detail: s.markets?.properties?.address ?? null,
        marketSlug: s.markets?.slug ?? null,
        amountCents: null,
      });
    }
  }

  events.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return events.slice(0, limit);
}
