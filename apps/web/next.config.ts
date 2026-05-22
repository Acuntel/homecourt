import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      // Real listing photos from Redfin's public CDN (used by the Deerfield
      // scrape script — see apps/web/scripts/scrape-deerfield.ts).
      { protocol: "https", hostname: "ssl.cdn-redfin.com" },
      { protocol: "https", hostname: "photos.redfin.com" },
    ],
  },
  experimental: {
    typedRoutes: false,
  },
};

export default nextConfig;
