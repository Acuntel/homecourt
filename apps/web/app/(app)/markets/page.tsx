import type { Metadata } from "next";

import { createClient } from "@/lib/supabase/server";
import { CategoryNav } from "@/components/markets/category-nav";
import { FeaturedRail } from "@/components/markets/featured-rail";
import { FiltersBar } from "@/components/markets/filters-bar";
import { MarketsFeed } from "@/components/markets/markets-feed";
import { WelcomeToast } from "@/components/markets/welcome-toast";
import { isValidCategory } from "@/lib/markets/categories";
import { loadMarketsFeed } from "@/lib/markets/feed";
import type { MarketCategoryKey, MarketSortKey } from "@homecourt/shared";

export const metadata: Metadata = {
  title: "Markets",
  description:
    "Browse HOMECOURT markets — real Deerfield IL homes. Call YES or NO on whether each sells above its list price.",
};

const SORT_KEYS: MarketSortKey[] = ["new", "trending", "closing", "volatile"];

type SearchParams = {
  welcome?: string;
  category?: string;
  sort?: string;
  q?: string;
  zip?: string;
  beds?: string;
  minPrice?: string;
  maxPrice?: string;
};

type MarketsPageProps = {
  searchParams: Promise<SearchParams>;
};

function asInt(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : undefined;
}

export default async function MarketsPage({ searchParams }: MarketsPageProps) {
  const params = await searchParams;
  const showWelcome = params.welcome === "1";

  const category: MarketCategoryKey =
    params.category && isValidCategory(params.category) ? params.category : "all";
  const sort: MarketSortKey =
    params.sort && (SORT_KEYS as string[]).includes(params.sort)
      ? (params.sort as MarketSortKey)
      : "new";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const beds = asInt(params.beds);
  const minPriceCents = asInt(params.minPrice);
  const maxPriceCents = asInt(params.maxPrice);

  const initialFeed = await loadMarketsFeed({
    userId: user?.id ?? null,
    category,
    sort,
    q: params.q,
    zip: params.zip,
    beds,
    minPriceCents,
    maxPriceCents,
  });

  // Featured set = sort by closing soon, prioritize markets that have at least
  // some 24h volume so the rail doesn't surface dead listings.
  const featured = [...initialFeed.items]
    .filter((m) => m.openInterest > 0 || m.volume24hCents > 0 || m.sparkline.length > 0)
    .slice(0, 6);
  const showFeatured =
    !params.q &&
    !params.zip &&
    !params.beds &&
    !params.minPrice &&
    !params.maxPrice &&
    (category === "all" || !params.category);

  return (
    <div className="flex flex-col gap-6">
      {showWelcome ? <WelcomeToast /> : null}

      <header className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Deerfield, IL</h1>
        <p className="text-muted-fg text-sm">
          Will it sell above list? Call YES or NO on real homes. Phase 0 sweepstakes — no real
          money.
        </p>
      </header>

      {showFeatured && featured.length > 0 ? <FeaturedRail markets={featured} /> : null}

      <div className="flex flex-col gap-3">
        <header className="flex items-baseline justify-between gap-3">
          <h2 className="text-foreground text-sm font-semibold tracking-tight">Browse all</h2>
          <span className="text-muted-fg text-[11px]">
            {initialFeed.items.length} loaded · scroll to load more
          </span>
        </header>
        <CategoryNav active={category} />
        <FiltersBar />

        <MarketsFeed
          initialData={initialFeed}
          category={category}
          sort={sort}
          q={params.q}
          zip={params.zip}
          beds={beds}
          minPriceCents={minPriceCents}
          maxPriceCents={maxPriceCents}
        />
      </div>
    </div>
  );
}
