"use client";

// HOMECOURT — Kalshi-faithful trade panel.
//
// Patterns lifted from Kalshi:
//   - Two BIG side buttons stacked. YES (green) + NO (red). One always
//     visually "selected"; tapping the other one swaps. No tabs.
//   - Single dollar amount. No mode toggle visible. Chips $1/$5/$25/$100.
//   - The killer multiplier line: "Pay $4.30 to win $10.00" — instant payoff
//     math. No table of fees/avg-price by default.
//   - Single CTA: "Buy YES $5" — color-matches the selected side.
//   - Inline confirm: a second click flips the CTA into a 1-second
//     press-and-hold "Hold to confirm" gesture. No modal in the happy path.
//   - Limit/qty/expiration tucked under "Advanced" — like Kalshi's
//     order-type pop-out.

import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FeeTooltip } from "@/components/trade/fee-tooltip";
import { SlippageWarning, slippageLevel } from "@/components/trade/slippage-warning";
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
const HOLD_MS = 700;

export function TradePanel({ detail, bucket, book, className }: TradePanelProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [side, setSide] = useState<TradeSide>("YES");
  const [amount, setAmount] = useState<number>(5);
  const [mode, setMode] = useState<Mode>("quick");
  const [amountMode, setAmountMode] = useState<AmountMode>("dollars");
  const [limitPriceCents, setLimitPriceCents] = useState<number | null>(null);
  const [, setExpiry] = useState<Expiry>("gtc");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [acknowledgedSlippage, setAcknowledgedSlippage] = useState(false);
  const [armed, setArmed] = useState(false);
  const [holding, setHolding] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const yesPrice = bucket.yesPriceCents;
  const noPrice = Math.max(1, 100 - yesPrice);
  const selectedSidePrice = side === "YES" ? yesPrice : noPrice;

  const bestAsk =
    side === "YES" ? yesAsksSorted(book.asks)[0]?.[0] : noAsksFromYesBook(book.bids)[0]?.[0];

  const effectiveLimit =
    mode === "limit" ? (limitPriceCents ?? bestAsk ?? selectedSidePrice) : null;

  const qty = useMemo(() => {
    if (amountMode === "contracts") return Math.max(0, Math.floor(amount));
    const refPrice = effectiveLimit ?? bestAsk ?? selectedSidePrice;
    return dollarsToQty(amount, refPrice);
  }, [amountMode, amount, effectiveLimit, bestAsk, selectedSidePrice]);

  const preview = useMemo(() => {
    if (qty <= 0) return buyLimitPreview(bestAsk ?? selectedSidePrice, 0);
    if (mode === "limit" && effectiveLimit) return buyLimitPreview(effectiveLimit, qty);
    const levels = side === "YES" ? yesAsksSorted(book.asks) : noAsksFromYesBook(book.bids);
    return buyMarketPreview(levels, qty);
  }, [mode, qty, effectiveLimit, side, book.asks, book.bids, bestAsk, selectedSidePrice]);

  // Disarm whenever the user changes inputs. cancelHold is stable
  // (declared below; reads from holdTimer ref).
  useEffect(() => {
    setArmed(false);
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = null;
    setHolding(false);
  }, [side, amount, mode, limitPriceCents, amountMode]);

  function cancelHold() {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = null;
    setHolding(false);
  }

  const slLevel = slippageLevel(preview.slippagePct);
  const disabledByConfig = qty <= 0 || (!preview.canFill && mode === "quick");
  const disabledBySlippage = slLevel === "high" && !acknowledgedSlippage;
  const canSubmit = !disabledByConfig && !disabledBySlippage && !submitting;

  async function placeOrder() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          marketSlug: detail.slug,
          outcome: bucket.idx,
          side: side === "YES" ? "buy" : "sell",
          priceCents:
            mode === "limit"
              ? (effectiveLimit ?? bestAsk ?? selectedSidePrice)
              : preview.avgPriceCents,
          qty,
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
        toast.error(err.message ?? err.error ?? "Order rejected.");
        setArmed(false);
        return;
      }
      const body = (await res.json()) as {
        order: {
          status: "open" | "partial" | "filled" | "cancelled";
          filled_qty: number;
          resting_qty: number;
        };
      };
      const s = body.order.status;
      if (s === "filled") {
        toast.success(`Filled — ${body.order.filled_qty} contracts.`);
      } else if (s === "partial") {
        toast.success(
          `Partial — ${body.order.filled_qty} filled, ${body.order.resting_qty} resting.`,
        );
      } else {
        toast.success(`Order placed — resting on the book.`);
      }
      await queryClient.invalidateQueries({ queryKey: ["orderbook"] });
      await queryClient.invalidateQueries({ queryKey: ["balance"] });
      router.refresh();
      setArmed(false);
    } catch {
      toast.error("Network error — try again.");
      setArmed(false);
    } finally {
      setSubmitting(false);
    }
  }

  function handlePrimaryClick() {
    if (!canSubmit) return;
    if (!armed) {
      setArmed(true);
      return;
    }
    // Already armed → second click = instant place.
    void placeOrder();
  }

  function startHold() {
    if (!armed || !canSubmit) return;
    setHolding(true);
    holdTimer.current = setTimeout(() => {
      cancelHold();
      void placeOrder();
    }, HOLD_MS);
  }

  const chips = amountMode === "dollars" ? DOLLAR_CHIPS : CONTRACT_CHIPS;

  // Multiplier copy: "Pay $X.XX to win $Y.YY"
  const payCents = preview.costCents + preview.feeCents;
  const winCents = preview.maxPayoutCents;
  const profitCents = winCents - payCents;

  return (
    <aside
      className={cn(
        "border-border bg-card flex w-full flex-col gap-3 rounded-xl border p-5",
        className,
      )}
      aria-label="Trade panel"
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold tracking-tight">{bucket.label}</h2>
        <p className="text-muted-fg text-[11px] leading-relaxed">
          Closes {new Date(detail.closesAt).toLocaleDateString("en-US")}. Each share pays $1.00 if
          the close price lands in this bucket.
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
          className="font-mono text-base tabular-nums"
        />
        <div className="grid grid-cols-4 gap-1.5">
          {chips.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setAmount(v)}
              aria-pressed={amount === v}
              className={cn(
                "border-border bg-muted/30 text-foreground hover:bg-muted focus-visible:ring-court-500 inline-flex items-center justify-center rounded-md border px-2 py-1.5 text-xs font-medium tabular-nums transition focus-visible:outline-none focus-visible:ring-2",
                amount === v ? "border-court-500/60 bg-court-500/10 text-court-500" : "",
              )}
            >
              {amountMode === "dollars" ? `$${v}` : `${v}`}
            </button>
          ))}
        </div>
      </div>

      <PayoutMultiplier
        payCents={payCents}
        winCents={winCents}
        profitCents={profitCents}
        side={side}
        ready={qty > 0 && preview.canFill}
      />

      {mode === "quick" && qty > 0 && slLevel !== "low" ? (
        <SlippageWarning
          slippagePct={preview.slippagePct}
          acknowledged={acknowledgedSlippage}
          onAcknowledgeChange={setAcknowledgedSlippage}
        />
      ) : null}

      <PrimaryCta
        armed={armed}
        holding={holding}
        submitting={submitting}
        disabled={!canSubmit}
        side={side}
        payCents={payCents}
        onClick={handlePrimaryClick}
        onHoldStart={startHold}
        onHoldEnd={cancelHold}
        onCancel={() => setArmed(false)}
      />

      {qty === 0 && amount > 0 ? (
        <p className="text-no-500 text-center text-[11px]">
          Not enough liquidity at this size. Try a smaller amount.
        </p>
      ) : null}
      {qty === 0 && amount === 0 ? (
        <p className="text-muted-fg text-center text-[11px]">Enter a dollar amount.</p>
      ) : null}

      <div className="text-muted-fg flex items-center justify-between text-[10px]">
        <span className="inline-flex items-center gap-1">
          Fee {formatUsdCents(preview.feeCents, { detailed: true })} <FeeTooltip />
        </span>
        <span>Avg {preview.avgPriceCents || "—"}¢</span>
      </div>

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
                  value={limitPriceCents ?? bestAsk ?? selectedSidePrice}
                  onChange={(e) =>
                    setLimitPriceCents(
                      Math.max(1, Math.min(99, Number(e.target.value) || selectedSidePrice)),
                    )
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
        "focus-visible:ring-court-500 flex flex-col items-center justify-center gap-0.5 rounded-lg border-2 px-3 py-3.5 transition focus-visible:outline-none focus-visible:ring-2",
        active
          ? isYes
            ? "border-court-500 bg-court-500 text-ink-950 shadow-[0_0_0_4px_rgba(16,185,129,0.18)]"
            : "border-no-500 bg-no-500 text-white shadow-[0_0_0_4px_rgba(239,68,68,0.18)]"
          : isYes
            ? "border-court-500/30 bg-court-500/5 text-court-500 hover:bg-court-500/10"
            : "border-no-500/30 bg-no-500/5 text-no-500 hover:bg-no-500/10",
      )}
    >
      <span className="text-[10px] font-medium uppercase tracking-[0.08em] opacity-80">
        Buy {side}
      </span>
      <span className="font-mono text-2xl font-semibold tabular-nums leading-none">
        {formatPriceCents(priceCents)}
      </span>
    </button>
  );
}

