// HOMECOURT — comp lookup for a market's detail page.
// Finds the 3 nearest sold listings via PostGIS ST_Distance. Falls back to
// the 3 nearest active listings (excluding self) if no closed sales nearby —
// the seed only sets list status 'active'.

import { createServiceClient } from "@/lib/supabase/server";
import { log } from "@/lib/log";
import type { MarketDetailComp } from "@homecourt/shared";

const COMP_LIMIT = 3;
const COMP_RADIUS_METERS = 1609.34; // 1 mile

interface CompRow {
  property_id: string;
  address: string;
  sold_price_cents: number | null;
  sold_date: string | null;
  distance_meters: number;
  sqft: number;
  price_per_sqft_cents: number;
}

/**
 * Loads nearest comps within 1 mile. Uses an RPC if present; otherwise a
 * fallback query against the `properties` + `listings` join.
 */
export async function loadMarketComps(
  subjectPropertyId: string,
  subjectSqft: number,
): Promise<MarketDetailComp[]> {
  const supabase = createServiceClient();

  // Attempt RPC — quick exit if it isn't installed yet. The PostGIS RPC isn't
  // part of the generated Database type, so we go through an `unknown` cast to
  // satisfy the strict overloads. Wrap in try/catch because newer supabase-js
  // versions can throw before resolving when the function is missing.
  type RpcResult = { data: CompRow[] | null; error: { message: string } | null };
  try {
    const rpcClient = supabase.rpc as unknown as (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<RpcResult>;
    const rpc = await rpcClient("nearest_comps", {
      subject_property_id: subjectPropertyId,
      radius_meters: COMP_RADIUS_METERS,
      max_results: COMP_LIMIT,
    });
    if (!rpc.error && rpc.data && rpc.data.length > 0) {
      return rpc.data.map((c) => ({
        propertyId: c.property_id,
        address: c.address,
        soldPriceCents: c.sold_price_cents,
        soldDate: c.sold_date,
        distanceMeters: c.distance_meters,
        sqft: c.sqft,
        pricePerSqftCents: c.price_per_sqft_cents,
      }));
    }
  } catch (err) {
    log.debug({ err: err instanceof Error ? err.message : String(err) }, "nearest_comps RPC threw");
  }

  // Fallback path: fetch subject geo + a slice of nearby properties, sort
  // server-side by haversine distance. Good enough for M5 with 120 seed rows.
  const { data: subject, error: subjErr } = await supabase
    .from("properties")
    .select("id, lat, lng, zip")
    .eq("id", subjectPropertyId)
    .maybeSingle();
  if (subjErr || !subject) {
    log.warn({ subjectPropertyId, err: subjErr }, "comp subject lookup failed");
    return [];
  }

  // Pull all same-ZIP candidates with their active list price as a stand-in.
  const { data: peers } = await supabase
    .from("properties")
    .select(
      "id, address, lat, lng, sqft, zestimate_cents, listings!inner ( list_price_cents, status )",
    )
    .eq("zip", subject.zip as string)
    .neq("id", subjectPropertyId)
    .limit(40);

  if (!peers || peers.length === 0) return [];

  type PeerRow = {
    id: string;
    address: string;
    lat: number | string;
    lng: number | string;
    sqft: number;
    zestimate_cents: number;
    listings:
      | { list_price_cents: number; status: string }[]
      | { list_price_cents: number; status: string }
      | null;
  };

  const peerRows = peers as unknown as PeerRow[];

  const sLat = Number(subject.lat);
  const sLng = Number(subject.lng);
  const distances = peerRows
    .map((p) => {
      const lat = Number(p.lat);
      const lng = Number(p.lng);
      const d = haversineMeters(sLat, sLng, lat, lng);
      const listings = Array.isArray(p.listings) ? p.listings[0] : p.listings;
      const price = listings?.list_price_cents ?? p.zestimate_cents;
      const sqft = p.sqft || subjectSqft || 1;
      return {
        propertyId: p.id,
        address: p.address,
        soldPriceCents: price ?? null,
        soldDate: null as string | null,
        distanceMeters: Math.round(d),
        sqft,
        pricePerSqftCents: sqft > 0 ? Math.round(price / sqft) : 0,
      } satisfies MarketDetailComp;
    })
    .filter((c) => c.distanceMeters <= COMP_RADIUS_METERS)
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, COMP_LIMIT);

  return distances;
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const toRad = (n: number) => (n * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}
