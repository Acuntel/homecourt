import type { Metadata } from "next";
import Link from "next/link";
import { Users } from "lucide-react";

export const metadata: Metadata = {
  title: "Social",
  description: "Trader posts and positions on HOMECOURT.",
};

const TABS = [
  { key: "feed", label: "Feed" },
  { key: "following", label: "Following" },
  { key: "leaderboard", label: "Leaderboard" },
] as const;

// Honest empty state: there are no real users posting yet, so we show nothing
// fabricated. Posts will appear here once real traders share positions.
export default function SocialPage() {
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

      <div className="flex flex-col items-center gap-3 py-20 text-center">
        <span className="bg-muted/60 text-muted-fg flex h-14 w-14 items-center justify-center rounded-full">
          <Users className="h-6 w-6" aria-hidden />
        </span>
        <p className="text-foreground text-sm font-semibold">No posts yet</p>
        <p className="text-muted-fg max-w-xs text-xs">
          When traders share their YES/NO calls on Deerfield homes, they&apos;ll show up here.
        </p>
        <Link
          href="/markets"
          className="bg-court-500 text-ink-950 hover:bg-court-400 mt-2 rounded-full px-4 py-2 text-xs font-semibold transition"
        >
          Browse markets
        </Link>
      </div>
    </div>
  );
}
