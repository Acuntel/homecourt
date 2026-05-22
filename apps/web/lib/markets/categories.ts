// HOMECOURT — Austin ZIP → geographic category mapping for the feed's
// CategoryNav strip. Numbers come from BUILD.md §23 M4.

import type { MarketCategoryKey } from "@homecourt/shared";

export const CATEGORY_LABELS: Record<MarketCategoryKey, string> = {
  all: "All",
  central: "Austin Central",
  east: "East Austin",
  north: "North",
  south: "South",
  west: "West",
  closing: "Closing Soon",
  new: "New",
  volatile: "Volatile",
};

export const CATEGORY_ORDER: MarketCategoryKey[] = [
  "all",
  "central",
  "east",
  "north",
  "south",
  "west",
  "closing",
  "new",
  "volatile",
];

/** ZIPs in each geographic Austin band. */
export const CATEGORY_ZIPS: Record<"central" | "east" | "north" | "south" | "west", string[]> = {
  central: ["78701", "78704"],
  east: ["78702", "78751"],
  north: ["78757", "78758", "78759"],
  south: ["78745"],
  west: ["73301"],
};

const GEOGRAPHIC_CATEGORIES = new Set<MarketCategoryKey>([
  "central",
  "east",
  "north",
  "south",
  "west",
]);

/** Returns ZIPs for a geographic category — undefined for non-geo categories. */
export function zipsForCategory(category: MarketCategoryKey): string[] | undefined {
  if (!GEOGRAPHIC_CATEGORIES.has(category)) return undefined;
  return CATEGORY_ZIPS[category as keyof typeof CATEGORY_ZIPS];
}

export function isValidCategory(value: string): value is MarketCategoryKey {
  return CATEGORY_ORDER.includes(value as MarketCategoryKey);
}

/** Map a property's ZIP back to its display category (best effort). */
export function categoryForZip(zip: string): MarketCategoryKey {
  for (const [cat, zips] of Object.entries(CATEGORY_ZIPS)) {
    if (zips.includes(zip)) return cat as MarketCategoryKey;
  }
  return "all";
}
