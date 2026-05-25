import type { Metadata } from "next";

import { createClient } from "@/lib/supabase/server";
import { MarketsFeed } from "@/components/markets/markets-feed";
import { loadMarketsFeed } from "@/lib/markets/feed";

export const metadata: Metadata = {
  title: "Live",
  description: "Markets closing soon — the houses settling next on HOMECOURT.",
};

export default async function LivePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const initialFeed = await loadMarketsFeed({
    userId: user?.id ?? null,
    category: "all",
    sort: "closing",
  });

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center gap-2">
        <span
          className="bg-no-500 inline-block h-2.5 w-2.5 animate-pulse rounded-full"
          aria-hidden
        />
        <h1 className="text-2xl font-semibold tracking-tight">Happening now</h1>
      </header>
      <p className="text-muted-fg -mt-3 text-sm">
        Houses closing soonest. Trade before they settle.
      </p>

      <MarketsFeed initialData={initialFeed} category="all" sort="closing" />
    </div>
  );
}
