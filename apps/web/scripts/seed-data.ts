/**
 * HOMECOURT seed data generators — deterministic given a fixed seed.
 *
 * Uses a mulberry32 PRNG so identical seeds produce identical data on every
 * run. Keeps the orchestrator (seed.ts) short and focused on DB writes.
 */

// ---------------------------------------------------------------------------
// Deterministic PRNG (mulberry32)
// ---------------------------------------------------------------------------

export function makeRng(seed = 0xc0ffeebeef) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(rng: () => number, arr: readonly T[]): T {
  const idx = Math.floor(rng() * arr.length);
  return arr[idx] as T;
}

export function randInt(rng: () => number, lo: number, hi: number): number {
  return Math.floor(rng() * (hi - lo + 1)) + lo;
}

export function randFloat(rng: () => number, lo: number, hi: number): number {
  return rng() * (hi - lo) + lo;
}

// ---------------------------------------------------------------------------
// Austin ZIPs + street pools
// ---------------------------------------------------------------------------

export const AUSTIN_ZIPS = [
  "78701",
  "78702",
  "78704",
  "78745",
  "78751",
  "78757",
  "78758",
  "78759",
  "73301",
] as const;

export const ATX_BBOX = {
  west: -97.95,
  east: -97.55,
  south: 30.1,
  north: 30.5,
};

export const STREETS = [
  "Congress Ave",
  "Lavaca St",
  "Guadalupe St",
  "Lamar Blvd",
  "Burnet Rd",
  "Anderson Ln",
  "Manchaca Rd",
  "Slaughter Ln",
  "Riverside Dr",
  "Oltorf St",
  "Cesar Chavez St",
  "Barton Springs Rd",
  "South 1st St",
  "East 6th St",
  "MoPac Expy",
  "Research Blvd",
  "Parmer Ln",
  "Duval St",
  "Airport Blvd",
  "Springdale Rd",
  "Westgate Blvd",
  "Mesa Dr",
  "Steck Ave",
  "Spicewood Springs Rd",
] as const;

// 8 Unsplash house photos from BUILD.md §11 — rotate across properties.
export const PHOTO_URLS = [
  "https://images.unsplash.com/photo-1568605114967-8130f3a36994",
  "https://images.unsplash.com/photo-1570129477492-45c003edd2be",
  "https://images.unsplash.com/photo-1600585154340-be6161a56a0c",
  "https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83",
  "https://images.unsplash.com/photo-1605276374104-dee2a0ed3cd6",
  "https://images.unsplash.com/photo-1512917774080-9991f1c4c750",
  "https://images.unsplash.com/photo-1572120360610-d971b9d7767c",
  "https://images.unsplash.com/photo-1598228723793-52759bba239c",
] as const;

const PHOTO_QUERY = "?w=1280&q=80&auto=format&fit=crop";

export function photosFor(propertyIdx: number): string[] {
  // Each property gets a hero + 4 rotating photos for the gallery.
  const start = propertyIdx % PHOTO_URLS.length;
  return Array.from({ length: 5 }, (_, i) => {
    const url = PHOTO_URLS[(start + i) % PHOTO_URLS.length] as string;
    return `${url}${PHOTO_QUERY}`;
  });
}

// ---------------------------------------------------------------------------
// Property + market generators
// ---------------------------------------------------------------------------

export type SeedProperty = {
  address: string;
  city: string;
  state: "TX";
  zip: string;
  lat: number;
  lng: number;
  beds: number;
  baths: number;
  sqft: number;
  year_built: number;
  lot_sqft: number;
  zestimate_cents: number;
  photos: string[];
};

export function makeProperty(rng: () => number, idx: number): SeedProperty {
  const houseNum = randInt(rng, 100, 9999);
  const street = pick(rng, STREETS);
  const zip = pick(rng, AUSTIN_ZIPS);
  const lat = randFloat(rng, ATX_BBOX.south, ATX_BBOX.north);
  const lng = randFloat(rng, ATX_BBOX.west, ATX_BBOX.east);
  const beds = randInt(rng, 2, 5);
  const bathsTenths = randInt(rng, 15, 40); // 1.5 .. 4.0
  const baths = bathsTenths / 10;
  const sqft = randInt(rng, 900, 4200);
  const year_built = randInt(rng, 1940, 2024);
  const lot_sqft = randInt(rng, 3000, 18000);
  // Zestimate between $350K and $1.8M (cents)
  const zestimate_cents = randInt(rng, 350_000_00, 1_800_000_00);
  return {
    address: `${houseNum} ${street}`,
    city: zip === "73301" ? "Austin" : "Austin",
    state: "TX",
    zip,
    lat: Math.round(lat * 1_000_000) / 1_000_000,
    lng: Math.round(lng * 1_000_000) / 1_000_000,
    beds,
    baths,
    sqft,
    year_built,
    lot_sqft,
    zestimate_cents,
    photos: photosFor(idx),
  };
}

// Build the 5 binary-range buckets centered on list_price ± 12% in $25K bands.
export type Bucket = { label: string; low_cents: number; high_cents: number };

export function makeBuckets(listPriceCents: number): Bucket[] {
  const band = 25_000_00; // $25K in cents
  // Snap list price to nearest band, then place 5 contiguous bands centered.
  const snapped = Math.round(listPriceCents / band) * band;
  const lowestLow = snapped - 2 * band;
  return Array.from({ length: 5 }, (_, i) => {
    const low = lowestLow + i * band;
    const high = low + band;
    const label = `${moneyShort(low)}–${moneyShort(high)}`;
    return { label, low_cents: low, high_cents: high };
  });
}

function moneyShort(cents: number): string {
  const dollars = Math.round(cents / 100);
  if (dollars >= 1_000_000) {
    return `$${(dollars / 1_000_000).toFixed(2).replace(/\.?0+$/, "")}M`;
  }
  return `$${Math.round(dollars / 1000)}K`;
}

// Slug from address + zip — must match the unique constraint on markets.slug.
export function slugFor(address: string, zip: string, idx: number): string {
  const normalised = `${address}-${zip}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${normalised}-${idx.toString(36)}`;
}

// ---------------------------------------------------------------------------
// Demo users + comments
// ---------------------------------------------------------------------------

export const DEMO_USERS = [
  { username: "alice", email: "alice@homecourt.test", display_name: "Alice" },
  { username: "bob", email: "bob@homecourt.test", display_name: "Bob" },
  { username: "carol", email: "carol@homecourt.test", display_name: "Carol" },
  { username: "dave", email: "dave@homecourt.test", display_name: "Dave" },
  { username: "erin", email: "erin@homecourt.test", display_name: "Erin" },
  { username: "frank", email: "frank@homecourt.test", display_name: "Frank" },
] as const;

export const DEMO_PASSWORD = "Homecourt!2026";

export const COMMENT_TEMPLATES = [
  "Bullish on this one. Schools nearby are great.",
  "Comps in this ZIP closed $40K over ask last quarter.",
  "Pricing feels rich — taking the under.",
  "Lot size + ADU potential makes the high bucket interesting.",
  "Watch the days-on-market. Already 60 days listed.",
  "Renovations look thorough. Worth a premium.",
  "Foundation report would push me to the lowest bucket.",
  "Anyone seen recent photos? Last gallery looks staged hard.",
  "Closes before school starts, which usually compresses the spread.",
  "Cap rate at current rents puts fair value lower.",
];

export const REPLY_TEMPLATES = [
  "Agreed — same read.",
  "Disagree, here's why: ratio of $/sqft vs comps is off.",
  "Source on those comps?",
  "Good call, hadn't considered that.",
  "Watching with you.",
];
