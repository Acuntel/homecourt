"use client";

import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const STEPS = [
  { slug: "identity", label: "Identity" },
  { slug: "kyc", label: "KYC" },
  { slug: "twofa", label: "2FA" },
  { slug: "fund", label: "Fund" },
] as const;

type Step = (typeof STEPS)[number]["slug"];

function activeStep(pathname: string): Step {
  if (pathname.endsWith("/fund")) return "fund";
  if (pathname.endsWith("/twofa")) return "twofa";
  if (pathname.endsWith("/kyc")) return "kyc";
  return "identity";
}

/**
 * OnboardingProgress — 4-step indicator across the top of the (auth)/onboarding
 * routes. Pure presentational; the actual gating lives in middleware + the
 * step pages themselves.
 */
export function OnboardingProgress() {
  const pathname = usePathname() ?? "";
  const current = activeStep(pathname);
  const currentIndex = STEPS.findIndex((s) => s.slug === current);

  return (
    <nav aria-label="Onboarding progress" className="flex flex-col gap-3">
      <div className="text-muted-fg flex items-center justify-between text-xs">
        <span className="font-mono uppercase tracking-wide">
          Step {currentIndex + 1} of {STEPS.length}
        </span>
        <span className="text-foreground">{STEPS[currentIndex]?.label}</span>
      </div>
      <ol className="flex items-center gap-1.5" role="list">
        {STEPS.map((step, idx) => {
          const isDone = idx < currentIndex;
          const isCurrent = idx === currentIndex;
          return (
            <li
              key={step.slug}
              aria-current={isCurrent ? "step" : undefined}
              className={cn(
                "h-1 flex-1 rounded-full transition-colors",
                isDone && "bg-court-500",
                isCurrent && "bg-court-500/70",
                !isDone && !isCurrent && "bg-border",
              )}
            />
          );
        })}
      </ol>
    </nav>
  );
}
