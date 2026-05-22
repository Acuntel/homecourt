"use client";

// HOMECOURT — Kalshi-style trade panel.
//
// Default UX: pick YES or NO with a big colored button, type a dollar amount,
// hit "Place trade." Advanced controls (Limit mode, contracts mode,
// expiration) are collapsed behind a disclosure so the panel reads like
// Kalshi out of the box. The full computed block (fees, cost, max payout)
// remains visible so the user always sees the math.

import { ChevronDown, ChevronUp } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FeeTooltip } from "@/components/trade/fee-tooltip";
import { SlippageWarning, slippageLevel } from "@/components/trade/slippage-warning";
import { TradeConfirmModal } from "@/components/trade/trade-confirm-modal";
import {
  buyLimitPreview,
  buyMarketPreview,
  dollarsToQty,
  noAsksFromYesBook,
  yesAsksSorted,
} from "@/lib/trade/preview";
import { formatPriceCents, formatUsdCents } from "@/lib/format";
import { cn } from "@/lib/utils";
import type {
  MarketBookSnapshot,
  MarketBucketWithPrice,
  MarketDetail,
  TradeSide,
} from "@homecourt/shared";

interface TradePanelProps {
  detail: MarketDetail;
  bucket: MarketBucketWithPrice;
  book: MarketBookSnapshot;
  className?: string;
}

type Mode = "quick" | "limit";
type AmountMode = "dollars" | "contracts";
type Expiry = "gtc" | "1h" | "1d" | "eod";

const DOLLAR_CHIPS = [1, 5, 25, 100] as const;
const CONTRACT_CHIPS = [5, 25, 50, 100] as const;

