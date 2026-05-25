/* eslint-disable no-console -- script logs intentionally use console */
/**
 * HOMECOURT — scrape real Deerfield IL (60015) listings from Redfin's
 * public stingray API and ingest into local Supabase as new markets.
 *
 * USAGE:
 *   SUPABASE_SERVICE_ROLE_KEY=... pnpm --filter web exec tsx scripts/scrape-deerfield.ts
 *
 * LEGAL NOTE:
 *   - This pulls Redfin's PUBLIC search-results API. No auth, no captcha.
 *   - Redfin's TOS prohibits scraping. Fine for a Phase 0 sweepstakes
 *     demo on your laptop — you cannot legally redistribute this data,
 *     sell it, or run it as a real-money product.
 *   - For Phase 1 real-money, swap to ATTOM Data or a direct MLS license.
 */

import { createClient } from "@supabase/supabase-js";

import { makeBinaryBuckets, slugFor, type Bucket } from "./seed-data";

// How many real listings to ingest as markets.
const MAX_HOMES = 10;

// Implied "sells above list" chance (¢) from public days-on-market: fresher
// listings in a hot suburb are likelier to clear over ask.
function impliedYesFromDom(dom: number): number {
  const base = 62 - Math.min(40, dom) * 0.85;
  return Math.max(28, Math.min(72, Math.round(base)));
}

const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY ?? "";

