"use client";

import { Filter, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  BEDS_OPTIONS,
  MAX_PRICE_DOLLARS,
  MIN_PRICE_DOLLARS,
  PRICE_STEP_DOLLARS,
  SORT_OPTIONS,
  dollarFormat,
} from "@/components/markets/filters-config";
import type { MarketSortKey } from "@homecourt/shared";

interface FiltersSheetProps {
  currentSort: MarketSortKey;
  currentBeds: string;
  filtersActive: boolean;
  zipInput: string;
  priceRange: [number, number];
  setZipInput: (v: string) => void;
  setPriceRange: (range: [number, number]) => void;
  setSort: (sort: MarketSortKey) => void;
  setBeds: (beds: string) => void;
  submitZip: (event?: React.FormEvent<HTMLFormElement>) => void;
  commitPriceRange: (range: [number, number]) => void;
  clearFilters: () => void;
}

export function FiltersSheet(props: FiltersSheetProps) {
  const {
    currentSort,
    currentBeds,
    filtersActive,
    zipInput,
    priceRange,
    setZipInput,
    setPriceRange,
    setSort,
    setBeds,
    submitZip,
    commitPriceRange,
    clearFilters,
  } = props;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1">
          <Filter className="h-4 w-4" aria-hidden /> Filters
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex flex-col gap-4 overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Filters</SheetTitle>
          <SheetDescription>Refine the markets feed.</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-2">
          <Label className="text-xs">Sort</Label>
          <div className="flex flex-wrap gap-2">
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setSort(opt.key)}
                className={cn(
                  "focus-visible:ring-court-500 rounded-full border px-3 py-1 text-xs transition focus-visible:outline-none focus-visible:ring-2",
                  currentSort === opt.key
                    ? "border-court-500 bg-court-500 text-ink-950"
                    : "border-border text-muted-fg hover:text-foreground",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label className="text-xs">Beds</Label>
          <div className="flex flex-wrap gap-2">
            {BEDS_OPTIONS.map((opt) => (
              <button
                key={opt.value || "any"}
                type="button"
                onClick={() => setBeds(opt.value)}
                className={cn(
                  "focus-visible:ring-court-500 rounded-full border px-3 py-1 text-xs transition focus-visible:outline-none focus-visible:ring-2",
                  currentBeds === opt.value
                    ? "border-court-500 bg-court-500 text-ink-950"
                    : "border-border text-muted-fg hover:text-foreground",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
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

        <form onSubmit={submitZip} className="flex flex-col gap-2">
          <Label htmlFor="zip-mobile" className="text-xs">
            ZIP
          </Label>
          <div className="flex gap-2">
            <Input
              id="zip-mobile"
              value={zipInput}
              onChange={(e) => setZipInput(e.target.value)}
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={5}
              placeholder="ZIP"
              className="h-9"
            />
            <Button type="submit" variant="outline" size="sm">
              Apply
            </Button>
          </div>
        </form>

        {filtersActive ? (
          <Button variant="outline" size="sm" onClick={clearFilters} className="gap-1">
            <X className="h-3 w-3" aria-hidden /> Clear all filters
          </Button>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