interface PayoutMultiplierProps {
  payCents: number;
  winCents: number;
  profitCents: number;
  side: TradeSide;
  ready: boolean;
}

function PayoutMultiplier({ payCents, winCents, profitCents, side, ready }: PayoutMultiplierProps) {
  const colorClass = side === "YES" ? "text-court-500" : "text-no-500";
  if (!ready) {
    return (
      <div className="border-border/60 bg-muted/30 flex flex-col items-center justify-center gap-1 rounded-md border p-3 text-center">
        <span className="text-muted-fg text-[10px] uppercase tracking-wide">Payout preview</span>
        <span className="text-muted-fg font-mono text-sm">—</span>
      </div>
    );
  }
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-1 rounded-md border p-3 text-center",
        side === "YES" ? "border-court-500/30 bg-court-500/5" : "border-no-500/30 bg-no-500/5",
      )}
      aria-label="Payout preview"
    >
      <div className="flex items-baseline justify-center gap-2 leading-none">
        <span className="text-muted-fg text-[11px] uppercase tracking-wide">Pay</span>
        <span className="text-foreground font-mono text-lg font-semibold tabular-nums">
          {formatUsdCents(payCents, { detailed: true })}
        </span>
        <span className="text-muted-fg text-base" aria-hidden>
          →
        </span>
        <span className="text-muted-fg text-[11px] uppercase tracking-wide">Win</span>
        <span className={cn("font-mono text-lg font-semibold tabular-nums", colorClass)}>
          {formatUsdCents(winCents, { detailed: true })}
        </span>
      </div>
      <span className="text-muted-fg text-[10px]">
        Net profit if {side}:{" "}
        <span className={cn("font-mono tabular-nums", colorClass)}>
          {profitCents >= 0 ? "+" : ""}
          {formatUsdCents(profitCents, { detailed: true })}
        </span>
      </span>
    </div>
  );
}

