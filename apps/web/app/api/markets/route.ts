// HOMECOURT — GET /api/markets. Paginated feed used by the markets page +
// `useInfiniteQuery` on the client. Server reads the user's session (if any)
// so the `watching` flag is correct.

import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { isValidCategory } from "@/lib/markets/categories";
import { loadMarketsFeed } from "@/lib/markets/feed";
import { log } from "@/lib/log";
import type { MarketCategoryKey, MarketSortKey } from "@homecourt/shared";

export const dynamic = "force-dynamic";

const SORT_KEYS: MarketSortKey[] = ["new", "trending", "closing", "volatile"];

function asInt(value: string | null): number | undefined {
  if (!value) return undefined;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : undefined;
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const sp = request.nextUrl.searchParams;
  const rawCategory = sp.get("category");
  const category: MarketCategoryKey =
    rawCategory && isValidCategory(rawCategory) ? rawCategory : "all";
  const rawSort = sp.get("sort") as MarketSortKey | null;
  const sort: MarketSortKey = rawSort && SORT_KEYS.includes(rawSort) ? rawSort : "new";

  try {
    const result = await loadMarketsFeed({
      userId: user?.id ?? null,
      category,
      sort,
      q: sp.get("q") ?? undefined,
      zip: sp.get("zip") ?? undefined,
      beds: asInt(sp.get("beds")),
      minPriceCents: asInt(sp.get("minPrice")),
      maxPriceCents: asInt(sp.get("maxPrice")),
      cursor: sp.get("cursor"),
    });
    return NextResponse.json(result);
  } catch (err) {
    log.error({ err }, "markets feed query failed");
    return NextResponse.json({ error: "feed_unavailable" }, { status: 500 });
  }
}
