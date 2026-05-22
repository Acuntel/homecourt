// HOMECOURT — GET /api/markets/search?q=...
// Backs the Cmd+K command palette. Returns up to 8 address/ZIP matches.

import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { searchMarkets } from "@/lib/markets/search";
import { log } from "@/lib/log";
import type { MarketSearchHit } from "@homecourt/shared";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const q = request.nextUrl.searchParams.get("q") ?? "";
  if (q.trim().length === 0) {
    return NextResponse.json({ items: [] });
  }

  try {
    const items = await searchMarkets(q, 8);
    const payload: { items: MarketSearchHit[] } = { items };
    return NextResponse.json(payload);
  } catch (err) {
    log.error({ err }, "market search failed");
    return NextResponse.json({ error: "search_unavailable" }, { status: 500 });
  }
}
