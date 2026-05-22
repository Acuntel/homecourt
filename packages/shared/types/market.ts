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
