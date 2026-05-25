/**
 * HOMECOURT seed script — M2.
 *
 * Idempotent. Uses a deterministic PRNG so reruns produce identical data.
 * Connects to the LOCAL Supabase stack (env: SUPABASE_URL + SERVICE_ROLE_KEY).
 *
 * Inserts:
 *   - 6 demo users (alice..frank @homecourt.test, password Homecourt!2026)
 *     each with an accounts row credited 50,000 sweepstakes coins (cents).
 *   - 120 Austin properties across the 9 ZIPs.
 *   - 120 active listings + 120 markets (binary_range_5, 5 buckets each).
 *   - 6 users × ~30 markets of mock positions (50–200 contracts each).
 *   - ~80 comments across 15 markets with some 2-deep replies.
 *
 * Run with:   pnpm db:seed
 */

import { createClient } from "@supabase/supabase-js";
import {
  AUSTIN_ZIPS,
  COMMENT_TEMPLATES,
  DEMO_PASSWORD,
  DEMO_USERS,
  REPLY_TEMPLATES,
  impliedYesPriceCents,
  makeBinaryBuckets,
  makeProperty,
  makeRng,
  pick,
  randInt,
  slugFor,
  type SeedProperty,
} from "./seed-data";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY ?? "";
const STARTING_COINS_CENTS = Number(process.env.SWEEPSTAKES_STARTING_COINS ?? 50_000);
const PROPERTY_COUNT = 120;
const TOTAL_COMMENTS = 80;
const COMMENT_MARKETS = 15;
const SEED = 0xc0ffeebeef;

