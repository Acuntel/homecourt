"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { FiltersSheet } from "@/components/markets/filters-sheet";
import {
  BEDS_OPTIONS,
  MAX_PRICE_DOLLARS,
  MIN_PRICE_DOLLARS,
  PRICE_STEP_DOLLARS,
  SORT_OPTIONS,
  dollarFormat,
} from "@/components/markets/filters-config";
import type { MarketSortKey } from "@homecourt/shared";

export function FiltersBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentSort = (searchParams?.get("sort") as MarketSortKey | null) ?? "new";
  const currentZip = searchParams?.get("zip") ?? "";
  const currentBeds = searchParams?.get("beds") ?? "";
  const currentMin = Number(searchParams?.get("minPrice") ?? "") || null;
  const currentMax = Number(searchParams?.get("maxPrice") ?? "") || null;

  const minDollars = currentMin ? Math.round(currentMin / 100) : MIN_PRICE_DOLLARS;
  const maxDollars = currentMax ? Math.round(currentMax / 100) : MAX_PRICE_DOLLARS;

  const [zipInput, setZipInput] = useState(currentZip);
  const [priceRange, setPriceRange] = useState<[number, number]>([minDollars, maxDollars]);

  useEffect(() => {
    setZipInput(currentZip);
  }, [currentZip]);

  useEffect(() => {
    setPriceRange([minDollars, maxDollars]);
  }, [minDollars, maxDollars]);

  const update = useCallback(
    (mutator: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      params.delete("cursor");
      mutator(params);
      const q = params.toString();
      router.push(q ? `${pathname}?${q}` : pathname);
    },
    [router, pathname, searchParams],
  );

  const setSort = useCallback(
    (sort: MarketSortKey) =>
      update((p) => (sort === "new" ? p.delete("sort") : p.set("sort", sort))),
    [update],
  );

  const setBeds = useCallback(
    (beds: string) =>
      update((p) => {
        if (!beds) p.delete("beds");
        else p.set("beds", beds);
      }),
    [update],
  );

  const submitZip = useCallback(
    (event?: React.FormEvent<HTMLFormElement>) => {
      event?.preventDefault();
      update((p) => {
        const trimmed = zipInput.trim();
        if (!trimmed) p.delete("zip");
        else p.set("zip", trimmed);
      });
    },
    [update, zipInput],
  );

  const commitPriceRange = useCallback(
    (range: [number, number]) => {
      update((p) => {
        const [lo, hi] = range;
        if (lo <= MIN_PRICE_DOLLARS) p.delete("minPrice");
        else p.set("minPrice", String(lo * 100));
        if (hi >= MAX_PRICE_DOLLARS) p.delete("maxPrice");
        else p.set("maxPrice", String(hi * 100));
      });
    },
    [update],
  );

  const filtersActive = useMemo(
    () =>
      Boolean(
        currentZip ||
          currentBeds ||
          currentMin ||
          currentMax ||
          (currentSort && currentSort !== "new"),
      ),
    [currentZip, currentBeds, currentMin, currentMax, currentSort],
  );

  const clearFilters = useCallback(() => {
    update((p) => {
      p.delete("sort");
      p.delete("zip");
      p.delete("beds");
      p.delete("minPrice");
      p.delete("maxPrice");
    });
  }, [update]);

  const sortLabel = SORT_OPTIONS.find((s) => s.key === currentSort)?.label ?? "New";
  const bedsLabel = BEDS_OPTIONS.find((b) => b.value === currentBeds)?.label ?? "Any beds";

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      {/* Desktop / tablet filter strip */}
      <div className="hidden flex-wrap items-center gap-2 sm:flex">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1">
              Sort: <span className="text-foreground">{sortLabel}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {SORT_OPTIONS.map((opt) => (
              <DropdownMenuItem key={opt.key} onSelect={() => setSort(opt.key)}>
                {opt.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1">
              {bedsLabel}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {BEDS_OPTIONS.map((opt) => (
              <DropdownMenuItem key={opt.value || "any"} onSelect={() => setBeds(opt.value)}>
                {opt.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1">
              {dollarFormat(priceRange[0])} – {dollarFormat(priceRange[1])}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-72 p-3">
            <div className="flex flex-col gap-3">
              <Label className="text-xs">Price band</Label>
              <Slider
                min={MIN_PRICE_DOLLARS}
                max={MAX_PRICE_DOLLARS}
                step={PRICE_STEP_DOLLARS}
                value={priceRange}
                onValueChange={(v) => setPriceRange([v[0] ?? 0, v[1] ?? MAX_PRICE_DOLLARS])}
                onValueCommit={(v) => commitPriceRange([v[0] ?? 0, v[1] ?? MAX_PRICE_DOLLARS])}
              />
              <div className="text-muted-fg flex items-center justify-between text-xs">
                <span>{dollarFormat(priceRange[0])}</span>
                <span>{dollarFormat(priceRange[1])}</span>
              </div>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <form onSubmit={submitZip} className="flex items-center gap-1">
          <Input
            value={zipInput}
            onChange={(e) => setZipInput(e.target.value)}
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={5}
            placeholder="ZIP"
            aria-label="Filter by ZIP code"
            className="h-8 w-20"
          />
          <Button type="submit" variant="outline" size="sm">
            Go
          </Button>
        </form>

        {filtersActive ? (
          <button
            type="button"
            onClick={clearFilters}
            className={cn(
              "text-muted-fg hover:text-foreground focus-visible:ring-court-500 inline-flex items-center gap-1 rounded px-2 py-1 text-xs underline-offset-2 hover:underline",
              "focus-visible:outline-none focus-visible:ring-2",
            )}
          >
            <X className="h-3 w-3" aria-hidden /> Clear filters
          </button>
        ) : null}
      </div>

      {/* Mobile sheet trigger */}
      <div className="flex sm:hidden">
        <FiltersSheet
          currentSort={currentSort}
          currentBeds={currentBeds}
          filtersActive={filtersActive}
          zipInput={zipInput}
          priceRange={priceRange}
          setZipInput={setZipInput}
          setPriceRange={setPriceRange}
          setSort={setSort}
          setBeds={setBeds}
          submitZip={submitZip}
          commitPriceRange={commitPriceRange}
          clearFilters={clearFilters}
        />
      </div>
    </div>
  );
}
