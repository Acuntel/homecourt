import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://homecourt.markets";
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/markets"],
        disallow: ["/portfolio", "/activity", "/watchlist", "/settings", "/api/", "/auth/"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
