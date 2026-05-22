"use client";

// HOMECOURT — real trade panel (Quick + Limit). Posts to /api/orders which
// proxies to the matching engine. Live computed block reuses lib/trade/preview.
// Phase 0 sweepstakes: skip pre-flight balance check — engine rejects if short.

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

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
import { orderFormSchema, type OrderFormInput, type TradeSide } from "@homecourt/shared";
import type { MarketBookSnapshot, MarketBucketWithPrice, MarketDetail } from "@homecourt/shared";

interface TradePanelProps {
  detail: MarketDetail;
  bucket: MarketBucketWithPrice;
  book: MarketBookSnapshot;
  className?: string;
}

type Mode = "quick" | "limit";

export function TradePanel({ detail, bucket, book, className }: TradePanelProps) {
  const [mode, setMode] = useState<Mode>("quick");
  const [side, setSide] = useState<TradeSide>("YES");
  const [amountMode, setAmountMode] = useState<"contracts" | "dollars">("dollars");
  const [acknowledgedSlippage, setAcknowledgedSlippage] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const bestAsk =
    side === "YES" ? yesAsksSorted(book.asks)[0]?.[0] : noAsksFromYesBook(book.bids)[0]?.[0];

  const form = useForm<OrderFormInput>({
    resolver: zodResolver(orderFormSchema),
    mode: "onChange",
    defaultValues: {
      mode: "quick",
      side: "YES",
      amountMode: "dollars",
      amount: 25,
    },
  });

  // Keep RHF in sync with local toggles.
  const amountRaw = form.watch("amount") ?? 0;
  form.register("mode");
  form.setValue("mode", mode);
  form.setValue("side", side);
  form.setValue("amountMode", amountMode);

  const limitPriceCents =
    mode === "limit" ? Number(form.watch("priceCents" as never) ?? bestAsk ?? 50) : null;

  // Convert input → contract qty.
  const qty = useMemo(() => {
    if (amountMode === "contracts") return Math.floor(amountRaw);
    const refPrice = mode === "limit" && limitPriceCents ? limitPriceCents : (bestAsk ?? 50);
    return dollarsToQty(amountRaw, refPrice);
  }, [amountMode, amountRaw, mode, limitPriceCents, bestAsk]);

  // Build the preview from the relevant side of the book.
  const preview = useMemo(() => {
    if (qty <= 0) {
      return buyLimitPreview(bestAsk ?? 50, 0);
    }
    if (mode === "limit" && limitPriceCents) {
      return buyLimitPreview(limitPriceCents, qty);
    }
    const levels = side === "YES" ? yesAsksSorted(book.asks) : noAsksFromYesBook(book.bids);
    return buyMarketPreview(levels, qty);
  }, [mode, qty, limitPriceCents, side, book.asks, book.bids, bestAsk]);

  const slLevel = slippageLevel(preview.slippagePct);
  const disabledByConfig = qty <= 0 || (!preview.canFill && mode === "quick");
  const disabledBySlippage = slLevel === "high" && !acknowledgedSlippage;
  const canSubmit = !disabledByConfig && !disabledBySlippage && form.formState.isValid;

  function handleReview() {
    if (!canSubmit) return;
    setConfirmOpen(true);
  }

  const chips = amountMode === "dollars" ? [5, 25, 100] : [10, 50, 250];

  return (
    <aside
      className={cn(
        "border-border bg-card flex w-full flex-col gap-4 rounded-xl border p-5",
        className,
      )}
      aria-label="Trade panel"
    >
      <header className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-tight">Trade</h2>
        <Tabs value={mode} onValueChange={(v) => setMode(v === "limit" ? "limit" : "quick")}>
          <TabsList className="h-7 p-0.5">
            <TabsTrigger value="quick" className="px-2.5 text-[11px]">
              Quick
            </TabsTrigger>
            <TabsTrigger value="limit" className="px-2.5 text-[11px]">
              Limit
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </header>

      <Tabs value={side} onValueChange={(v) => setSide(v === "NO" ? "NO" : "YES")}>
        <TabsList className="grid h-9 w-full grid-cols-2 p-0.5">
          <TabsTrigger
            value="YES"
            className="data-[state=active]:bg-court-500 data-[state=active]:text-white"
          >
            Buy YES {formatPriceCents(bucket.yesPriceCents)}
          </TabsTrigger>
          <TabsTrigger
            value="NO"
            className="data-[state=active]:bg-no-500 data-[state=active]:text-white"
          >
            Buy NO {formatPriceCents(Math.max(1, 100 - bucket.yesPriceCents))}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="text-muted-fg text-xs">
        <span className="text-foreground font-medium">{bucket.label}</span>
        <span className="ml-2">closes {new Date(detail.closesAt).toLocaleDateString("en-US")}</span>
      </div>

      {mode === "limit" ? (
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
            defaultValue={bestAsk ?? 50}
            {...form.register("priceCents" as never, { valueAsNumber: true })}
            className="font-mono tabular-nums"
          />
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="trade-amount" className="text-[11px] uppercase tracking-wide">
            Amount
          </Label>
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
        </div>
        <Input
          id="trade-amount"
          type="number"
          min={1}
          step={1}
          {...form.register("amount", { valueAsNumber: true })}
          className="font-mono tabular-nums"
        />
        <div className="flex gap-1.5">
          {chips.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => form.setValue("amount", v, { shouldValidate: true })}
              className="border-border bg-muted/40 text-foreground hover:bg-muted focus-visible:ring-court-500 inline-flex flex-1 items-center justify-center rounded-md border px-2 py-1 text-xs font-medium tabular-nums focus-visible:outline-none focus-visible:ring-2"
            >
              {amountMode === "dollars" ? `$${v}` : `${v}`}
            </button>
          ))}
        </div>
      </div>

      {mode === "limit" ? (
        <div className="flex flex-col gap-1.5">
          <Label className="text-[11px] uppercase tracking-wide">Expires</Label>
          <select
            {...form.register("expiry" as never)}
            defaultValue="gtc"
            className="border-border bg-card focus-visible:ring-court-500 rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2"
          >
            <option value="gtc">Good til cancel</option>
            <option value="1h">In 1 hour</option>
            <option value="1d">In 1 day</option>
            <option value="eod">End of day</option>
          </select>
        </div>
      ) : null}

      <dl className="border-border/60 bg-muted/30 flex flex-col gap-1.5 rounded-md border px-3 py-2 text-xs">
        <Row label="Avg price" value={`${preview.avgPriceCents || "—"}¢`} />
        <Row label="Quantity" value={`${qty.toLocaleString("en-US")} contracts`} />
        <Row
          label={
            <span className="inline-flex items-center gap-1">
              Fees <FeeTooltip />
            </span>
          }
          value={formatUsdCents(preview.feeCents, { detailed: true })}
        />
        <Row label="Cost" value={formatUsdCents(preview.costCents, { detailed: true })} />
        <Row
          label="Max payout"
          value={formatUsdCents(preview.maxPayoutCents, { detailed: true })}
        />
        <Row
          label="Profit if win"
          value={`+${formatUsdCents(Math.max(0, preview.profitIfWinCents), { detailed: true })}`}
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
        size="default"
        className="w-full"
        disabled={!canSubmit}
        onClick={handleReview}
        aria-label="Review trade"
      >
        Review trade →
      </Button>

      {qty === 0 ? (
        <p className="text-muted-fg text-center text-[11px]">Enter an amount to preview a trade.</p>
      ) : null}

      <TradeConfirmModal
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        slug={detail.slug}
        bucketLabel={bucket.label}
        side={side}
        outcomeIdx={bucket.idx}
        priceCents={mode === "limit" ? (limitPriceCents ?? bestAsk ?? 50) : preview.avgPriceCents}
        qty={qty}
        preview={preview}
        mode={mode}
      />
    </aside>
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
