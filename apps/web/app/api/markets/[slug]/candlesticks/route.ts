// HOMECOURT — GET /api/markets/[slug]/candlesticks?outcome=N&interval=1H|6H|1D|1W|1M|ALL
// Returns OHLC candles for the PriceChart on /markets/[slug].

import { NextResponse, type NextRequest } from "next/server";

import { createServiceClient } from "@/lib/supabase/server";
import { loadCandlesticks, parseInterval } from "@/lib/markets/candlesticks";
import { coerceBuckets, deriveYesPriceCents, findAnchorBucket } from "@/lib/markets/feed-helpers";
import { log } from "@/lib/log";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(request: NextRequest, ctx: RouteContext) {
  const { slug } = await ctx.params;
  const sp = request.nextUrl.searchParams;
  const outcomeRaw = sp.get("outcome");
  const outcome = outcomeRaw ? Number.parseInt(outcomeRaw, 10) : 0;
  if (!Number.isFinite(outcome) || outcome < 0 || outcome > 4) {
    return NextResponse.json({ error: "bad_outcome" }, { status: 400 });
  }
  const interval = parseInterval(sp.get("interval"));

  const db = createServiceClient();
  // Look up the market + linked listing for a sensible fallback price.
  const { data: market, error } = await db
    .from("markets")
    .select("id, buckets, listings!inner ( list_price_cents )")
    .eq("slug", slug)
    .maybeSingle();
  if (error || !market) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  type Joined = {
    id: string;
    buckets: unknown;
    listings: { list_price_cents: number } | { list_price_cents: number }[] | null;
  };
  const row = market as unknown as Joined;
  const buckets = coerceBuckets(row.buckets);
  const listing = Array.isArray(row.listings) ? row.listings[0] : row.listings;
  const listPriceCents = listing?.list_price_cents ?? 0;
  const anchorIdx = findAnchorBucket(buckets, listPriceCents);
  const fallback = deriveYesPriceCents(new Map(), row.id, anchorIdx, buckets.length || 5);

  try {
    const payload = await loadCandlesticks(row.id, outcome, interval, fallback);
    return NextResponse.json(payload);
  } catch (err) {
    log.error({ err, slug, outcome, interval }, "candlestick query failed");
    return NextResponse.json({ error: "candles_unavailable" }, { status: 500 });
  }
}
