"use client";

import { useEffect, useMemo, useRef } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";

import { MarketCard } from "@/components/markets/market-card";
import { MarketCardSkeletonGrid } from "@/components/markets/market-card-skeleton";
import type {
  MarketCategoryKey,
  MarketSortKey,
  MarketSummary,
  MarketsFeedResponse,
} from "@homecourt/shared";

interface MarketsFeedProps {
  initialData: MarketsFeedResponse;
  category: MarketCategoryKey;
  sort: MarketSortKey;
  q?: string | undefined;
  zip?: string | undefined;
  beds?: number | undefined;
  minPriceCents?: number | undefined;
  maxPriceCents?: number | undefined;
}

interface FeedQueryKeyParts {
  category: MarketCategoryKey;
  sort: MarketSortKey;
  q?: string | undefined;
  zip?: string | undefined;
  beds?: number | undefined;
  minPriceCents?: number | undefined;
  maxPriceCents?: number | undefined;
}

function buildFetchUrl(key: FeedQueryKeyParts, cursor: string | null): string {
  const params = new URLSearchParams();
  if (key.category && key.category !== "all") params.set("category", key.category);
  if (key.sort && key.sort !== "new") params.set("sort", key.sort);
  if (key.q) params.set("q", key.q);
  if (key.zip) params.set("zip", key.zip);
  if (key.beds) params.set("beds", String(key.beds));
  if (key.minPriceCents) params.set("minPrice", String(key.minPriceCents));
  if (key.maxPriceCents) params.set("maxPrice", String(key.maxPriceCents));
  if (cursor) params.set("cursor", cursor);
  return `/api/markets?${params.toString()}`;
}

async function fetchPage(url: string): Promise<MarketsFeedResponse> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error(`feed_failed_${res.status}`);
  return (await res.json()) as MarketsFeedResponse;
}

export function MarketsFeed({
  initialData,
  category,
  sort,
  q,
  zip,
  beds,
  minPriceCents,
  maxPriceCents,
}: MarketsFeedProps) {
  const keyParts = useMemo<FeedQueryKeyParts>(
    () => ({ category, sort, q, zip, beds, minPriceCents, maxPriceCents }),
    [category, sort, q, zip, beds, minPriceCents, maxPriceCents],
  );

  const query = useInfiniteQuery({
    queryKey: ["markets-feed", keyParts],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => fetchPage(buildFetchUrl(keyParts, pageParam ?? null)),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialData: { pages: [initialData], pageParams: [null] },
    staleTime: 30_000,
  });

  const items: MarketSummary[] = useMemo(
    () => (query.data?.pages ?? []).flatMap((p) => p.items),
    [query.data],
  );

  // Intersection observer for infinite scroll.
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting && query.hasNextPage && !query.isFetchingNextPage) {
          void query.fetchNextPage();
        }
      },
      { rootMargin: "200px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [query]);

  if (query.isLoading && items.length === 0) {
    return <MarketCardSkeletonGrid count={6} />;
  }

  if (items.length === 0) {
    return (
      <div
        role="status"
        className="border-border bg-card text-muted-fg flex flex-col gap-1 rounded-md border p-8 text-center text-sm"
      >
        <p className="text-foreground font-medium">No markets match those filters.</p>
        <p>Try widening your search.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((market) => (
          <MarketCard key={market.slug} market={market} />
        ))}
      </div>

      <div ref={sentinelRef} aria-hidden className="h-10" />

      {query.isFetchingNextPage ? (
        <div className="text-muted-fg text-center text-xs">Loading more markets…</div>
      ) : null}

      {!query.hasNextPage && items.length > 0 ? (
        <div className="text-muted-fg text-center text-xs">End of feed.</div>
      ) : null}
    </div>
  );
}