interface PrimaryCtaProps {
  armed: boolean;
  holding: boolean;
  submitting: boolean;
  disabled: boolean;
  side: TradeSide;
  payCents: number;
  onClick: () => void;
  onHoldStart: () => void;
  onHoldEnd: () => void;
  onCancel: () => void;
}

function PrimaryCta({
  armed,
  holding,
  submitting,
  disabled,
  side,
  payCents,
  onClick,
  onHoldStart,
  onHoldEnd,
  onCancel,
}: PrimaryCtaProps) {
  const colorClass =
    side === "YES"
      ? "bg-court-500 hover:bg-court-400 text-ink-950"
      : "bg-no-500 hover:bg-no-500/90 text-white";

  if (submitting) {
    return (
      <Button
        type="button"
        size="lg"
        className={cn("h-12 w-full text-sm font-semibold", colorClass)}
        disabled
      >
        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
        Placing…
      </Button>
    );
  }

  if (!armed) {
    return (
      <Button
        type="button"
        size="lg"
        disabled={disabled}
        onClick={onClick}
        className={cn("h-12 w-full text-sm font-semibold", colorClass)}
        aria-label={`Buy ${side} ${formatUsdCents(payCents, { detailed: true })}`}
      >
        Buy {side} {formatUsdCents(payCents, { detailed: true })}
      </Button>
    );
  }

  // Armed state — second click OR press-and-hold for 0.7s confirms.
  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onPointerDown={onHoldStart}
        onPointerUp={onHoldEnd}
        onPointerLeave={onHoldEnd}
        onPointerCancel={onHoldEnd}
        onClick={onClick}
        disabled={disabled}
        aria-label="Confirm — tap again or hold"
        className={cn(
          "focus-visible:ring-court-500 relative inline-flex h-12 w-full items-center justify-center overflow-hidden rounded-md text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50",
          colorClass,
        )}
      >
        <span
          aria-hidden
          className={cn(
            "absolute inset-y-0 left-0 bg-white/25 transition-[width] ease-linear",
            holding ? "w-full duration-[700ms]" : "w-0 duration-0",
          )}
        />
        <span className="relative z-10">
          {holding
            ? "Confirming…"
            : `Tap again or hold to confirm — ${formatUsdCents(payCents, { detailed: true })}`}
        </span>
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="text-muted-fg hover:text-foreground self-center text-[11px] underline-offset-2 hover:underline"
      >
        Cancel
      </button>
    </div>
  );
}
