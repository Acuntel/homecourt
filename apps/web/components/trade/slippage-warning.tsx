"use client";

// HOMECOURT — slippage banner shown above the CTA in <TradePanel>.
//
// Thresholds (BUILD.md §23 M7):
//   < 2%   green   "Low slippage 0.8%"
//   2–5%   amber   "Moderate slippage 3.4%"
//   > 5%   red     "High slippage 7.1% — your fill may be far from quoted price."
//                  + checkbox "I understand, place anyway"

import { AlertTriangle, CheckCircle2, TriangleAlert } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type SlippageLevel = "low" | "moderate" | "high";

export function slippageLevel(pct: number): SlippageLevel {
  if (pct < 2) return "low";
  if (pct <= 5) return "moderate";
  return "high";
}

interface SlippageWarningProps {
  slippagePct: number;
  acknowledged: boolean;
  onAcknowledgeChange: (next: boolean) => void;
  className?: string;
}

export function SlippageWarning({
  slippagePct,
  acknowledged,
  onAcknowledgeChange,
  className,
}: SlippageWarningProps) {
  const level = slippageLevel(slippagePct);
  const pretty = slippagePct.toFixed(1);

  if (level === "low") {
    return (
      <div
        role="status"
        className={cn(
          "border-court-500/30 bg-court-500/10 text-court-500 flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium",
          className,
        )}
      >
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
        Low slippage {pretty}%
      </div>
    );
  }

  if (level === "moderate") {
    return (
      <div
        role="status"
        className={cn(
          "flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-500",
          className,
        )}
      >
        <TriangleAlert className="h-3.5 w-3.5" aria-hidden />
        Moderate slippage {pretty}%
      </div>
    );
  }

  return (
    <div
      role="alert"
      className={cn(
        "border-no-500/40 bg-no-500/10 flex flex-col gap-2 rounded-md border px-3 py-2 text-xs",
        className,
      )}
    >
      <div className="text-no-500 flex items-start gap-2 font-medium">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>
          High slippage {pretty}% — your fill may be far from quoted price. Switch to Limit?
        </span>
      </div>
      <Label className="text-muted-fg flex items-center gap-2 pl-5 text-[11px] font-normal">
        <Checkbox
          checked={acknowledged}
          onCheckedChange={(v) => onAcknowledgeChange(v === true)}
          aria-label="Acknowledge high slippage"
        />
        I understand, place anyway
      </Label>
    </div>
  );
}
