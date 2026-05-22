// HOMECOURT — GET /api/markets/[slug]
// Returns the full MarketDetail payload used by /markets/[slug].

import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { loadMarketDetail } from "@/lib/markets/detail";
import { log } from "@/lib/log";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(_request: NextRequest, ctx: RouteContext) {
  const { slug } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  try {
    const detail = await loadMarketDetail(slug, user?.id ?? null);
    if (!detail) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json(detail);
  } catch (err) {
    log.error({ err, slug }, "market detail load failed");
    return NextResponse.json({ error: "detail_unavailable" }, { status: 500 });
  }
}
