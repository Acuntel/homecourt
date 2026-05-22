// HOMECOURT — POST /api/orders proxies to the Go matching engine.
//
// Responsibilities of this route (per BUILD.md §23 M7):
//   - Verify the user has a Supabase session.
//   - Validate the request body with the shared zod `placeOrderSchema`.
//   - Generate `Idempotency-Key: hcrt_order_<uuid>` if the client didn't
//     supply one.
//   - Forward `Authorization: Bearer <supabase-jwt>` so the engine can
//     verify the `sub` claim matches the request body's user_id.
//   - Map engine errors to friendly HTTP responses.
//
// Optional GET: returns the user's most recent orders straight from
// Postgres (engine doesn't expose a per-user listing).

import { NextResponse, type NextRequest } from "next/server";

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { newOrderIdempotencyKey, placeOrderOnEngine } from "@/lib/trade/engine-proxy";
import { log } from "@/lib/log";
import { orderIdempotencyKeyRegex, placeOrderSchema } from "@homecourt/shared";

interface JsonBody extends Record<string, unknown> {
  idempotencyKey?: string;
}

function mapEngineStatus(status: number, error: string): { code: number; message: string } {
  if (status === 401) return { code: 401, message: "Session expired. Sign in again." };
  if (status === 403) return { code: 403, message: "User mismatch — refusing to place." };
  if (status === 404 && error === "market_not_found")
    return { code: 404, message: "Market not found on the engine." };
  if (status === 400) {
    if (error === "submit_failed") return { code: 400, message: "Order rejected by the engine." };
    return { code: 400, message: "Invalid order." };
  }
  if (status === 503 || status === 0)
    return { code: 503, message: "Trading temporarily unavailable. Try again." };
  return { code: status || 500, message: "Engine error." };
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: JsonBody = {};
  try {
    body = (await request.json()) as JsonBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const headerKey = request.headers.get("idempotency-key");
  if (headerKey) body.idempotencyKey = headerKey;

  const parsed = placeOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  // Pin the idempotency key server-side. If the client gave us a key, use it;
  // otherwise mint one. Always normalise format.
  let idempotencyKey = parsed.data.idempotencyKey ?? newOrderIdempotencyKey();
  if (!orderIdempotencyKeyRegex.test(idempotencyKey)) {
    idempotencyKey = newOrderIdempotencyKey();
  }

  // Forward the Supabase session JWT — engine verifies the `sub` claim.
  const { data: sessionData } = await supabase.auth.getSession();
  const jwt = sessionData.session?.access_token ?? null;

  const engineRes = await placeOrderOnEngine(
    {
      marketSlug: parsed.data.marketSlug,
      userId: user.id,
      outcome: parsed.data.outcome,
      side: parsed.data.side,
      priceCents: parsed.data.priceCents,
      qty: parsed.data.qty,
    },
    { idempotencyKey, jwt },
  );

  if (!engineRes.ok) {
    const mapped = mapEngineStatus(engineRes.status, engineRes.error);
    log.warn(
      {
        status: engineRes.status,
        error: engineRes.error,
        userId: user.id,
        marketSlug: parsed.data.marketSlug,
      },
      "engine order rejected",
    );
    return NextResponse.json(
      { error: engineRes.error, message: mapped.message },
      { status: mapped.code },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      idempotencyKey: engineRes.idempotencyKey,
      idempotentReplay: engineRes.idempotentReplay,
      order: engineRes.data,
    },
    { status: engineRes.idempotentReplay ? 200 : 201 },
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
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

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
