import type { Metadata } from "next";

import { createClient } from "@/lib/supabase/server";
import { MarketCard } from "@/components/markets/market-card";
import { loadMarketsFeed } from "@/lib/markets/feed";

export const metadata: Metadata = {
  title: "Watchlist",
  description: "Markets you're watching on HOMECOURT.",
};

export default async function WatchlistPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const feed = await loadMarketsFeed({
    userId: user?.id ?? null,
    watchedOnly: true,
    pageSize: 60,
  });

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Watchlist</h1>
        <p className="text-muted-fg text-sm">
          Markets you&apos;ve hearted. Tap the heart on any card to remove it.
        </p>
      </header>

      {feed.items.length === 0 ? (
        <div
          role="status"
          className="border-border bg-card text-muted-fg flex flex-col gap-1 rounded-md border p-8 text-center text-sm"
        >
          <p className="text-foreground font-medium">Nothing watched yet.</p>
          <p>Tap the heart on any market to follow it.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {feed.items.map((market) => (
            <MarketCard key={market.slug} market={market} />
          ))}
        </div>
      )}
    </div>
  );
}
