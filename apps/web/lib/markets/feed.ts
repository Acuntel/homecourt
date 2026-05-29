// HOMECOURT — server-side helper that loads the markets feed.
// Shared by the SSR markets page and the `/api/markets` route.

import { createServiceClient } from "@/lib/supabase/server";
import { zipsForCategory } from "@/lib/markets/categories";
import {
  coerceBuckets,
  deriveYesPriceCents,
  encodeCursor,
  findAnchorBucket,
  firstPhoto,
  parseCursor,
  type RawBucket,
} from "@/lib/markets/feed-helpers";
import type {
  MarketCategoryKey,
  MarketSortKey,
  MarketSparklinePoint,
  MarketSummary,
  MarketsFeedResponse,
} from "@homecourt/shared";

export const FEED_PAGE_SIZE = 24;

export interface FeedQueryInput {
  /** Calling user's id (for `watching` flag). null = anonymous. */
  userId: string | null;
  category?: MarketCategoryKey | undefined;
  sort?: MarketSortKey | undefined;
  q?: string | undefined;
  zip?: string | undefined;
  beds?: number | undefined;
  minPriceCents?: number | undefined;
  maxPriceCents?: number | undefined;
  /** Opaque cursor — currently a JSON-encoded {offset:number}. */
  cursor?: string | null | undefined;
  pageSize?: number | undefined;
  /** If true, restrict the result to markets `userId` has watchlisted. */
  watchedOnly?: boolean | undefined;
}

interface MarketJoinRow {
  id: string;
  slug: string;
  closes_at: string;
  created_at: string;
  buckets: RawBucket[] | unknown;
  property_id: string;
  opening_yes_price_cents: number | null;
  listings: {
    id: string;
    list_price_cents: number;
  } | null;
  properties: {
    id: string;
    address: string;
    city: string;
    zip: string;
    beds: number;
    baths: number;
    sqft: number;
    zestimate_cents: number;
    photos: unknown;
  } | null;
}