export function TradePanel({ detail, bucket, book, className }: TradePanelProps) {
  const [side, setSide] = useState<TradeSide>("YES");
  const [amount, setAmount] = useState<number>(25);
  const [mode, setMode] = useState<Mode>("quick");
  const [amountMode, setAmountMode] = useState<AmountMode>("dollars");
  const [limitPriceCents, setLimitPriceCents] = useState<number | null>(null);
  const [, setExpiry] = useState<Expiry>("gtc");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [acknowledgedSlippage, setAcknowledgedSlippage] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const yesPrice = bucket.yesPriceCents;
  const noPrice = Math.max(1, 100 - yesPrice);

  const bestAsk =
    side === "YES" ? yesAsksSorted(book.asks)[0]?.[0] : noAsksFromYesBook(book.bids)[0]?.[0];

  const effectiveLimit = mode === "limit" ? (limitPriceCents ?? bestAsk ?? 50) : null;

  const qty = useMemo(() => {
    if (amountMode === "contracts") return Math.max(0, Math.floor(amount));
    const refPrice = effectiveLimit ?? bestAsk ?? 50;
    return dollarsToQty(amount, refPrice);
  }, [amountMode, amount, effectiveLimit, bestAsk]);

  const preview = useMemo(() => {
    if (qty <= 0) return buyLimitPreview(bestAsk ?? 50, 0);
    if (mode === "limit" && effectiveLimit) return buyLimitPreview(effectiveLimit, qty);
    const levels = side === "YES" ? yesAsksSorted(book.asks) : noAsksFromYesBook(book.bids);
    return buyMarketPreview(levels, qty);
  }, [mode, qty, effectiveLimit, side, book.asks, book.bids, bestAsk]);

  const slLevel = slippageLevel(preview.slippagePct);
  const disabledByConfig = qty <= 0 || (!preview.canFill && mode === "quick");
  const disabledBySlippage = slLevel === "high" && !acknowledgedSlippage;
  const canSubmit = !disabledByConfig && !disabledBySlippage;

  const chips = amountMode === "dollars" ? DOLLAR_CHIPS : CONTRACT_CHIPS;
  const ctaLabel =
    mode === "quick"
      ? `Place trade — ${formatUsdCents(preview.costCents, { detailed: true })}`
      : `Place limit order — ${formatUsdCents(preview.costCents, { detailed: true })}`;

  return (
    <aside
      className={cn(
        "border-border bg-card flex w-full flex-col gap-4 rounded-xl border p-5",
        className,
      )}
      aria-label="Trade panel"
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold tracking-tight">Trade this market</h2>
        <p className="text-muted-fg text-[11px] leading-relaxed">
          <span className="text-foreground font-medium">{bucket.label}</span> · closes{" "}
          {new Date(detail.closesAt).toLocaleDateString("en-US")}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <SideButton
          side="YES"
          active={side === "YES"}
          priceCents={yesPrice}
          onClick={() => setSide("YES")}
        />
        <SideButton
          side="NO"
          active={side === "NO"}
          priceCents={noPrice}
          onClick={() => setSide("NO")}
        />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="trade-amount" className="text-[11px] uppercase tracking-wide">
            {amountMode === "dollars" ? "Amount ($)" : "Contracts"}
          </Label>
          {advancedOpen ? (
            <Tabs
              value={amountMode}
              onValueChange={(v) => setAmountMode(v === "contracts" ? "contracts" : "dollars")}
            >
              <TabsList className="h-6 p-0.5">
                <TabsTrigger value="dollars" className="px-2 text-[10px]">
                  $
                </TabsTrigger>
                <TabsTrigger value="contracts" className="px-2 text-[10px]">
                  Qty
                </TabsTrigger>
              </TabsList>
            </Tabs>
          ) : null}
        </div>
        <Input
          id="trade-amount"
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          value={Number.isFinite(amount) ? amount : ""}
          onChange={(e) => setAmount(Number(e.target.value) || 0)}
          className="font-mono text-lg tabular-nums"
        />
        <div className="grid grid-cols-4 gap-1.5">
          {chips.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setAmount(v)}
              className={cn(
                "border-border bg-muted/40 text-foreground hover:bg-muted focus-visible:ring-court-500 inline-flex items-center justify-center rounded-md border px-2 py-1.5 text-xs font-medium tabular-nums focus-visible:outline-none focus-visible:ring-2",
                amount === v ? "border-court-500/60 bg-court-500/10 text-court-500" : "",
              )}
            >
              {amountMode === "dollars" ? `$${v}` : `${v}`}
            </button>
          ))}
        </div>
      </div>

      <dl className="border-border/60 bg-muted/30 flex flex-col gap-1.5 rounded-md border px-3 py-2 text-xs">
        <Row label="Avg price" value={`${preview.avgPriceCents || "—"}¢`} />
        <Row label="You get" value={`${qty.toLocaleString("en-US")} contracts`} />
        <Row
          label={
            <span className="inline-flex items-center gap-1">
              Fee <FeeTooltip />
            </span>
          }
          value={formatUsdCents(preview.feeCents, { detailed: true })}
        />
        <Row label="Cost" value={formatUsdCents(preview.costCents, { detailed: true })} />
        <Row
          label={`Max payout if ${side}`}
          value={formatUsdCents(preview.maxPayoutCents, { detailed: true })}
          accent="ok"
        />
      </dl>

      {mode === "quick" && qty > 0 ? (
        <SlippageWarning
          slippagePct={preview.slippagePct}
          acknowledged={acknowledgedSlippage}
          onAcknowledgeChange={setAcknowledgedSlippage}
        />
      ) : null}

      <Button
        type="button"
        size="lg"
        className={cn(
          "h-11 w-full text-sm font-semibold",
          side === "YES"
            ? "bg-court-500 hover:bg-court-400 text-ink-950"
            : "bg-no-500 hover:bg-no-500/90 text-white",
        )}
        disabled={!canSubmit}
        onClick={() => setConfirmOpen(true)}
        aria-label={`Place trade — buy ${side}`}
      >
        {ctaLabel}
      </Button>

      {qty === 0 ? (
        <p className="text-muted-fg text-center text-[11px]">Enter an amount to preview a trade.</p>
      ) : null}

      <button
        type="button"
        onClick={() => setAdvancedOpen((o) => !o)}
        className="text-muted-fg hover:text-foreground focus-visible:ring-court-500 inline-flex items-center justify-center gap-1 self-center rounded text-[11px] focus-visible:outline-none focus-visible:ring-1"
        aria-expanded={advancedOpen}
      >
        Advanced
        {advancedOpen ? (
          <ChevronUp className="h-3 w-3" aria-hidden />
        ) : (
          <ChevronDown className="h-3 w-3" aria-hidden />
        )}
      </button>

      {advancedOpen ? (
        <div className="border-border/60 bg-muted/20 flex flex-col gap-3 rounded-md border p-3">
          <div className="flex items-center justify-between">
            <Label className="text-[11px] uppercase tracking-wide">Order type</Label>
            <Tabs value={mode} onValueChange={(v) => setMode(v === "limit" ? "limit" : "quick")}>
              <TabsList className="h-7 p-0.5">
                <TabsTrigger value="quick" className="px-2.5 text-[11px]">
                  Market
                </TabsTrigger>
                <TabsTrigger value="limit" className="px-2.5 text-[11px]">
                  Limit
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {mode === "limit" ? (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="trade-price" className="text-[11px] uppercase tracking-wide">
                  Limit price (cents)
                </Label>
                <Input
                  id="trade-price"
                  type="number"
                  min={1}
                  max={99}
                  step={1}
                  value={limitPriceCents ?? bestAsk ?? 50}
                  onChange={(e) =>
                    setLimitPriceCents(Math.max(1, Math.min(99, Number(e.target.value) || 50)))
                  }
                  className="font-mono tabular-nums"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-[11px] uppercase tracking-wide">Expires</Label>
                <select
                  defaultValue="gtc"
                  onChange={(e) => setExpiry(e.target.value as Expiry)}
                  className="border-border bg-card focus-visible:ring-court-500 rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2"
                >
                  <option value="gtc">Good til cancel</option>
                  <option value="1h">In 1 hour</option>
                  <option value="1d">In 1 day</option>
                  <option value="eod">End of day</option>
                </select>
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      <TradeConfirmModal
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        slug={detail.slug}
        bucketLabel={bucket.label}
        side={side}
        outcomeIdx={bucket.idx}
        priceCents={mode === "limit" ? (effectiveLimit ?? bestAsk ?? 50) : preview.avgPriceCents}
        qty={qty}
        preview={preview}
        mode={mode}
      />
    </aside>
  );
}

interface SideButtonProps {
  side: TradeSide;
  active: boolean;
  priceCents: number;
  onClick: () => void;
}

function SideButton({ side, active, priceCents, onClick }: SideButtonProps) {
  const isYes = side === "YES";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={`Buy ${side} at ${formatPriceCents(priceCents)}`}
      className={cn(
        "focus-visible:ring-court-500 flex flex-col items-center justify-center gap-0.5 rounded-lg border px-3 py-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2",
        active
          ? isYes
            ? "border-court-500 bg-court-500 text-ink-950 shadow-[0_0_0_3px_rgba(16,185,129,0.15)]"
            : "border-no-500 bg-no-500 text-white shadow-[0_0_0_3px_rgba(239,68,68,0.15)]"
          : isYes
            ? "border-court-500/40 bg-court-500/5 text-court-500 hover:bg-court-500/10"
            : "border-no-500/40 bg-no-500/5 text-no-500 hover:bg-no-500/10",
      )}
    >
      <span className="text-[11px] font-medium uppercase tracking-wide opacity-80">Buy {side}</span>
      <span className="font-mono text-xl tabular-nums">{formatPriceCents(priceCents)}</span>
    </button>
  );
}

interface RowProps {
  label: React.ReactNode;
  value: string;
  accent?: "ok" | "no";
}

function Row({ label, value, accent }: RowProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-fg text-[11px]">{label}</dt>
      <dd
        className={cn(
          "font-mono text-xs tabular-nums",
          accent === "ok" ? "text-court-500" : accent === "no" ? "text-no-500" : "text-foreground",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
