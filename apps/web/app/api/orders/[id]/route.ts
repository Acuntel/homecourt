// HOMECOURT — DELETE /api/orders/:id proxies cancel to the engine.
// Engine returns 404 `order_not_resting` if the order already filled / not
// resting; we surface that as 404 to the client.

import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { cancelOrderOnEngine } from "@/lib/trade/engine-proxy";
import { log } from "@/lib/log";

type RouteContext = { params: Promise<{ id: string }> };

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function DELETE(_request: NextRequest, ctx: RouteContext) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ error: "bad_id" }, { status: 400 });
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const jwt = sessionData.session?.access_token ?? null;

  const engineRes = await cancelOrderOnEngine(id, { jwt });
  if (!engineRes.ok) {
    if (engineRes.status === 404) {
      return NextResponse.json(
        { error: "order_not_resting", message: "Order can't be cancelled." },
        { status: 404 },
      );
    }
    if (engineRes.status === 503) {
      return NextResponse.json(
        { error: "engine_unreachable", message: "Trading temporarily unavailable. Try again." },
        { status: 503 },
      );
    }
    log.warn({ status: engineRes.status, err: engineRes.error, orderId: id }, "cancel rejected");
    return NextResponse.json(
      { error: engineRes.error, message: engineRes.message ?? "Engine error." },
      { status: engineRes.status || 500 },
    );
  }

  return NextResponse.json({ ok: true, cancel: engineRes.data });
}
