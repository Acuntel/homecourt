// HOMECOURT — server-side loader for /markets/[slug].
// Pulls the property + listing + market + buckets + initial book snapshots +
// comps + comments + holders. Used by the SSR page and /api/markets/[slug].

import { createServiceClient } from "@/lib/supabase/server";
import {
  coerceBuckets,
  deriveYesPriceCents,
  findAnchorBucket,
  firstPhoto,
  type RawBucket,
} from "@/lib/markets/feed-helpers";
import { fetchAllBookSnapshots } from "@/lib/markets/engine";
import { loadMarketComments } from "@/lib/markets/comments";
import { loadMarketHolders } from "@/lib/markets/holders";
import { log } from "@/lib/log";
import type {
  ListingStatusKey,
  MarketBucketWithPrice,
  MarketDetail,
  MarketRecentFill,
  MarketSparklinePoint,
} from "@homecourt/shared";

interface DetailRow {
  id: string;
  slug: string;
  closes_at: string;
  created_at: string;
  resolves_at: string;
  state: string;
  final_bucket: number | null;
  final_price_cents: number | null;
  buckets: RawBucket[] | unknown;
  property_id: string;
  listing_id: string;
  opening_yes_price_cents: number | null;
  model_meta: ModelMeta | null;
}

interface ModelMeta {
  compPpsfCents: number;
  fairValueCents: number;
  valuationGap: number;
  isHot: boolean;
  dom: number;
  usableComps: number;
  confidence: "high" | "medium" | "low";
  method: string;
  ts: string;
}

interface PropertyRow {
  id: string;
  address: string;
  city: string;
  zip: string;
  state: string;
  lat: number | string;
  lng: number | string;
  beds: number;
  baths: number;
  sqft: number;
  year_built: number;
  zestimate_cents: number;
  photos: unknown;
  comps: unknown;
}

interface RawComp {
  address?: string;
  soldPriceCents?: number;
  sqft?: number;
  ppsfCents?: number;
  soldDate?: string | null;
}

interface ListingRow {
  id: string;
  list_price_cents: number;
  list_date: string;
  close_date: string | null;
  status: string;
}

const FILL_LOOKBACK_HOURS = 24;
const RECENT_FILL_LIMIT = 50;

function asNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const n = Number.parseFloat(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function coercePhotos(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((p): p is string => typeof p === "string" && p.length > 0);
}

function normalizeListStatus(raw: string): ListingStatusKey {
  switch (raw) {
    case "active":
    case "pending":
    case "closed":
      return raw;
    case "cancelled":
    default:
      return "withdrawn";
  }
}

/** Load market detail by slug. Returns null when slug doesn't exist. */
export async function loadMarketDetail(
  slug: string,
  userId: string | null,
): Promise<MarketDetail | null> {
  const supabase = createServiceClient();

  // 1. Market row + linked property + listing.
  const { data: market, error: mktErr } = await supabase
    .from("markets")
    .select(
      `id, slug, closes_at, created_at, resolves_at, state, final_bucket, final_price_cents, buckets, property_id, listing_id, opening_yes_price_cents, model_meta`,
    )
    .eq("slug", slug)
    .maybeSingle<DetailRow>();

  if (mktErr) {
    log.error({ err: mktErr, slug }, "market detail lookup failed");
    return null;
  }
  if (!market) return null;

  const [{ data: property }, { data: listing }] = await Promise.all([
    supabase
      .from("properties")
      .select(
        "id, address, city, zip, state, lat, lng, beds, baths, sqft, year_built, zestimate_cents, photos, comps",
      )
      .eq("id", market.property_id)
      .maybeSingle<PropertyRow>(),
    supabase
      .from("listings")
      .select("id, list_price_cents, list_date, close_date, status")
      .eq("id", market.listing_id)
      .maybeSingle<ListingRow>(),
  ]);

  if (!property || !listing) {
    log.warn({ slug, hasProp: !!property, hasListing: !!listing }, "missing property or listing");
    return null;
  }

  const buckets = coerceBuckets(market.buckets);
  const anchorIdx = findAnchorBucket(buckets, listing.list_price_cents);

  // 2. 24h fills for volume + last-price per outcome + sparkline.
  const since = new Date(Date.now() - FILL_LOOKBACK_HOURS * 60 * 60 * 1000).toISOString();
  const { data: fills24hRaw } = await supabase
    .from("fills")
    .select("id, outcome, price_cents, qty, created_at, taker_order_id")
    .eq("market_id", market.id)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(RECENT_FILL_LIMIT);

  const volumeByOutcome = new Map<number, number>();
  const lastPriceByOutcome = new Map<number, number>();
  let totalVolume = 0;
  let totalOi = 0;
  const sparkline: MarketSparklinePoint[] = [];
  const recentFills: MarketRecentFill[] = [];

  // Need taker order ids to figure out side
  const takerIds = new Set<string>();
  for (const f of fills24hRaw ?? []) {
    takerIds.add((f as { taker_order_id: string }).taker_order_id);
  }
  const sideByTaker = new Map<string, "buy" | "sell">();
  if (takerIds.size > 0) {
    const { data: takers } = await supabase
      .from("orders")
      .select("id, side")
      .in("id", Array.from(takerIds));
    for (const o of takers ?? []) {
      sideByTaker.set(o.id as string, (o.side as "buy" | "sell") ?? "buy");
    }
  }

  for (const f of fills24hRaw ?? []) {
    const outcome = f.outcome as number;
    const price = f.price_cents as number;
    const qty = f.qty as number;
    totalVolume += price * qty;
    totalOi += qty;
    volumeByOutcome.set(outcome, (volumeByOutcome.get(outcome) ?? 0) + price * qty);
    // First-seen (most-recent because we sorted desc) → "last price".
    if (!lastPriceByOutcome.has(outcome)) {
      lastPriceByOutcome.set(outcome, price);
    }
    if (outcome === anchorIdx) {
      sparkline.push({ ts: f.created_at as string, priceCents: price });
    }
    const side = sideByTaker.get(f.taker_order_id as string) ?? "buy";
    recentFills.push({
      id: f.id as string,
      outcomeIdx: outcome,
      side: side === "buy" ? "YES" : "NO",
      priceCents: price,
      qty,
      createdAt: f.created_at as string,
    });
  }
  // Sparkline must be chronological asc for the chart.
  sparkline.reverse();

  // 3. Per-bucket implied YES price + volume.
  const lastPriceLookup = new Map<string, Map<number, number>>();
  lastPriceLookup.set(market.id, lastPriceByOutcome);

  const bucketsWithPrice: MarketBucketWithPrice[] = buckets.map((b) => ({
    ...b,
    yesPriceCents: deriveYesPriceCents(
      lastPriceLookup,
      market.id,
      b.idx,
      buckets.length,
      b.idx === anchorIdx ? market.opening_yes_price_cents : null,
    ),
    volume24hCents: volumeByOutcome.get(b.idx) ?? 0,
  }));

  // 4. Watchlist for this user.
  let watching = false;
  if (userId) {
    const { data: w } = await supabase
      .from("watchlist")
      .select("market_id")
      .eq("market_id", market.id)
      .eq("user_id", userId)
      .maybeSingle();
    watching = !!w;
  }

  // 5. Comps, comments, holders, comments count, and engine book snapshots.
  const [commentsBundle, holders, { count: commentsCount }, bookSnapshots] = await Promise.all([
    loadMarketComments(market.id, userId),
    loadMarketHolders(market.id),
    supabase
      .from("comments")
      .select("id", { count: "exact", head: true })
      .eq("market_id", market.id)
      .is("deleted_at", null),
    fetchAllBookSnapshots(market.slug, buckets.length || 5),
  ]);

  const anchorPrice = bucketsWithPrice[anchorIdx]?.yesPriceCents ?? 50;

  // Real Redfin sold comparables stored on the property at scrape time.
  const realComps = (Array.isArray(property.comps) ? (property.comps as RawComp[]) : [])
    .filter((c) => c.soldPriceCents && c.sqft)
    .map((c, i) => ({
      propertyId: `comp-${i}`,
      address: c.address ?? "",
      soldPriceCents: c.soldPriceCents ?? null,
      soldDate: c.soldDate ?? null,
      distanceMeters: 0,
      sqft: c.sqft ?? 0,
      pricePerSqftCents: c.ppsfCents ?? 0,
    }));

  const detail: MarketDetail = {
    // MarketSummary fields
    slug: market.slug,
    marketId: market.id,
    propertyId: market.property_id,
    address: property.address,
    city: property.city,
    zip: property.zip,
    photoUrl: firstPhoto(property.photos),
    beds: property.beds,
    baths: Number(property.baths),
    sqft: property.sqft,
    zestimateCents: property.zestimate_cents,
    listPriceCents: listing.list_price_cents,
    buckets,
    anchorBucketIdx: anchorIdx,
    yesPriceCents: anchorPrice,
    volume24hCents: totalVolume,
    openInterest: totalOi,
    closesAt: market.closes_at,
    watching,
    sparkline,
    createdAt: market.created_at,

    // MarketDetail-only fields
    description: null,
    yearBuilt: property.year_built,
    geoLat: asNumber(property.lat),
    geoLng: asNumber(property.lng),
    photos: coercePhotos(property.photos),
    listStatus: normalizeListStatus(listing.status),
    listDate: listing.list_date,
    closeDate: listing.close_date,
    closePriceCents: null,
    marketState:
      market.state === "closing" || market.state === "settled" || market.state === "voided"
        ? (market.state as "closing" | "settled" | "voided")
        : "open",
    finalBucket: market.final_bucket,
    finalPriceCents: market.final_price_cents,
    bucketsWithPrice,
    comps: realComps,
    modelMeta: market.model_meta,
    initialBook: bookSnapshots,
    recentFills,
    commentsCount: commentsCount ?? 0,
    topHolders: holders,
    comments: commentsBundle,
  };

  return detail;
}
