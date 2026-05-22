import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CommentsThread } from "@/components/market/comments-thread";
import { CompsPanel } from "@/components/market/comps-panel";
import { MarketDetailClient } from "@/components/market/market-detail-client";
import { MarketDetailHeader } from "@/components/market/market-detail-header";
import { PhotoGallery } from "@/components/market/photo-gallery";
import { RelatedMarketsCarousel } from "@/components/market/related-markets-carousel";
import { ResolutionCard } from "@/components/market/resolution-card";
import { loadCandlesticks } from "@/lib/markets/candlesticks";
import { loadMarketDetail } from "@/lib/markets/detail";
import { loadMarketsFeed } from "@/lib/markets/feed";
import { createClient } from "@/lib/supabase/server";
import { formatUsdCents } from "@/lib/format";
import type { MarketDetail } from "@homecourt/shared";

interface MarketDetailPageProps {
  params: Promise<{ slug: string }>;
}

async function getCurrentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function generateMetadata({ params }: MarketDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const userId = await getCurrentUserId();
  const detail = await loadMarketDetail(slug, userId);
  if (!detail) {
    return { title: "Market not found — HOMECOURT" };
  }
  const title = `${detail.address} — HOMECOURT`;
  const description = `Trade where ${detail.address} (${detail.city}, ${detail.zip}) will close. ${detail.beds} bd · ${detail.sqft.toLocaleString("en-US")} sf · Zestimate ${formatUsdCents(detail.zestimateCents)}.`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      ...(detail.photoUrl ? { images: [{ url: detail.photoUrl }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(detail.photoUrl ? { images: [detail.photoUrl] } : {}),
    },
  };
}

function buildJsonLd(detail: MarketDetail): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    name: detail.address,
    description: `5-bucket binary range market on the close price of ${detail.address}.`,
    address: {
      "@type": "PostalAddress",
      streetAddress: detail.address,
      addressLocality: detail.city,
      postalCode: detail.zip,
      addressCountry: "US",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: detail.geoLat,
      longitude: detail.geoLng,
    },
    numberOfRooms: detail.beds,
    floorSize: {
      "@type": "QuantitativeValue",
      value: detail.sqft,
      unitCode: "FTK",
    },
    image: detail.photos,
    datePosted: detail.listDate,
    expires: detail.closesAt,
  };
}

export default async function MarketDetailPage({ params }: MarketDetailPageProps) {
  const { slug } = await params;
  const userId = await getCurrentUserId();
  const detail = await loadMarketDetail(slug, userId);

  if (!detail) {
    notFound();
  }

  const anchorBucket =
    detail.bucketsWithPrice.find((b) => b.idx === detail.anchorBucketIdx) ??
    detail.bucketsWithPrice[0];
  const fallbackPriceCents = anchorBucket?.yesPriceCents ?? 50;

  const [candles, related] = await Promise.all([
    loadCandlesticks(detail.marketId, detail.anchorBucketIdx, "1D", fallbackPriceCents),
    loadMarketsFeed({
      userId,
      zip: detail.zip,
      pageSize: 8,
    }),
  ]);

  // Exclude the current market from the related rail.
  const relatedItems = related.items
    .filter((m: { slug: string }) => m.slug !== detail.slug)
    .slice(0, 6);

  const jsonLd = buildJsonLd(detail);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="flex flex-col gap-6">
        <MarketDetailHeader
          slug={detail.slug}
          address={detail.address}
          city={detail.city}
          state="TX"
          zip={detail.zip}
          closesAt={detail.closesAt}
          watching={detail.watching}
        />

        <PhotoGallery photos={detail.photos} alt={detail.address} />

        <MarketDetailClient detail={detail} initialCandles={candles} />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="flex flex-col gap-5">
            <CompsPanel comps={detail.comps} />
            <CommentsThread
              marketId={detail.marketId}
              comments={detail.comments}
              totalCount={detail.commentsCount}
              viewerId={userId}
            />
            <RelatedMarketsCarousel markets={relatedItems} />
          </div>
          <div className="flex flex-col gap-4 lg:sticky lg:top-20 lg:self-start">
            <ResolutionCard
              state={detail.marketState === "settled" ? "resolved" : "pending"}
              closesAt={detail.closesAt}
              finalPriceCents={detail.finalPriceCents}
              finalBucketLabel={
                detail.finalBucket !== null
                  ? (detail.buckets[detail.finalBucket]?.label ?? null)
                  : null
              }
            />
          </div>
        </div>
      </div>
    </>
  );
}
