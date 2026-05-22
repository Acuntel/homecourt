"use client";

import { useState } from "react";
import { ChevronDown, TrendingUp } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { DepositSheet } from "@/components/funding/deposit-sheet";
import { WithdrawSheet } from "@/components/funding/withdraw-sheet";
import { cn } from "@/lib/utils";

type Props = {
  cashCents: number;
  lockedCents?: number;
  pnlTodayCents?: number;
};

function formatUsd(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

/**
 * BalancePill — court-tinted pill that lives in TopNav. Clicking opens a
 * popover with mini balance details + Deposit / Withdraw CTAs. The actual
 * realtime wiring lands in M8; M3 just renders stub numbers.
 */
export function BalancePill({ cashCents, lockedCents = 0, pnlTodayCents = 0 }: Props) {
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [popOpen, setPopOpen] = useState(false);

  const buyingPower = Math.max(0, cashCents - lockedCents);
  const pnlPositive = pnlTodayCents >= 0;

  return (
    <>
      <Popover open={popOpen} onOpenChange={setPopOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`Balance ${formatUsd(cashCents)}`}
            className={cn(
              "border-court-500/30 bg-court-500/10 text-foreground hover:border-court-500/50 focus-visible:ring-court-500 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2",
            )}
          >
            <span className="font-mono tabular-nums">{formatUsd(cashCents)}</span>
            <ChevronDown className="h-3.5 w-3.5 opacity-70" aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0" align="end">
          <div className="flex flex-col gap-2 p-4">
            <Row label="Cash" value={formatUsd(cashCents)} />
            <Row label="Buying power" value={formatUsd(buyingPower)} />
            <Row
              label="P&L today"
              value={
                <span
                  className={cn(
                    "font-mono tabular-nums",
                    pnlPositive ? "text-court-500" : "text-no-500",
                  )}
                >
                  <TrendingUp
                    className={cn("mr-1 inline h-3 w-3", pnlPositive ? "" : "rotate-180")}
                    aria-hidden
                  />
                  {formatUsd(Math.abs(pnlTodayCents))}
                </span>
              }
            />
          </div>
          <Separator />
          <div className="grid grid-cols-2 gap-2 p-3">
            <Button
              size="sm"
              onClick={() => {
                setPopOpen(false);
                setDepositOpen(true);
              }}
            >
              Deposit
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setPopOpen(false);
                setWithdrawOpen(true);
              }}
            >
              Withdraw
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <DepositSheet open={depositOpen} onOpenChange={setDepositOpen} />
      <WithdrawSheet open={withdrawOpen} onOpenChange={setWithdrawOpen} />
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-fg">{label}</span>
      <span className="text-foreground font-mono tabular-nums">{value}</span>
    </div>
  );
}
