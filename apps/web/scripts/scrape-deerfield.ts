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

import { makeBuckets, slugFor, type Bucket } from "./seed-data";

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
}

interface RedfinResponse {
  payload?: { homes?: RedfinHome[] };
  resultCode?: number;
  errorMessage?: string;
}

// Redfin photos are CDN-signed; can't load cross-origin. Use generic stock.
const STOCK_PHOTOS = [
  "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=1200",
  "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=1200",
  "https://images.unsplash.com/photo-1605276373954-0c4a0dac5b12?w=1200",
  "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200",
  "https://images.unsplash.com/photo-1582268611958-ebfd161ef9cf?w=1200",
  "https://images.unsplash.com/photo-1599809275671-b5942cabc7a2?w=1200",
];

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

function pickPhotos(seed: number): string[] {
  return [0, 1, 2, 3, 4].map((i) => STOCK_PHOTOS[(seed + i) % STOCK_PHOTOS.length]!);
}

async function ingest(
  homes: RedfinHome[],
): Promise<{ inserted: number; skipped: number; errors: string[] }> {
  const result = { inserted: 0, skipped: 0, errors: [] as string[] };
  const filtered = homes.filter(isValidListing);
  console.log(`[deerfield] filtered ${filtered.length} of ${homes.length} homes`);

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
          photos: pickPhotos(i),
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

      const buckets: Bucket[] = makeBuckets(listPriceCents);
      const closesAt = new Date(Date.now() + 60 * 86_400_000).toISOString();
      const resolvesAt = new Date(Date.now() + 67 * 86_400_000).toISOString();
      const opensAt = new Date(Date.now() - 86_400_000).toISOString();

      // markets schema: kind (not contract_type), oracle_source (not
      // resolution_source). state enum is {upcoming, open, closing,
      // settled, voided}.
      const { error: mktErr } = await supabase.from("markets").insert({
        slug,
        property_id: prop.id,
        listing_id: listing.id,
        kind: "binary_range_5",
        buckets,
        state: "open",
        opens_at: opensAt,
        closes_at: closesAt,
        resolves_at: resolvesAt,
        oracle_source: "redfin_scrape_deerfield_60015",
      });

      if (mktErr) {
        result.errors.push(`market ${address}: ${mktErr.message}`);
        continue;
      }
      result.inserted += 1;
    } catch (err) {
      result.errors.push(`unexpected ${address}: ${(err as Error).message}`);
      result.skipped += 1;
    }
  }
  return result;
}

async function main() {
  console.log("[deerfield] fetching Redfin /zipcode/60015 via stingray API ...");
  const homes = await fetchRedfinHomes();
  console.log(`[deerfield] got ${homes.length} homes from Redfin`);

  const result = await ingest(homes);
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
