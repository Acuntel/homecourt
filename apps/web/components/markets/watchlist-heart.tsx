"use client";

import { useState, useTransition } from "react";
import { Heart } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";

interface WatchlistHeartProps {
  slug: string;
  initialWatching: boolean;
  /** Optional callback for parent caches (e.g. react-query). */
  onChange?: (watching: boolean) => void;
}

export function WatchlistHeart({ slug, initialWatching, onChange }: WatchlistHeartProps) {
  const [watching, setWatching] = useState(initialWatching);
  const [isPending, startTransition] = useTransition();

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const next = !watching;
    // Optimistic toggle.
    setWatching(next);
    onChange?.(next);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/watchlist/${encodeURIComponent(slug)}`, {
          method: next ? "POST" : "DELETE",
          credentials: "include",
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        if (next) {
          toast.success("Added to watchlist.");
        } else {
          toast.message("Removed from watchlist.");
        }
      } catch {
        // Roll back on failure.
        setWatching((prev) => !prev);
        onChange?.(!next);
        toast.error("Couldn't update watchlist. Try again.");
      }
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={watching}
      aria-label={watching ? "Remove from watchlist" : "Add to watchlist"}
      disabled={isPending}
      className={cn(
        "focus-visible:ring-court-500 inline-flex h-7 w-7 items-center justify-center rounded-full border transition focus-visible:outline-none focus-visible:ring-2",
        watching
          ? "border-court-500/40 bg-court-500/10 text-court-500"
          : "border-border text-muted-fg hover:border-court-500/40 hover:text-court-500",
      )}
    >
      <Heart className={cn("h-3.5 w-3.5", watching ? "fill-current" : "")} aria-hidden />
    </button>
  );
}
