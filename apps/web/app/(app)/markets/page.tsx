import type { Metadata } from "next";

import { createClient } from "@/lib/supabase/server";
import { CategoryNav } from "@/components/markets/category-nav";
import { FiltersBar } from "@/components/markets/filters-bar";
import { MarketsFeed } from "@/components/markets/markets-feed";
import { WelcomeToast } from "@/components/markets/welcome-toast";
import { isValidCategory } from "@/lib/markets/categories";
import { loadMarketsFeed } from "@/lib/markets/feed";
import type { MarketCategoryKey, MarketSortKey } from "@homecourt/shared";

export const metadata: Metadata = {
  title: "Markets",
  description: "Browse HOMECOURT markets — single-family homes, five-bucket binary contracts.",
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

  return (
    <div className="flex flex-col gap-5">
      {showWelcome ? <WelcomeToast /> : null}

      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Markets</h1>
        <p className="text-muted-fg text-sm">
          Browse single-family homes across Austin. Tap any card to see its five-bucket order book.
        </p>
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
  );
}
