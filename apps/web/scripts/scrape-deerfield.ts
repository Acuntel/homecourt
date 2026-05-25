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
  propertyId?: number;
  listingId?: number;
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
  isHot?: boolean;
}

// --- Real "sells above list" model from Redfin sold comparables -------------

interface SoldComp {
  address: string;
  soldPriceCents: number;
  sqft: number;
  ppsfCents: number;
  soldDate: string | null;
}

interface ModelLine {
  yesPriceCents: number;
  fairValueCents: number;
  meta: {
    compPpsfCents: number;
    fairValueCents: number;
    valuationGap: number;
    isHot: boolean;
    dom: number;
    usableComps: number;
    confidence: "high" | "medium" | "low";
    method: "redfin_comps_v2";
    ts: string;
  };
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : Math.round((s[mid - 1]! + s[mid]!) / 2);
}

const clampPct = (p: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, p));

// Pull the subject's recent sold comparables from Redfin's public avm endpoint.
async function fetchComps(propertyId: number, listingId: number): Promise<SoldComp[]> {
  const url = `https://www.redfin.com/stingray/api/home/details/avm?propertyId=${propertyId}&listingId=${listingId}&accessLevel=1`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
    if (!res.ok) return [];
    const json = JSON.parse((await res.text()).replace(/^\{\}&&/, "")) as {
      payload?: { comparables?: Record<string, unknown>[] };
    };
    const raw = json.payload?.comparables ?? [];
    const comps: SoldComp[] = [];
    for (const c of raw) {
      const price = (c.priceInfo as { amount?: number } | undefined)?.amount;
      const sqft = (c.sqFt as { value?: number } | undefined)?.value;
      if (!price || !sqft || sqft <= 0) continue;
      const sa = c.streetAddress as { assembledAddress?: string } | undefined;
      const sold = c.soldDate as number | undefined;
      comps.push({
        address: sa?.assembledAddress ?? "",
        soldPriceCents: Math.round(price * 100),
        sqft,
        ppsfCents: Math.round((price * 100) / sqft),
        soldDate: sold ? new Date(sold).toISOString().slice(0, 10) : null,
      });
    }
    return comps;
  } catch {
    return [];
  }
}

// Deterministic, documented probability that the home sells above list. No RNG.
function modelYesProbability(args: {
  listPriceCents: number;
  sqft: number;
  comps: SoldComp[];
  dom: number;
  isHot: boolean;
}): ModelLine {
  const { listPriceCents, sqft, comps, dom, isHot } = args;
  const usable = comps.filter((c) => c.soldPriceCents > 0 && c.sqft > 0);
  const ts = new Date().toISOString();
  if (usable.length === 0 || sqft <= 0) {
    return {
      yesPriceCents: 50,
      fairValueCents: listPriceCents,
      meta: {
        compPpsfCents: 0,
        fairValueCents: listPriceCents,
        valuationGap: 0,
        isHot,
        dom,
        usableComps: 0,
        confidence: "low",
        method: "redfin_comps_v2",
        ts,
      },
    };
  }
  const compPpsfCents = median(usable.map((c) => c.ppsfCents));
  const fairValueCents = Math.round(compPpsfCents * sqft);
  const valuationGap = (fairValueCents - listPriceCents) / listPriceCents;
  let p = 1 / (1 + Math.exp(-6 * valuationGap));
  if (isHot) p += 0.05;
  p -= 0.004 * Math.max(0, dom - 21);
  p = clampPct(p, 0.15, 0.88);
  const confidence = usable.length >= 3 ? "high" : "medium";
  return {
    yesPriceCents: clampPct(Math.round(p * 100), 1, 99),
    fairValueCents,
    meta: {
      compPpsfCents,
      fairValueCents,
      valuationGap: Math.round(valuationGap * 1000) / 1000,
      isHot,
      dom,
      usableComps: usable.length,
      confidence,
      method: "redfin_comps_v2",
      ts,
    },
  };
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
      // Pull real photos + real sold comparables from Redfin.
      console.log(`  • ${i + 1}/${filtered.length} ${address} — fetching photos + comps`);
      const photos = await fetchListingPhotos(h, i);
      await sleep(PHOTO_DELAY_MS);
      const comps = h.propertyId && h.listingId ? await fetchComps(h.propertyId, h.listingId) : [];
      await sleep(PHOTO_DELAY_MS);

      // Real, documented "sells above list" probability from the comps.
      const model = modelYesProbability({
        listPriceCents,
        sqft: h.sqFt!.value!,
        comps,
        dom: h.dom?.value ?? 0,
        isHot: Boolean(h.isHot),
      });
      console.log(
        `      ↳ YES ${model.yesPriceCents}¢ · ${model.meta.usableComps} comps · ${model.meta.confidence}`,
      );

      // properties has no unique key beyond id. Always insert; address acts
      // as a soft dedupe via the markets.slug check above. zestimate = the
      // comp-derived fair value; comps stored for the panel.
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
          zestimate_cents: model.fairValueCents,
          photos,
          comps,
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
          opening_yes_price_cents: model.yesPriceCents,
          model_meta: model.meta,
        })
        .select("id")
        .single();

      if (mktErr || !market) {
        result.errors.push(`market ${address}: ${mktErr?.message}`);
        continue;
      }

      // No seeded trades: the opening line is the model, volume stays 0 until
      // real users trade.
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
