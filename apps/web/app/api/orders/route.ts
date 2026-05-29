// HOMECOURT — POST /api/orders executes a trade directly against Supabase.
//
// The simplified product is a binary YES/NO market with the house as
// counterparty (no CLOB engine, no NATS). A "buy" fills immediately at the
// quoted price: we debit the user's sweepstakes cash, record a filled order +
// a fill (so the position shows up), and write a journal entry. Settlement
// later pays $1.00/contract on the winning outcome.

import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { log } from "@/lib/log";

interface TradeBody {
  marketSlug?: string;
  outcome?: number;
  side?: string;
  priceCents?: number;
  qty?: number;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: TradeBody;
  try {
    body = (await request.json()) as TradeBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const outcome = Number(body.outcome);
  const priceCents = Number(body.priceCents);
  const qty = Number(body.qty);
  const slug = body.marketSlug;

  if (!slug || !Number.isInteger(outcome) || outcome < 0 || outcome > 4) {
    return NextResponse.json(
      { error: "invalid_outcome", message: "Bad market or outcome." },
      { status: 422 },
    );
  }
  if (!Number.isFinite(priceCents) || priceCents < 1 || priceCents > 99) {
    return NextResponse.json(
      { error: "invalid_price", message: "Price out of range." },
      { status: 422 },
    );
  }
  if (!Number.isInteger(qty) || qty < 1) {
    return NextResponse.json(
      { error: "invalid_qty", message: "Enter a valid amount." },
      { status: 422 },
    );
  }

  const db = createServiceClient();

  // Market must exist and be open.
  const { data: market } = await db
    .from("markets")
    .select("id, state")
    .eq("slug", slug)
    .maybeSingle();
  if (!market)
    return NextResponse.json(
      { error: "market_not_found", message: "Market not found." },
      { status: 404 },
    );
  if (market.state !== "open") {
    return NextResponse.json(
      { error: "market_closed", message: "Market is closed." },
      { status: 409 },
    );
  }

  // Funds check.
  const { data: account } = await db
    .from("accounts")
    .select("cash_cents")
    .eq("user_id", user.id)
    .maybeSingle();
  const cash = Number(account?.cash_cents ?? 0);
  const costCents = priceCents * qty;
  if (cash < costCents) {
    return NextResponse.json(
      { error: "insufficient_funds", message: "Not enough coins. Add more to keep trading." },
      { status: 402 },
    );
  }

  // 1. Filled order. 2. Fill (maker = taker = this order; house is counterparty).
  const orderId = randomUUID();
  const { error: orderErr } = await db.from("orders").insert({
    id: orderId,
    client_idempotency_key: `hcrt_order_${randomUUID()}`,
    market_id: market.id,
    user_id: user.id,
    outcome,
    side: "buy",
    price_cents: priceCents,
    qty,
    filled_qty: qty,
    status: "filled",
  });
  if (orderErr) {
    log.error({ err: orderErr.message, userId: user.id }, "order insert failed");
    return NextResponse.json(
      { error: "order_failed", message: "Couldn't place the trade." },
      { status: 500 },
    );
  }

  const { error: fillErr } = await db.from("fills").insert({
    market_id: market.id,
    taker_order_id: orderId,
    maker_order_id: orderId,
    outcome,
    price_cents: priceCents,
    qty,
    fee_cents: 0,
  });
  if (fillErr) {
    log.error({ err: fillErr.message, userId: user.id }, "fill insert failed");
    return NextResponse.json(
      { error: "fill_failed", message: "Couldn't place the trade." },
      { status: 500 },
    );
  }

  // 3. Debit cash via journal (trigger syncs accounts.cash_cents).
  const newCash = cash - costCents;
  const { error: jErr } = await db.from("journal").insert({
    user_id: user.id,
    market_id: market.id,
    kind: "fill_debit",
    amount_cents: -costCents,
    balance_after_cents: newCash,
    ref: `trade:${orderId}`,
  });
  if (jErr) {
    log.error({ err: jErr.message, userId: user.id }, "journal insert failed");
  }

  return NextResponse.json(
    {
      ok: true,
      order: { id: orderId, status: "filled", filled_qty: qty, resting_qty: 0 },
      balanceCents: newCash,
    },
    { status: 201 },
  );
}

interface OrderRow {
  id: string;
  market_id: string;
  outcome: number;
  side: string;
  price_cents: number;
  qty: number;
  filled_qty: number;
  status: string;
  created_at: string;
  cancelled_at: string | null;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const db = createServiceClient();
  const { data, error } = await db
    .from("orders")
    .select(
      "id, market_id, outcome, side, price_cents, qty, filled_qty, status, created_at, cancelled_at",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    log.error({ err: error.message, userId: user.id }, "orders list failed");
    return NextResponse.json({ error: "read_failed" }, { status: 500 });
  }

  const rows = (data ?? []) as OrderRow[];
  return NextResponse.json({
    orders: rows.map((r) => ({
      id: r.id,
      marketId: r.market_id,
      outcome: r.outcome,
      side: r.side,
      priceCents: r.price_cents,
      qty: r.qty,
      filledQty: r.filled_qty,
      qtyRemaining: r.qty - r.filled_qty,
      status: r.status,
      createdAt: r.created_at,
      cancelledAt: r.cancelled_at,
    })),
  });
}
