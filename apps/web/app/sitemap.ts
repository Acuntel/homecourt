import type { MetadataRoute } from "next";

import { createServiceClient } from "@/lib/supabase/server";
import { log } from "@/lib/log";

export const revalidate = 3600; // 1 hour

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://homecourt.markets";
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${baseUrl}/markets`, lastModified: now, changeFrequency: "hourly", priority: 0.9 },
  ];

  try {
    const db = createServiceClient();
    const { data } = await db
      .from("markets")
      .select("slug, created_at")
      .eq("state", "open")
      .order("created_at", { ascending: false })
      .limit(1000);

    const marketEntries: MetadataRoute.Sitemap = (data ?? []).map(
      (row: { slug: string; created_at: string }) => ({
        url: `${baseUrl}/markets/${row.slug}`,
        lastModified: new Date(row.created_at),
        changeFrequency: "daily" as const,
        priority: 0.7,
      }),
    );

    return [...staticEntries, ...marketEntries];
  } catch (err) {
    log.warn({ err: String(err) }, "sitemap build failed; returning static only");
    return staticEntries;
  }
}