if (!SERVICE_ROLE) {
  console.error("[deerfield] SUPABASE_SERVICE_ROLE_KEY required.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Redfin region IDs are NOT the ZIP itself. 25758 = 60015 Deerfield IL.
const REDFIN_REGION_ID = 25758;
const REDFIN_MARKET = "chicago";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

interface RedfinHome {
  mlsId?: { value?: string };
  mlsStatus?: string;
  price?: { value?: number };
  hoa?: { value?: number };
  sqFt?: { value?: number };
  beds?: number;
  baths?: number;
  yearBuilt?: { value?: number };
  streetLine?: { value?: string };
  city?: string;
  state?: string;
  zip?: string;
  latLong?: { value?: { latitude?: number; longitude?: number } };
  url?: string;
  dom?: { value?: number };
  numPictures?: number;
}

interface RedfinResponse {
  payload?: { homes?: RedfinHome[] };
  resultCode?: number;
  errorMessage?: string;
}

// Stock fallback only if Redfin detail-page scrape fails for a given listing.
const STOCK_FALLBACK = [
  "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=1200",
  "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=1200",
  "https://images.unsplash.com/photo-1605276373954-0c4a0dac5b12?w=1200",
];

const PHOTO_DELAY_MS = 250; // be nice to Redfin

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Fetch the Redfin listing detail page for this home and pull real photo
 * URLs from the embedded JSON / HTML. Returns up to 5 photo URLs. Falls
 * back to stock photos on any failure.
 */
async function fetchListingPhotos(home: RedfinHome, fallbackSeed: number): Promise<string[]> {
  if (!home.url) return fallbackPhotos(fallbackSeed);
  const url = `https://www.redfin.com${home.url}`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    if (!res.ok) {
      console.log(`  ! photo fetch ${res.status} for ${home.streetLine?.value}`);
      return fallbackPhotos(fallbackSeed);
    }
    const html = await res.text();
    // bigphoto = real listing photos. genBcs/bcsphoto = generated placeholders.
    const matches = html.matchAll(
      /https:\/\/ssl\.cdn-redfin\.com\/photo\/[^"' ]*\/bigphoto\/[^"' ]+\.(?:jpg|webp)/g,
    );
    const urls = new Set<string>();
    for (const m of matches) urls.add(m[0]);
    const arr = Array.from(urls).slice(0, 5);
    if (arr.length === 0) {
      console.log(`  ! no bigphoto urls in HTML for ${home.streetLine?.value}`);
      return fallbackPhotos(fallbackSeed);
    }
    return arr;
  } catch (err) {
    console.log(`  ! photo fetch threw for ${home.streetLine?.value}: ${(err as Error).message}`);
    return fallbackPhotos(fallbackSeed);
  }
}

function fallbackPhotos(seed: number): string[] {
  return [0, 1, 2, 3, 4].map((i) => STOCK_FALLBACK[(seed + i) % STOCK_FALLBACK.length]!);
}

async function fetchRedfinHomes(): Promise<RedfinHome[]> {
  const params = new URLSearchParams({
    al: "1",
    market: REDFIN_MARKET,
    num_homes: "350",
    ord: "redfin-recommended-asc",
    page_number: "1",
    region_id: String(REDFIN_REGION_ID),
    region_type: "2",
    sf: "1,2,3,5,6,7",
    status: "1",
    uipt: "1,2,3,4,5,6,7,8",
    v: "8",
  });
  const url = `https://www.redfin.com/stingray/api/gis?${params.toString()}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "application/json",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  if (!res.ok) throw new Error(`redfin gis ${res.status}`);
  const text = await res.text();
  const json = JSON.parse(text.replace(/^\{\}&&/, "")) as RedfinResponse;
  if (json.resultCode !== 0) throw new Error(`redfin: ${json.errorMessage}`);
  return json.payload?.homes ?? [];
}

function isValidListing(h: RedfinHome): boolean {
  return Boolean(
    h.streetLine?.value &&
      h.city?.toLowerCase() === "deerfield" &&
      h.state === "IL" &&
      h.zip === "60015" &&
      h.price?.value &&
      h.beds &&
      h.baths &&
      h.sqFt?.value &&
      h.yearBuilt?.value &&
      h.latLong?.value?.latitude &&
      h.latLong?.value?.longitude,
  );
}

async function ingest(
  homes: RedfinHome[],
  userIds: string[],
): Promise<{ inserted: number; skipped: number; errors: string[] }> {
  const result = { inserted: 0, skipped: 0, errors: [] as string[] };
  const filtered = homes.filter(isValidListing).slice(0, MAX_HOMES);
  console.log(`[deerfield] using ${filtered.length} of ${homes.length} homes (cap ${MAX_HOMES})`);

  for (let i = 0; i < filtered.length; i += 1) {
    const h = filtered[i]!;
    const address = h.streetLine!.value!;
    const zip = h.zip!;
    const slug = slugFor(address, zip, i);
    const listPriceCents = Math.round(h.price!.value! * 100);
    const lat = h.latLong!.value!.latitude!;
    const lng = h.latLong!.value!.longitude!;

    // Skip if market already exists by slug — idempotent reruns.
    const { data: existing } = await supabase
      .from("markets")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (existing) {
      result.skipped += 1;
      continue;
    }

    try {
      // Pull real photos from this listing's Redfin detail page.
      console.log(`  • ${i + 1}/${filtered.length} ${address} — fetching photos`);
      const photos = await fetchListingPhotos(h, i);
      await sleep(PHOTO_DELAY_MS);

      // properties has no unique key beyond id. Always insert; address acts
      // as a soft dedupe via the markets.slug check above.
      const wkt = `POINT(${lng} ${lat})`;
      const { data: prop, error: propErr } = await supabase
        .from("properties")
        .insert({
          address,
          city: h.city!,
          state: h.state!,
          zip,
          lat,
          lng,
          beds: h.beds!,
          baths: h.baths!,
          sqft: h.sqFt!.value!,
          year_built: h.yearBuilt!.value!,
          zestimate_cents: listPriceCents,
          photos,
          geo: wkt,
        })
        .select("id")
        .single();

      if (propErr || !prop) {
        result.errors.push(`property ${address}: ${propErr?.message}`);
        continue;
      }

      const listDate = new Date(Date.now() - (h.dom?.value ?? 14) * 86_400_000)
        .toISOString()
        .slice(0, 10);

      // listings schema: id, property_id, mls_id (unique-where-not-null),
      // list_price_cents, list_date, close_date, status. No mls_source or
      // close_price_cents columns. Prefix MLS id with "RFSCRAPE-" so we
      // don't collide with a real MLS id in case we later license MRED.
      const { data: listing, error: listErr } = await supabase
        .from("listings")
        .insert({
          property_id: prop.id,
          mls_id: `RFSCRAPE-${h.mlsId?.value ?? `idx-${i}`}`,
          status: "active",
          list_price_cents: listPriceCents,
          list_date: listDate,
          close_date: null,
        })
        .select("id")
        .single();

      if (listErr || !listing) {
        result.errors.push(`listing ${address}: ${listErr?.message}`);
        continue;
      }

      // Binary YES/NO: idx0 "at or below list" (NO), idx1 "above list" (YES).
      const buckets: Bucket[] = makeBinaryBuckets(listPriceCents);
      const closesAt = new Date(Date.now() + 60 * 86_400_000).toISOString();
      const resolvesAt = new Date(Date.now() + 67 * 86_400_000).toISOString();
      const opensAt = new Date(Date.now() - 86_400_000).toISOString();

      const { data: market, error: mktErr } = await supabase
        .from("markets")
        .insert({
          slug,
          property_id: prop.id,
          listing_id: listing.id,
          kind: "binary_yes_no",
          buckets,
          state: "open",
          opens_at: opensAt,
          closes_at: closesAt,
          resolves_at: resolvesAt,
          oracle_source: "redfin_scrape_deerfield_60015",
        })
        .select("id")
        .single();

      if (mktErr || !market) {
        result.errors.push(`market ${address}: ${mktErr?.message}`);
        continue;
      }

      // Set the YES (outcome 1 = above list) price with one maker/taker fill,
      // derived from public days-on-market.
      const yesPrice = impliedYesFromDom(h.dom?.value ?? 14);
      await seedPriceFill(market.id, yesPrice, userIds, i, result);

      result.inserted += 1;
    } catch (err) {
      result.errors.push(`unexpected ${address}: ${(err as Error).message}`);
      result.skipped += 1;
    }
  }
  return result;
}

// Insert a maker (sell) + taker (buy) order on the YES outcome and a fill at
// `yesPrice`, so the feed/detail derive a live YES price (and two users hold
// positions). Best-effort: records errors but never throws.
async function seedPriceFill(
  marketId: string,
  yesPrice: number,
  userIds: string[],
  idx: number,
  result: { errors: string[] },
): Promise<void> {
  if (userIds.length < 2) return;
  const seller = userIds[idx % userIds.length]!;
  const buyer = userIds[(idx + 1) % userIds.length]!;
  const qty = 50 + ((idx * 13) % 150);
  const base = { market_id: marketId, outcome: 1, price_cents: yesPrice, qty, filled_qty: qty };
  const maker = await supabase
    .from("orders")
    .insert({
      ...base,
      client_idempotency_key: `df_maker_${marketId}`,
      user_id: seller,
      side: "sell",
      status: "filled",
    })
    .select("id")
    .single();
  const taker = await supabase
    .from("orders")
    .insert({
      ...base,
      client_idempotency_key: `df_taker_${marketId}`,
      user_id: buyer,
      side: "buy",
      status: "filled",
    })
    .select("id")
    .single();
  if (maker.error || taker.error || !maker.data || !taker.data) {
    result.errors.push(`orders ${marketId}: ${maker.error?.message ?? taker.error?.message}`);
    return;
  }
  const fill = await supabase.from("fills").insert({
    market_id: marketId,
    taker_order_id: taker.data.id,
    maker_order_id: maker.data.id,
    outcome: 1,
    price_cents: yesPrice,
    qty,
    fee_cents: 0,
  });
  if (fill.error) result.errors.push(`fill ${marketId}: ${fill.error.message}`);
}

async function fetchDemoUserIds(): Promise<string[]> {
  const { data } = await supabase.from("users").select("id").limit(6);
  return (data ?? []).map((u) => u.id as string);
}

async function main() {
  console.log("[deerfield] fetching Redfin /zipcode/60015 via stingray API ...");
  const homes = await fetchRedfinHomes();
  console.log(`[deerfield] got ${homes.length} homes from Redfin`);

  const userIds = await fetchDemoUserIds();
  const result = await ingest(homes, userIds);
  console.log("");
  console.log(`[deerfield] inserted: ${result.inserted}`);
  console.log(`[deerfield] skipped:  ${result.skipped}`);
  if (result.errors.length > 0) {
    console.log(`[deerfield] errors:   ${result.errors.length}`);
    result.errors.slice(0, 5).forEach((e) => console.log("  -", e));
  }
  console.log("");
  console.log("[deerfield] done. Restart the engine so it picks up the new markets:");
  console.log(
    "           lsof -ti:8090 | xargs kill -9 && (cd services/engine && DATABASE_URL=… go run ./cmd/engine &)",
  );
}

main().catch((err) => {
  console.error("[deerfield] fatal:", err);
  process.exit(1);
});
