"use client";

// HOMECOURT — consumer market view. Binary YES/NO on the anchor outcome:
// price block, price chart, and the two big multiplier buttons that launch
// the numpad trade sheet. The order book, multi-outcome ladder, recent-trades
// tape and holders leaderboard (the "exchange" surface) are intentionally
// hidden — this is the Kalshi-style tap-to-trade experience.

import { MarketPriceBlock } from "@/components/market/market-price-block";
import { PriceChart } from "@/components/market/price-chart";
import { TradeButtons } from "@/components/trade/trade-buttons";
import type { MarketCandlesticksResponse, MarketDetail } from "@homecourt/shared";

interface MarketDetailClientProps {
  detail: MarketDetail;
  initialCandles: MarketCandlesticksResponse;
  availableCents?: number;
}

export function MarketDetailClient({
  detail,
  initialCandles,
  availableCents,
}: MarketDetailClientProps) {
  const anchor =
    detail.bucketsWithPrice.find((b) => b.idx === detail.anchorBucketIdx) ??
    detail.bucketsWithPrice[0]!;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="flex flex-col gap-5">
        <MarketPriceBlock
          bucket={anchor}
          volume24hCents={detail.volume24hCents}
          openInterest={detail.openInterest}
        />
        <PriceChart
          slug={detail.slug}
          outcomeIdx={anchor.idx}
          initial={initialCandles}
          fallbackPriceCents={anchor.yesPriceCents}
        />
      </div>

      <div className="flex flex-col gap-4 lg:sticky lg:top-20 lg:self-start">
        <TradeButtons
          marketSlug={detail.slug}
          outcomeIdx={anchor.idx}
          title={detail.address}
          question={anchor.label}
          yesPriceCents={anchor.yesPriceCents}
          {...(availableCents != null ? { availableCents } : {})}
        />
      </div>
    </div>
  );
}
