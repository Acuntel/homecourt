"use client";

import { useCallback, useMemo } from "react";
import { Share2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { WatchlistHeart } from "@/components/markets/watchlist-heart";
import { SettlementSourceBadge } from "@/components/market/settlement-source-badge";
import { formatClosesIn } from "@/lib/format";
import { cn } from "@/lib/utils";

interface MarketDetailHeaderProps {
  slug: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  closesAt: string;
  watching: boolean;
  className?: string;
}

function buildZillowUrl(address: string, city: string, state: string, zip: string): string {
  const slug = `${address} ${city} ${state} ${zip}`
    .trim()
    .replace(/[#,]/g, "")
    .replace(/\s+/g, "-");
  return `https://www.zillow.com/homes/${encodeURIComponent(slug)}_rb/`;
}

export function MarketDetailHeader({
  slug,
  address,
  city,
  state,
  zip,
  closesAt,
  watching,
  className,
}: MarketDetailHeaderProps) {
  const zillowUrl = useMemo(
    () => buildZillowUrl(address, city, state, zip),
    [address, city, state, zip],
  );

  const handleShare = useCallback(async () => {
    try {
      const url =
        typeof window !== "undefined" ? `${window.location.origin}/markets/${slug}` : slug;
      if (typeof navigator !== "undefined" && "clipboard" in navigator) {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied", { description: url });
        return;
      }
      toast.message(url);
    } catch {
      toast.error("Couldn't copy link.");
    }
  }, [slug]);

  return (
    <header className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-semibold tracking-tight">Where will {address} close?</h1>
          <div className="text-muted-fg flex flex-wrap items-center gap-2 text-xs">
            <SettlementSourceBadge />
            <span aria-hidden>·</span>
            <span>{formatClosesIn(closesAt)}</span>
            <span aria-hidden>·</span>
            <span>
              {city}, {state} {zip}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void handleShare()}
            aria-label="Copy market link"
          >
            <Share2 className="mr-2 h-3.5 w-3.5" aria-hidden />
            Share
          </Button>
          <Button asChild size="sm" variant="outline">
            <a
              href={zillowUrl}
              target="_blank"
              rel="noreferrer noopener"
              aria-label="Open this listing on Zillow"
            >
              <ExternalLink className="mr-2 h-3.5 w-3.5" aria-hidden />
              Zillow
            </a>
          </Button>
          <WatchlistHeart slug={slug} initialWatching={watching} />
        </div>
      </div>
    </header>
  );
}
