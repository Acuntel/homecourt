"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import type { MarketSearchHit } from "@homecourt/shared";

interface SearchResponse {
  items: MarketSearchHit[];
}

async function fetchSearch(q: string): Promise<MarketSearchHit[]> {
  if (q.trim().length === 0) return [];
  const res = await fetch(`/api/markets/search?q=${encodeURIComponent(q)}`, {
    credentials: "include",
  });
  if (!res.ok) return [];
  const data = (await res.json()) as SearchResponse;
  return data.items ?? [];
}

function useDebounced<T>(value: T, ms = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

export function SearchBar() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const debounced = useDebounced(query, 250);

  // Cmd+K / Ctrl+K shortcut.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isShortcut = (e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey);
      if (isShortcut) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const searchQuery = useQuery({
    queryKey: ["market-search", debounced],
    queryFn: () => fetchSearch(debounced),
    enabled: open && debounced.trim().length > 0,
    staleTime: 60_000,
  });

  const items = useMemo(() => searchQuery.data ?? [], [searchQuery.data]);

  const handleSelect = useCallback(
    (slug: string) => {
      setOpen(false);
      setQuery("");
      router.push(`/markets/${slug}`);
    },
    [router],
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open search"
        className={cn(
          "border-border/60 bg-ink-700/40 text-muted-fg hover:bg-ink-700/70 focus-visible:ring-court-500 inline-flex h-9 w-full max-w-md items-center gap-2 rounded-md border px-3 text-sm transition focus-visible:outline-none focus-visible:ring-2",
        )}
      >
        <Search className="h-4 w-4" aria-hidden />
        <span className="flex-1 truncate text-left">Search address, ZIP, or market…</span>
        <kbd className="border-border/60 text-muted-fg hidden rounded border px-1.5 py-0.5 font-mono text-[10px] sm:inline-block">
          ⌘K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Search address, ZIP, or market…"
          value={query}
          onValueChange={setQuery}
          aria-label="Search markets"
        />
        <CommandList>
          {debounced.trim().length === 0 ? (
            <CommandEmpty>Start typing to search markets.</CommandEmpty>
          ) : searchQuery.isFetching && items.length === 0 ? (
            <CommandEmpty>Searching…</CommandEmpty>
          ) : items.length === 0 ? (
            <CommandEmpty>
              No matches for &ldquo;{debounced}&rdquo;. Try an address or ZIP.
            </CommandEmpty>
          ) : (
            <CommandGroup heading="Markets">
              {items.map((hit) => (
                <CommandItem
                  key={hit.slug}
                  value={`${hit.address} ${hit.zip}`}
                  onSelect={() => handleSelect(hit.slug)}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="truncate">{hit.address}</span>
                  <span className="text-muted-fg text-xs">
                    {hit.city}, IL {hit.zip}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
