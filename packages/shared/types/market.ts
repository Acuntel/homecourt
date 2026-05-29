// HOMECOURT — feed payload types shared between web ⇄ API.
// All money values are BIGINT cents. Times are ISO 8601.

export interface MarketBucket {
  idx: number;
  loCents: number;
  hiCents: number;
  label: string;
}

export interface MarketSparklinePoint {
  ts: string;
  priceCents: number;
}

export interface MarketSummary {
  slug: string;
  marketId: string;
  propertyId: string;
  address: string;
  city: string;
  zip: string;
  photoUrl: string | null;
  beds: number;
  baths: number;
  sqft: number;
  zestimateCents: number;
  listPriceCents: number;
  buckets: MarketBucket[];
  /** Bucket index containing list_price — the "anchor" YES outcome. */
  anchorBucketIdx: number;
  /** Current implied probability (cents, 1..99) for the anchor bucket. */
  yesPriceCents: number;
  volume24hCents: number;
  openInterest: number;
  closesAt: string;
  watching: boolean;
  sparkline: MarketSparklinePoint[];
  createdAt: string;
}

export interface MarketSearchHit {
  slug: string;
  address: string;
  city: string;
  zip: string;
}

export type MarketSortKey = "new" | "trending" | "closing" | "volatile";

export type MarketCategoryKey =
  | "all"
  | "central"
  | "east"
  | "north"
  | "south"
  | "west"
  | "closing"
  | "new"
  | "volatile";

export interface MarketsFeedResponse {
  items: MarketSummary[];
  nextCursor: string | null;
}

// ---------------------------------------------------------------------------
// Detail payload — used by the [slug] page + GET /api/markets/:slug.
// ---------------------------------------------------------------------------

export type ListingStatusKey = "active" | "pending" | "closed" | "withdrawn";

export interface MarketBucketWithPrice extends MarketBucket {
  yesPriceCents: number;
  volume24hCents: number;
}

export interface MarketDetailComp {
  propertyId: string;
  address: string;
  soldPriceCents: number | null;
  soldDate: string | null;
  distanceMeters: number;
  sqft: number;
  pricePerSqftCents: number;
}

/** L2 order-book snapshot levels: [priceCents, qty]. */
export type BookLevel = [number, number];

export interface MarketBookSnapshot {
  outcomeIdx: number;
  seq: number;
  bids: BookLevel[];
  asks: BookLevel[];
}

export interface MarketRecentFill {
  id: string;
  outcomeIdx: number;
  side: "YES" | "NO";
  priceCents: number;
  qty: number;
  createdAt: string;
}

export interface MarketTopHolder {
  userId: string;
  username: string;
  outcomeIdx: number;
  side: "YES" | "NO";
  qty: number;
}

export interface MarketComment {
  id: string;
  parentId: string | null;
  userId: string;
  body: string;
  score: number;
  createdAt: string;
  username: string;
  displayName: string | null;
  /** Current viewer's vote on this comment (1 / -1 / 0). 0 when not voted or anon. */
  myVote: -1 | 0 | 1;
  replies: MarketComment[];
}

export type MarketStateKey = "open" | "closing" | "settled" | "voided";

export interface MarketModelMeta {
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

export interface MarketDetail extends MarketSummary {
  /** How the opening line was priced from real comps; null for legacy markets. */
  modelMeta: MarketModelMeta | null;
  description: string | null;
  yearBuilt: number;
  geoLat: number;
  geoLng: number;
  photos: string[];
  listStatus: ListingStatusKey;
  listDate: string;
  closeDate: string | null;
  closePriceCents: number | null;
  marketState: MarketStateKey;
  finalBucket: number | null;
  finalPriceCents: number | null;
  bucketsWithPrice: MarketBucketWithPrice[];
  comps: MarketDetailComp[];
  initialBook: MarketBookSnapshot[];
  recentFills: MarketRecentFill[];
  commentsCount: number;
  topHolders: MarketTopHolder[];
  comments: MarketComment[];
}

export interface MarketCandlestick {
  ts: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export type CandlestickInterval = "1H" | "6H" | "1D" | "1W" | "1M" | "ALL";

export interface MarketCandlesticksResponse {
  outcomeIdx: number;
  interval: CandlestickInterval;
  candles: MarketCandlestick[];
  implicitPriceCents: number;
}
