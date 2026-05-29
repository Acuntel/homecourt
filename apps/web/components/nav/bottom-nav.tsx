"use client";

// HOMECOURT — Kalshi-style bottom tab bar.
// Explore · Live · Portfolio · Search · Social. Fixed to the viewport bottom,
// centered to the app column on wide screens. Active tab tints court-green.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Radio, Search, Users, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface Tab {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Extra path prefixes that should also light this tab. */
  match?: string[];
}

const TABS: Tab[] = [
  { href: "/markets", label: "Explore", icon: Compass, match: ["/explore", "/markets"] },
  { href: "/live", label: "Live", icon: Radio },
  { href: "/portfolio", label: "Portfolio", icon: Wallet, match: ["/watchlist", "/activity"] },
  { href: "/search", label: "Search", icon: Search },
  { href: "/social", label: "Social", icon: Users },
];

export function BottomNav({ cashCents }: { cashCents?: number }) {
  const pathname = usePathname();

  function isActive(tab: Tab): boolean {
    const prefixes = tab.match ?? [tab.href];
    return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  }

  return (
    <nav
      aria-label="Primary"
      className="border-border/60 bg-ink-950/95 fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur-md"
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-between px-2">
        {TABS.map((tab) => {
          const active = isActive(tab);
          const Icon = tab.icon;
          const isPortfolio = tab.href === "/portfolio";
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "focus-visible:ring-court-500/60 flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2",
                  active ? "text-court-500" : "text-muted-fg hover:text-foreground",
                )}
              >
                <Icon className="h-5 w-5" aria-hidden />
                <span>
                  {isPortfolio && cashCents != null
                    ? `$${Math.round(cashCents / 100).toLocaleString("en-US")}`
                    : tab.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
