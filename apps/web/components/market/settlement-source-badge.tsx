"use client";

import { Info } from "lucide-react";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface SettlementSourceBadgeProps {
  className?: string;
  source?: string;
}

export function SettlementSourceBadge({
  className,
  source = "MLS close report",
}: SettlementSourceBadgeProps) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "border-border bg-muted text-muted-fg inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium",
              className,
            )}
          >
            <Info className="h-3 w-3" aria-hidden />
            <span>Settles based on {source}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[260px] leading-relaxed">
          When the listing&apos;s official close price reports, the bucket containing that price
          pays out 100¢; the rest pay 0¢. No action required from holders.
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
