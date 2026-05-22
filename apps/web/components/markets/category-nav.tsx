"use client";

import { useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

import { CATEGORY_LABELS, CATEGORY_ORDER } from "@/lib/markets/categories";
import { cn } from "@/lib/utils";
import type { MarketCategoryKey } from "@homecourt/shared";

interface CategoryNavProps {
  active: MarketCategoryKey;
}

export function CategoryNav({ active }: CategoryNavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleClick = useCallback(
    (category: MarketCategoryKey) => {
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      params.delete("cursor");
      if (category === "all") {
        params.delete("category");
      } else {
        params.set("category", category);
      }
      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname);
    },
    [router, pathname, searchParams],
  );

  return (
    <nav
      aria-label="Market categories"
      className="border-border/60 -mx-4 flex items-center gap-2 overflow-x-auto border-b px-4 py-2 sm:mx-0 sm:px-0"
      role="tablist"
    >
      {CATEGORY_ORDER.map((key) => {
        const isActive = active === key;
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => handleClick(key)}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2",
              "focus-visible:ring-court-500",
              isActive
                ? "bg-court-500 text-ink-950"
                : "text-muted-fg bg-ink-700/40 hover:bg-ink-600/60 hover:text-foreground",
            )}
          >
            {CATEGORY_LABELS[key]}
          </button>
        );
      })}
    </nav>
  );
}