export async function loadMarketsFeed(input: FeedQueryInput): Promise<MarketsFeedResponse> {
  const supabase = createServiceClient();
  const pageSize = input.pageSize ?? FEED_PAGE_SIZE;
  const offset = parseCursor(input.cursor);
  const sort: MarketSortKey = input.sort ?? "new";
  const category = input.category ?? "all";

  // Watchlist-only mode — load the user's watched market IDs first, then
  // restrict the main query to them. Returns empty if user has none.
  let watchedIds: string[] | null = null;
  if (input.watchedOnly) {
    if (!input.userId) {
      return { items: [], nextCursor: null };
    }
    const { data: wl } = await supabase
      .from("watchlist")
      .select("market_id")
      .eq("user_id", input.userId);
    watchedIds = (wl ?? []).map((w) => w.market_id as string);
    if (watchedIds.length === 0) {
      return { items: [], nextCursor: null };
    }
  }

  // Build the base query — pull markets with their joined listing + property.
  let query = supabase
    .from("markets")
    .select(
      `id, slug, closes_at, created_at, buckets, property_id, opening_yes_price_cents,
       listings!inner ( id, list_price_cents ),
       properties!inner ( id, address, city, zip, beds, baths, sqft, zestimate_cents, photos )`,
    )
    .eq("state", "open");

  if (watchedIds) {
    query = query.in("id", watchedIds);
  }

  // ZIP — single ZIP filter wins, otherwise category geographic filter.
  if (input.zip) {
    query = query.eq("properties.zip", input.zip);
  } else {
    const zips = zipsForCategory(category);
    if (zips && zips.length > 0) {
      query = query.in("properties.zip", zips);
    }
  }

  // Closing-soon category — within 7 days.
  if (category === "closing") {
    const sevenDaysOut = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    query = query.lte("closes_at", sevenDaysOut);
  }
  // New category — created within last 7 days.
  if (category === "new") {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    query = query.gte("created_at", sevenDaysAgo);
  }

  // Beds / price band filters.
  if (input.beds && input.beds > 0) {
    query = query.gte("properties.beds", input.beds);
  }
  if (typeof input.minPriceCents === "number") {
    query = query.gte("listings.list_price_cents", input.minPriceCents);
  }
  if (typeof input.maxPriceCents === "number") {
    query = query.lte("listings.list_price_cents", input.maxPriceCents);
  }

  // Text search — address or ZIP ilike.
  if (input.q && input.q.trim().length > 0) {
    const term = input.q.trim().replace(/[%_]/g, "\\$&");
    query = query.or(`address.ilike.%${term}%,zip.ilike.%${term}%`, {
      referencedTable: "properties",
    });
  }

  // Sort — most options are applied client-side after we have the volume agg,
  // but we apply a sensible primary order to keep results stable.
  switch (sort) {
    case "closing":
      query = query.order("closes_at", { ascending: true });
      break;
    case "new":
    default:
      query = query.order("created_at", { ascending: false });
      break;
  }

  // Page with offset cursor.
  query = query.range(offset, offset + pageSize - 1);

  const { data: rows, error } = await query;
  if (error) throw error;

  const markets = (rows ?? []) as unknown as MarketJoinRow[];
  if (markets.length === 0) {
    return { items: [], nextCursor: null };
  }

  const marketIds = markets.map((m) => m.id);

  // Pull 24h fills aggregated per market — used for volume + last price.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: fillsRaw } = await supabase
    .from("fills")
    .select("market_id, outcome, price_cents, qty, created_at")
    .in("market_id", marketIds)
    .gte("created_at", since)
    .order("created_at", { ascending: true });

  const volumeByMarket = new Map<string, number>();
  const oiByMarket = new Map<string, number>();
  const lastPriceByMarketOutcome = new Map<string, Map<number, number>>();
  const sparkByMarket = new Map<string, MarketSparklinePoint[]>();
  const fillCountByMarket = new Map<string, number>();

  for (const f of fillsRaw ?? []) {
    const mid = f.market_id as string;
    const notional = (f.price_cents as number) * (f.qty as number);
    volumeByMarket.set(mid, (volumeByMarket.get(mid) ?? 0) + notional);
    oiByMarket.set(mid, (oiByMarket.get(mid) ?? 0) + (f.qty as number));
    fillCountByMarket.set(mid, (fillCountByMarket.get(mid) ?? 0) + 1);

    let perOutcome = lastPriceByMarketOutcome.get(mid);
    if (!perOutcome) {
      perOutcome = new Map<number, number>();
      lastPriceByMarketOutcome.set(mid, perOutcome);
    }
    perOutcome.set(f.outcome as number, f.price_cents as number);

    const sparkList = sparkByMarket.get(mid) ?? [];
    sparkList.push({
      ts: f.created_at as string,
      priceCents: f.price_cents as number,
    });
    sparkByMarket.set(mid, sparkList);
  }

  // Watchlist join — single round-trip.
  const watching = new Set<string>();
  if (input.userId) {
    const { data: wl } = await supabase
      .from("watchlist")
      .select("market_id")
      .eq("user_id", input.userId)
      .in("market_id", marketIds);
    for (const w of wl ?? []) watching.add(w.market_id as string);
  }

  let items: MarketSummary[] = markets
    .map((m): MarketSummary | null => {
      if (!m.listings || !m.properties) return null;
      const buckets = coerceBuckets(m.buckets);
      const listPrice = m.listings.list_price_cents;
      const anchorIdx = findAnchorBucket(buckets, listPrice);
      const yesPriceCents = deriveYesPriceCents(
        lastPriceByMarketOutcome,
        m.id,
        anchorIdx,
        buckets.length,
        m.opening_yes_price_cents,
      );
      return {
        slug: m.slug,
        marketId: m.id,
        propertyId: m.property_id,
        address: m.properties.address,
        city: m.properties.city,
        zip: m.properties.zip,
        photoUrl: firstPhoto(m.properties.photos),
        beds: m.properties.beds,
        baths: m.properties.baths,
        sqft: m.properties.sqft,
        zestimateCents: m.properties.zestimate_cents,
        listPriceCents: listPrice,
        buckets,
        anchorBucketIdx: anchorIdx,
        yesPriceCents,
        volume24hCents: volumeByMarket.get(m.id) ?? 0,
        openInterest: oiByMarket.get(m.id) ?? 0,
        closesAt: m.closes_at,
        watching: watching.has(m.id),
        sparkline: sparkByMarket.get(m.id) ?? [],
        createdAt: m.created_at,
      };
    })
    .filter((m): m is MarketSummary => m !== null);

  // Volatile / Trending — sort by fill count desc; if no fills for any, sort empty.
  if (sort === "volatile" || sort === "trending" || category === "volatile") {
    items.sort((a, b) => {
      const fa = fillCountByMarket.get(a.marketId) ?? 0;
      const fb = fillCountByMarket.get(b.marketId) ?? 0;
      if (fb !== fa) return fb - fa;
      // tiebreaker: 24h volume
      return b.volume24hCents - a.volume24hCents;
    });
    if (category === "volatile") {
      // Volatile category: hide markets with zero fills.
      items = items.filter((m) => (fillCountByMarket.get(m.marketId) ?? 0) > 0);
    }
  }

  const nextCursor = markets.length === pageSize ? encodeCursor(offset + pageSize) : null;

  return { items, nextCursor };
}
