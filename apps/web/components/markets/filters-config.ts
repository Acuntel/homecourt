// Shared constants/types for the markets feed FiltersBar + its mobile sheet.

import type { MarketSortKey } from "@homecourt/shared";

export const MIN_PRICE_DOLLARS = 0;
export const MAX_PRICE_DOLLARS = 3_000_000;
export const PRICE_STEP_DOLLARS = 25_000;

export const SORT_OPTIONS: ReadonlyArray<{ key: MarketSortKey; label: string }> = [
  { key: "new", label: "New" },
  { key: "trending", label: "Trending" },
  { key: "closing", label: "Closing Soon" },
  { key: "volatile", label: "Volatile" },
];

export const BEDS_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "", label: "Any beds" },
  { value: "2", label: "2+" },
  { value: "3", label: "3+" },
  { value: "4", label: "4+" },
  { value: "5", label: "5+" },
];

export function dollarFormat(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `$${Math.round(n / 1000)}K`;
  return `$${n}`;
}
