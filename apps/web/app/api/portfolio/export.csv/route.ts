// HOMECOURT — GET /api/portfolio/export.csv
//
// Streams a CSV of the signed-in user's trade history. One row per fill, plus
// a row per realised journal credit/debit. Headers exactly:
//   date,market,side,type,qty,price_cents,fee_cents,realized_pnl_cents
//
// Filename: homecourt_history_<YYYYMMDD>.csv

import { NextResponse } from "next/server";

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { log } from "@/lib/log";

interface OrderLite {
  id: string;
  side: "buy" | "sell";
  market_id: string;
}

interface FillCsvRow {
  id: string;
  market_id: string;
  price_cents: number;
  qty: number;
  fee_cents: number;
  created_at: string;
  maker_order_id: string;
  taker_order_id: string;
}

interface JournalCsvRow {
  id: number;
  kind: string;
  amount_cents: number;
  created_at: string;
  market_id: string | null;
}

interface MarketLite {
  id: string;
  slug: string;
  properties: { address: string } | null;
}

const CSV_HEADER = "date,market,side,type,qty,price_cents,fee_cents,realized_pnl_cents";

function escapeCsv(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function todayStamp(): string {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}${mm}${dd}`;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = createServiceClient();

  // All orders ever placed by the user — we need them to map fills → side.
  const { data: orders, error: ordErr } = await db
    .from("orders")
    .select("id, side, market_id")
    .eq("user_id", user.id)
    .returns<OrderLite[]>();

  if (ordErr) {
    log.error({ err: ordErr.message, userId: user.id }, "csv export orders failed");
    return NextResponse.json({ error: "read_failed" }, { status: 500 });
  }
  const userOrderIds = new Set((orders ?? []).map((o) => o.id));
  const sideByOrderId = new Map((orders ?? []).map((o) => [o.id, o.side]));

  // Fills where user was maker OR taker.
  const orderIds = Array.from(userOrderIds);
  const fillsMaker = orderIds.length
    ? await db
        .from("fills")
        .select(
          "id, market_id, price_cents, qty, fee_cents, created_at, maker_order_id, taker_order_id",
        )
        .in("maker_order_id", orderIds)
        .returns<FillCsvRow[]>()
    : { data: [] as FillCsvRow[], error: null };
  const fillsTaker = orderIds.length
    ? await db
        .from("fills")
        .select(
          "id, market_id, price_cents, qty, fee_cents, created_at, maker_order_id, taker_order_id",
        )
        .in("taker_order_id", orderIds)
        .returns<FillCsvRow[]>()
    : { data: [] as FillCsvRow[], error: null };

  const fillById = new Map<string, FillCsvRow>();
  for (const f of fillsMaker.data ?? []) fillById.set(f.id, f);
  for (const f of fillsTaker.data ?? []) fillById.set(f.id, f);

  // Journal — realised debits/credits only.
  const { data: journal } = await db
    .from("journal")
    .select("id, kind, amount_cents, created_at, market_id")
    .eq("user_id", user.id)
    .in("kind", ["deposit", "withdraw", "settlement", "fee", "fill_credit", "fill_debit"])
    .returns<JournalCsvRow[]>();

  // Markets metadata for nice "market" column.
  const marketIds = new Set<string>();
  for (const f of fillById.values()) marketIds.add(f.market_id);
  for (const j of journal ?? []) if (j.market_id) marketIds.add(j.market_id);
  let marketsById = new Map<string, MarketLite>();
  if (marketIds.size > 0) {
    const { data: markets } = await db
      .from("markets")
      .select("id, slug, properties:property_id (address)")
      .in("id", Array.from(marketIds))
      .returns<MarketLite[]>();
    marketsById = new Map((markets ?? []).map((m) => [m.id, m]));
  }

  // Build rows. Sort everything chronological asc.
  type CsvRow = {
    date: string;
    market: string;
    side: string;
    type: string;
    qty: number | "";
    priceCents: number | "";
    feeCents: number | "";
    realizedPnlCents: number | "";
    sortKey: string;
  };
  const rows: CsvRow[] = [];

  for (const f of fillById.values()) {
    const userOrderId = userOrderIds.has(f.maker_order_id)
      ? f.maker_order_id
      : userOrderIds.has(f.taker_order_id)
        ? f.taker_order_id
        : null;
    const side = userOrderId ? (sideByOrderId.get(userOrderId) ?? "") : "";
    const sideLabel = side === "buy" ? "YES" : side === "sell" ? "NO" : "";
    const isTaker = userOrderId === f.taker_order_id;
    const market = marketsById.get(f.market_id);
    rows.push({
      date: f.created_at,
      market: market?.properties?.address ?? market?.slug ?? f.market_id,
      side: sideLabel,
      type: "fill",
      qty: f.qty,
      priceCents: f.price_cents,
      feeCents: isTaker ? f.fee_cents : 0,
      realizedPnlCents: "",
      sortKey: f.created_at,
    });
  }

  for (const j of journal ?? []) {
    const market = j.market_id ? marketsById.get(j.market_id) : null;
    rows.push({
      date: j.created_at,
      market: market?.properties?.address ?? market?.slug ?? "",
      side: "",
      type: j.kind,
      qty: "",
      priceCents: "",
      feeCents: "",
      realizedPnlCents: j.amount_cents,
      sortKey: j.created_at,
    });
  }

  rows.sort((a, b) => (a.sortKey < b.sortKey ? -1 : 1));

  const lines: string[] = [CSV_HEADER];
  for (const r of rows) {
    lines.push(
      [
        escapeCsv(r.date),
        escapeCsv(r.market),
        escapeCsv(r.side),
        escapeCsv(r.type),
        escapeCsv(r.qty),
        escapeCsv(r.priceCents),
        escapeCsv(r.feeCents),
        escapeCsv(r.realizedPnlCents),
      ].join(","),
    );
  }
  const body = lines.join("\n") + "\n";

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="homecourt_history_${todayStamp()}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