if (!SERVICE_ROLE) {
  console.error("[seed] SUPABASE_SERVICE_ROLE_KEY (or SERVICE_ROLE_KEY) is required.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(msg: string) {
  // intentionally a script-level console.log — not in production code path
  // eslint-disable-next-line no-console
  console.log(`[seed] ${msg}`);
}

function todayPlus(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

function dateOnly(days: number): string {
  return (todayPlus(days) ?? "").slice(0, 10);
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

async function ensureUsers(): Promise<Map<string, string>> {
  log("ensuring 6 demo users …");
  const idByUsername = new Map<string, string>();

  for (const u of DEMO_USERS) {
    // Try to find existing auth user by email via the admin API.
    const list = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (list.error) throw list.error;
    const existing = list.data.users.find((x) => x.email === u.email);

    let userId: string;
    if (existing) {
      userId = existing.id;
    } else {
      const created = await supabase.auth.admin.createUser({
        email: u.email,
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: { username: u.username, display_name: u.display_name },
      });
      if (created.error) throw created.error;
      userId = created.data.user.id;
    }
    idByUsername.set(u.username, userId);

    // Fill public.users row (the trigger seeds id + email; we still upsert
    // username + display_name + kyc_status idempotently).
    const { error: upsertErr } = await supabase.from("users").upsert(
      {
        id: userId,
        email: u.email,
        username: u.username,
        display_name: u.display_name,
        kyc_status: "approved",
      },
      { onConflict: "id" },
    );
    if (upsertErr) throw upsertErr;

    // Account row with starting coins.
    const { error: acctErr } = await supabase
      .from("accounts")
      .upsert(
        { user_id: userId, cash_cents: STARTING_COINS_CENTS, locked_cents: 0 },
        { onConflict: "user_id" },
      );
    if (acctErr) throw acctErr;
  }

  log(`ensured ${idByUsername.size} demo users`);
  return idByUsername;
}

// ---------------------------------------------------------------------------
// Properties + listings + markets
// ---------------------------------------------------------------------------

async function ensurePropertiesAndMarkets(rng: () => number) {
  log(`ensuring ${PROPERTY_COUNT} properties / listings / markets …`);

  // Check existing market count for idempotency.
  const { count: marketsBefore, error: cntErr } = await supabase
    .from("markets")
    .select("id", { count: "exact", head: true });
  if (cntErr) throw cntErr;
  if ((marketsBefore ?? 0) >= PROPERTY_COUNT) {
    log(`already have ${marketsBefore} markets — skipping property seed`);
    return;
  }

  for (let i = 0; i < PROPERTY_COUNT; i++) {
    const prop: SeedProperty = makeProperty(rng, i);
    const slug = slugFor(prop.address, prop.zip, i);

    // Skip if a market with this slug already exists.
    const { data: existingMarket } = await supabase
      .from("markets")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (existingMarket) continue;

    // Insert property using a SQL RPC-free pattern: write lat/lng + a WKT
    // POINT into geo via the rest builder cannot set PostGIS directly, so
    // we go through a SQL execution via .rpc on a helper — instead we use
    // an upsert and let a trigger fill geo. We don't have such a trigger,
    // so write geo via raw SQL using the `rpc` channel.
    const wkt = `SRID=4326;POINT(${prop.lng} ${prop.lat})`;
    const { data: propRow, error: propErr } = await supabase
      .from("properties")
      .insert({
        address: prop.address,
        city: prop.city,
        state: prop.state,
        zip: prop.zip,
        lat: prop.lat,
        lng: prop.lng,
        beds: prop.beds,
        baths: prop.baths,
        sqft: prop.sqft,
        year_built: prop.year_built,
        lot_sqft: prop.lot_sqft,
        zestimate_cents: prop.zestimate_cents,
        photos: prop.photos,
        geo: wkt,
      })
      .select("id")
      .single();
    if (propErr) throw propErr;
    const propertyId = propRow.id as string;

    // Listing: list_price within ±15% of zestimate.
    const listPriceCents =
      prop.zestimate_cents + Math.round(prop.zestimate_cents * (rng() * 0.3 - 0.15));
    const listDays = randInt(rng, -45, -1); // 2026-04-01 .. 2026-05-21
    const closeDays = randInt(rng, 40, 130); // 2026-06-30 .. 2026-09-30
    const { data: listingRow, error: listErr } = await supabase
      .from("listings")
      .insert({
        property_id: propertyId,
        mls_id: `ATX-${i.toString().padStart(5, "0")}`,
        list_price_cents: listPriceCents,
        list_date: dateOnly(listDays),
        close_date: dateOnly(closeDays),
        status: "active",
      })
      .select("id")
      .single();
    if (listErr) throw listErr;
    const listingId = listingRow.id as string;

    // Market: binary YES/NO on "sells above list price".
    const buckets = makeBinaryBuckets(listPriceCents);
    const { error: mktErr } = await supabase.from("markets").insert({
      slug,
      property_id: propertyId,
      listing_id: listingId,
      kind: "binary_yes_no",
      buckets,
      opens_at: todayPlus(-30),
      closes_at: todayPlus(closeDays - 1),
      resolves_at: todayPlus(closeDays),
      state: "open",
      oracle_source: "mock",
    });
    if (mktErr) throw mktErr;
  }
  log(`finished property/listing/market seed`);
}

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

async function ensureComments(rng: () => number, userIds: string[]): Promise<void> {
  const { count: existingComments } = await supabase
    .from("comments")
    .select("id", { count: "exact", head: true });
  if ((existingComments ?? 0) >= TOTAL_COMMENTS) {
    log(`already have ${existingComments} comments — skipping`);
    return;
  }

  const { data: markets } = await supabase.from("markets").select("id").limit(COMMENT_MARKETS);
  if (!markets || markets.length === 0) return;

  log(`seeding ~${TOTAL_COMMENTS} comments across ${markets.length} markets …`);

  let written = 0;
  const targetTopLevel = Math.floor(TOTAL_COMMENTS * 0.7);
  // Top-level comments
  for (let i = 0; i < targetTopLevel && written < TOTAL_COMMENTS; i++) {
    const market = pick(rng, markets);
    const user = pick(rng, userIds);
    const body = pick(rng, COMMENT_TEMPLATES);
    const { data: parentRow, error } = await supabase
      .from("comments")
      .insert({ market_id: market.id, user_id: user, body })
      .select("id, market_id")
      .single();
    if (error) throw error;
    written++;

    // 30% chance of a single 1-deep reply
    if (rng() < 0.3 && written < TOTAL_COMMENTS) {
      const replier = pick(rng, userIds);
      const replyBody = pick(rng, REPLY_TEMPLATES);
      const { error: replyErr } = await supabase.from("comments").insert({
        market_id: parentRow.market_id,
        user_id: replier,
        body: replyBody,
        parent_id: parentRow.id,
      });
      if (replyErr) throw replyErr;
      written++;
    }
  }

  // Fill remainder as more top-level comments to hit the target.
  while (written < TOTAL_COMMENTS) {
    const market = pick(rng, markets);
    const user = pick(rng, userIds);
    const body = pick(rng, COMMENT_TEMPLATES);
    const { error } = await supabase
      .from("comments")
      .insert({ market_id: market.id, user_id: user, body });
    if (error) throw error;
    written++;
  }
  log(`wrote ${written} comments`);
}

// ---------------------------------------------------------------------------
// Mock positions via direct fills (no engine running in M2)
// ---------------------------------------------------------------------------

interface MarketTradeRow {
  id: string;
  listings: { list_price_cents: number } | null;
  properties: { zestimate_cents: number } | null;
}

async function ensureMockPositions(rng: () => number, userIds: string[]) {
  // Check if any orders already exist — if so, treat as already-seeded.
  const { count: orderCount } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true });
  if ((orderCount ?? 0) > 0) {
    log(`already have ${orderCount} orders — skipping trade seed`);
    return;
  }

  const { data: rawMarkets } = await supabase
    .from("markets")
    .select("id, listings!inner(list_price_cents), properties!inner(zestimate_cents)")
    .limit(200);
  const markets = (rawMarkets ?? []) as unknown as MarketTradeRow[];
  if (markets.length === 0) return;

  log(`seeding price-setting trades across ${markets.length} markets …`);

  // For each market, set the YES (outcome 1 = "above list") price by writing
  // one maker/taker fill at the implied price. Rotating the buyer/seller across
  // demo users gives every user a portfolio of positions.
  let n = 0;
  for (let i = 0; i < markets.length; i++) {
    const m = markets[i]!;
    if (!m.listings || !m.properties) continue;
    const yesPrice = impliedYesPriceCents(
      m.properties.zestimate_cents,
      m.listings.list_price_cents,
      rng,
    );
    const buyer = userIds[i % userIds.length]!;
    const seller = userIds[(i + 1) % userIds.length]!;
    const qty = randInt(rng, 20, 200);
    const outcome = 1; // YES = sells above list

    const { data: makerRow, error: makerErr } = await supabase
      .from("orders")
      .insert({
        client_idempotency_key: `seed_maker_${i}`,
        market_id: m.id,
        user_id: seller,
        outcome,
        side: "sell",
        price_cents: yesPrice,
        qty,
        filled_qty: qty,
        status: "filled",
      })
      .select("id")
      .single();
    if (makerErr) throw makerErr;

    const { data: takerRow, error: takerErr } = await supabase
      .from("orders")
      .insert({
        client_idempotency_key: `seed_taker_${i}`,
        market_id: m.id,
        user_id: buyer,
        outcome,
        side: "buy",
        price_cents: yesPrice,
        qty,
        filled_qty: qty,
        status: "filled",
      })
      .select("id")
      .single();
    if (takerErr) throw takerErr;

    const { error: fillErr } = await supabase.from("fills").insert({
      market_id: m.id,
      taker_order_id: takerRow.id,
      maker_order_id: makerRow.id,
      outcome,
      price_cents: yesPrice,
      qty,
      fee_cents: 0,
    });
    if (fillErr) throw fillErr;
    n++;
  }
  log(`seeded ${n} price-setting trades`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const rng = makeRng(SEED);

  const userMap = await ensureUsers();
  const userIds = Array.from(userMap.values());

  await ensurePropertiesAndMarkets(rng);
  await ensureMockPositions(rng, userIds);
  await ensureComments(rng, userIds);

  // Final counts for the operator.
  const [props, mkts, usrs, cmts] = await Promise.all([
    supabase.from("properties").select("id", { count: "exact", head: true }),
    supabase.from("markets").select("id", { count: "exact", head: true }),
    supabase.from("users").select("id", { count: "exact", head: true }),
    supabase.from("comments").select("id", { count: "exact", head: true }),
  ]);
  log(
    `done. properties=${props.count} markets=${mkts.count} users=${usrs.count} comments=${cmts.count}`,
  );
  log(`ZIPs covered: ${AUSTIN_ZIPS.join(", ")}`);
}

main().catch((err) => {
  console.error("[seed] FAILED:", err);
  process.exit(1);
});
