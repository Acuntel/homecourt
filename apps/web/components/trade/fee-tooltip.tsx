"use client";

// HOMECOURT — info icon + tooltip describing the taker fee formula.

import { Info } from "lucide-react";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface FeeTooltipProps {
  className?: string;
}

export function FeeTooltip({ className }: FeeTooltipProps) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="Fee formula"
            className={cn(
              "text-muted-fg hover:text-foreground focus-visible:ring-court-500 inline-flex items-center justify-center rounded-full p-0.5 transition focus-visible:outline-none focus-visible:ring-2",
              className,
            )}
          >
            <Info className="h-3.5 w-3.5" aria-hidden />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[240px] text-[11px] leading-relaxed">
          Fee = 7% &times; P &times; (1 &minus; P) per contract. Lower fees near 0&cent; and
          100&cent;, peak at 50&cent;. No fees on cancels.
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
