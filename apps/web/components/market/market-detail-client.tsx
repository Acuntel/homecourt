"use client";

// HOMECOURT — client wrapper that owns the selected-bucket state for the detail
// page. All components that change when the active outcome changes are
// rendered here.

import { useMemo, useState } from "react";

import { MarketPriceBlock } from "@/components/market/market-price-block";
import { MultiOutcomeTable } from "@/components/market/multi-outcome-table";
import { OrderBookL2 } from "@/components/market/order-book-l2";
import { PriceChart } from "@/components/market/price-chart";
import { RecentTradesTable } from "@/components/market/recent-trades-table";
import { HoldersLeaderboard } from "@/components/market/holders-leaderboard";
import { TradePanel } from "@/components/trade/trade-panel";
import type { MarketCandlesticksResponse, MarketDetail } from "@homecourt/shared";

interface MarketDetailClientProps {
  detail: MarketDetail;
  initialCandles: MarketCandlesticksResponse;
}

export function MarketDetailClient({ detail, initialCandles }: MarketDetailClientProps) {
  const [selectedIdx, setSelectedIdx] = useState<number>(detail.anchorBucketIdx);

  const selectedBucket = useMemo(
    () =>
      detail.bucketsWithPrice.find((b) => b.idx === selectedIdx) ??
      detail.bucketsWithPrice[detail.anchorBucketIdx] ??
      detail.bucketsWithPrice[0]!,
    [detail.bucketsWithPrice, detail.anchorBucketIdx, selectedIdx],
  );

  const selectedBook = useMemo(
    () =>
      detail.initialBook.find((b) => b.outcomeIdx === selectedIdx) ?? {
        outcomeIdx: selectedIdx,
        seq: 0,
        bids: [],
        asks: [],
      },
    [detail.initialBook, selectedIdx],
  );

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="flex flex-col gap-5">
        <MarketPriceBlock
          bucket={selectedBucket}
          volume24hCents={detail.volume24hCents}
          openInterest={detail.openInterest}
        />
        <PriceChart
          slug={detail.slug}
          outcomeIdx={selectedIdx}
          initial={initialCandles}
          fallbackPriceCents={selectedBucket.yesPriceCents}
        />
        <MultiOutcomeTable
          buckets={detail.bucketsWithPrice}
          selectedIdx={selectedIdx}
          onSelect={setSelectedIdx}
        />
        <OrderBookL2
          outcomeIdx={selectedIdx}
          bids={selectedBook.bids}
          asks={selectedBook.asks}
          seq={selectedBook.seq}
        />
        <RecentTradesTable fills={detail.recentFills} outcomeIdx={selectedIdx} />
        <HoldersLeaderboard
          holders={detail.topHolders}
          selectedOutcomeIdx={selectedIdx}
          bucketsWithPrice={detail.bucketsWithPrice}
        />
      </div>

      <div className="flex flex-col gap-4 lg:sticky lg:top-20 lg:self-start">
        <TradePanel detail={detail} bucket={selectedBucket} book={selectedBook} />
      </div>
    </div>
  );
}
