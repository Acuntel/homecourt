import type { Metadata } from "next";
import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { SocialFeedCard } from "@/components/social/social-feed-card";
import { loadMarketsFeed } from "@/lib/markets/feed";

export const metadata: Metadata = {
  title: "Social",
  description: "What HOMECOURT traders are watching and trading right now.",
};

const TABS = [
  { key: "feed", label: "Feed" },
  { key: "following", label: "Following" },
  { key: "leaderboard", label: "Leaderboard" },
] as const;

export default async function SocialPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const feed = await loadMarketsFeed({
    userId: user?.id ?? null,
    category: "all",
    sort: "trending",
  });

  return (
    <div className="mx-auto flex max-w-md flex-col gap-5">
      <nav className="flex items-center gap-5 text-sm font-semibold">
        {TABS.map((t, i) => (
          <span
            key={t.key}
            className={i === 0 ? "text-foreground" : "text-muted-fg cursor-default"}
          >
            {t.label}
          </span>
        ))}
      </nav>

      <div className="flex flex-col gap-4">
        {feed.items.slice(0, 12).map((m) => (
          <SocialFeedCard key={m.slug} market={m} />
        ))}
        {feed.items.length === 0 ? (
          <p className="text-muted-fg py-12 text-center text-sm">
            Nothing trending yet.{" "}
            <Link href="/markets" className="text-court-500 hover:underline">
              Browse markets
            </Link>
            .
          </p>
        ) : null}
      </div>
    </div>
  );
}
