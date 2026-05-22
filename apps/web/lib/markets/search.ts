// HOMECOURT — fuzzy search across markets (address + ZIP).

import { createServiceClient } from "@/lib/supabase/server";

export interface SearchResult {
  slug: string;
  address: string;
  city: string;
  zip: string;
}

export async function searchMarkets(q: string, limit = 8): Promise<SearchResult[]> {
  const term = q.trim();
  if (term.length === 0) return [];
  const supabase = createServiceClient();
  const escaped = term.replace(/[%_]/g, "\\$&");

  const { data, error } = await supabase
    .from("markets")
    .select(`slug, properties!inner ( address, city, zip )`)
    .eq("state", "open")
    .or(`address.ilike.%${escaped}%,zip.ilike.%${escaped}%`, { referencedTable: "properties" })
    .limit(limit);

  if (error) throw error;

  type Row = {
    slug: string;
    properties: { address: string; city: string; zip: string } | null;
  };
  return ((data ?? []) as unknown as Row[])
    .map((r) =>
      r.properties
        ? {
            slug: r.slug,
            address: r.properties.address,
            city: r.properties.city,
            zip: r.properties.zip,
          }
        : null,
    )
    .filter((x): x is SearchResult => x !== null);
}
