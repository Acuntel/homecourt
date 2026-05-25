"use client";

// HOMECOURT — consumer market view. Binary YES/NO on the anchor outcome:
// price block, price chart, and the two big multiplier buttons that launch
// the numpad trade sheet. The order book, multi-outcome ladder, recent-trades
// tape and holders leaderboard (the "exchange" surface) are intentionally
// hidden — this is the Kalshi-style tap-to-trade experience.

import { MarketPriceBlock } from "@/components/market/market-price-block";
import { PriceChart } from "@/components/market/price-chart";
import { TradeButtons } from "@/components/trade/trade-buttons";
import { formatUsdCents } from "@/lib/format";
import type { MarketCandlesticksResponse, MarketDetail, MarketModelMeta } from "@homecourt/shared";

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
        {detail.modelMeta ? <ModelLineNote meta={detail.modelMeta} /> : null}
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

function ModelLineNote({ meta }: { meta: MarketModelMeta }) {
  if (meta.confidence === "low" || meta.usableComps === 0) {
    return (
      <p className="border-border/60 text-muted-fg rounded-lg border border-dashed p-3 text-xs">
        Opening line is a 50/50 prior — not enough recent comparable sales to price this home yet.
        No trades have happened, so there&apos;s no market price.
      </p>
    );
  }
  return (
    <p className="border-border/60 text-muted-fg rounded-lg border border-dashed p-3 text-xs leading-relaxed">
      <span className="text-foreground font-medium">
        Model line · {meta.confidence} confidence.
      </span>{" "}
      Priced from {meta.usableComps} real sold comps (median {formatUsdCents(meta.compPpsfCents)}
      /sqft → {formatUsdCents(meta.fairValueCents)} fair value, {meta.valuationGap >= 0 ? "+" : ""}
      {Math.round(meta.valuationGap * 100)}% vs list). No trades yet — this is an estimate, not a
      traded market price.
    </p>
  );
}
