"use client";

import { Clock, ShieldCheck, AlertCircle, Vote, CheckCircle2 } from "lucide-react";

import { SettlementSourceBadge } from "@/components/market/settlement-source-badge";
import { formatClosesIn, formatUsdCents } from "@/lib/format";
import { cn } from "@/lib/utils";

export type ResolutionState = "pending" | "proposed" | "disputed" | "dvm_vote" | "resolved";

interface ResolutionCardProps {
  state: ResolutionState;
  closesAt: string;
  finalPriceCents?: number | null;
  finalBucketLabel?: string | null;
  className?: string;
}

interface StateConfig {
  Icon: typeof Clock;
  title: string;
  body: string;
  tone: "neutral" | "ok" | "warn" | "info";
}

const STATE_CONFIG: Record<ResolutionState, StateConfig> = {
  pending: {
    Icon: Clock,
    title: "Awaiting close.",
    body: "Settles automatically when the official listing closes. No action needed.",
    tone: "neutral",
  },
  proposed: {
    Icon: ShieldCheck,
    title: "Outcome proposed.",
    body: "A close price has been proposed. Holders can challenge within the dispute window.",
    tone: "info",
  },
  disputed: {
    Icon: AlertCircle,
    title: "Outcome disputed.",
    body: "The proposed close price has been challenged. A new proposal round is underway.",
    tone: "warn",
  },
  dvm_vote: {
    Icon: Vote,
    title: "Escalated to DVM.",
    body: "After repeated disputes, the outcome is now in a 48-72 hour vote.",
    tone: "warn",
  },
  resolved: {
    Icon: CheckCircle2,
    title: "Resolved.",
    body: "Winning shares paid 100¢. Losing shares paid 0¢.",
    tone: "ok",
  },
};

const TONE_CLASSES: Record<StateConfig["tone"], string> = {
  neutral: "border-court-500/30 bg-court-500/5 text-court-500",
  ok: "border-court-500/30 bg-court-500/5 text-court-500",
  info: "border-cobalt-500/30 bg-cobalt-500/5 text-cobalt-500",
  warn: "border-warn/30 bg-warn/5 text-warn",
};

export function ResolutionCard({
  state,
  closesAt,
  finalPriceCents,
  finalBucketLabel,
  className,
}: ResolutionCardProps) {
  const cfg = STATE_CONFIG[state];
  const { Icon } = cfg;

  return (
    <section
      className={cn("border-border bg-card flex flex-col gap-3 rounded-xl border p-4", className)}
      aria-label="Settlement status"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-tight">Settlement</h2>
        <SettlementSourceBadge />
      </div>

      <div className={cn("flex items-start gap-3 rounded-md border p-3", TONE_CLASSES[cfg.tone])}>
        <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-foreground text-xs font-medium">{cfg.title}</p>
          <p className="text-muted-fg text-[11px] leading-relaxed">{cfg.body}</p>
          {state === "resolved" && finalBucketLabel ? (
            <p className="text-foreground mt-1 text-[11px]">
              Final: <span className="font-medium">{finalBucketLabel}</span>
              {typeof finalPriceCents === "number" ? (
                <>
                  {" "}
                  <span className="text-muted-fg">({formatUsdCents(finalPriceCents)})</span>
                </>
              ) : null}
            </p>
          ) : null}
        </div>
      </div>

      <p className="text-muted-fg text-[11px]">{formatClosesIn(closesAt)}</p>
    </section>
  );
}
