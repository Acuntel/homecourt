import type { Metadata } from "next";
import Link from "next/link";
import { Building2, Clock, Compass, Flame, Home, MapPin, TrendingUp } from "lucide-react";

import { SearchBar } from "@/components/nav/search-bar";

export const metadata: Metadata = {
  title: "Search",
  description: "Search HOMECOURT — find a house by address, ZIP, or neighborhood.",
};

const TOPICS = [
  { label: "Central", icon: Compass, href: "/markets?category=central" },
  { label: "East", icon: MapPin, href: "/markets?category=east" },
  { label: "North", icon: Building2, href: "/markets?category=north" },
  { label: "South", icon: Home, href: "/markets?category=south" },
  { label: "West", icon: MapPin, href: "/markets?category=west" },
  { label: "Closing soon", icon: Clock, href: "/markets?sort=closing" },
  { label: "Trending", icon: TrendingUp, href: "/markets?sort=trending" },
  { label: "Volatile", icon: Flame, href: "/markets?sort=volatile" },
] as const;

export default function SearchPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col gap-6">
      <SearchBar />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Topics</h2>
        <div className="grid grid-cols-2 gap-3">
          {TOPICS.map((t) => {
            const Icon = t.icon;
            return (
              <Link
                key={t.label}
                href={t.href}
                className="border-border bg-card hover:border-court-500/40 focus-visible:ring-court-500/60 flex items-center gap-2.5 rounded-xl border px-4 py-3.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2"
              >
                <Icon className="text-muted-fg h-4 w-4" aria-hidden />
                {t.label}
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
