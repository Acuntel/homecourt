// HOMECOURT — GET /api/markets/:slug/holders
// Returns the top-10 holders for a market. Used by the client-side
// HoldersLeaderboard so it can refetch when fills land via WS.

import { NextResponse, type NextRequest } from "next/server";

import { createServiceClient } from "@/lib/supabase/server";
import { loadMarketHolders } from "@/lib/markets/holders";
import { log } from "@/lib/log";

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(_request: NextRequest, ctx: RouteContext) {
  const { slug } = await ctx.params;
  const db = createServiceClient();

  const { data: market, error } = await db
    .from("markets")
    .select("id")
    .eq("slug", slug)
    .maybeSingle<{ id: string }>();

  if (error) {
    log.error({ err: error.message, slug }, "holders route slug lookup failed");
    return NextResponse.json({ error: "lookup_failed" }, { status: 500 });
  }
  if (!market) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const holders = await loadMarketHolders(market.id);
  return NextResponse.json({ holders });
}
