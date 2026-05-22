"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ShieldCheck, Loader2, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * KycWizard — P0 sweepstakes "auto-pass" screen. Shows a court check + a
 * "Skip KYC for sweepstakes" CTA. Submits to /api/kyc/submit which sets
 * users.kyc_status = 'approved'.
 */
export function KycWizard() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const onApprove = async () => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/kyc/submit", { method: "POST" });
      const json: { ok?: boolean; error?: string } = await res.json();
      if (!res.ok || !json.ok) {
        toast.error(json.error ?? "KYC failed.");
        return;
      }
      toast.success("KYC approved.");
      router.push("/onboarding/twofa");
    } catch {
      toast.error("Couldn't reach the server. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="border-court-500/30 bg-court-500/5 flex items-start gap-3 rounded-md border p-4">
        <ShieldCheck className="text-court-500 mt-0.5 h-5 w-5 shrink-0" aria-hidden />
        <div className="flex flex-col gap-1">
          <p className="text-foreground text-sm font-medium">
            Sweepstakes mode — KYC is auto-approved.
          </p>
          <p className="text-muted-fg text-xs leading-relaxed">
            HOMECOURT Phase 0 is a free-to-play sweepstakes. You don&apos;t need to upload any
            documents to play with sweepstakes credits. When real-money opens, you&apos;ll be
            re-verified.
          </p>
        </div>
      </div>

      <CourtCheckList />

      <Button
        type="button"
        onClick={onApprove}
        disabled={submitting}
        className="justify-center gap-2"
      >
        {submitting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ArrowRight className="h-4 w-4" />
        )}
        Skip KYC for sweepstakes
      </Button>
    </div>
  );
}

function CourtCheckList() {
  const items = [
    "U.S. resident, 18+ (self-attested)",
    "No real-money funding — sweepstakes credits only",
    "Trading caps enforced by the engine",
    "You can revoke at any time",
  ];
  return (
    <ul className="border-border divide-border bg-card divide-y rounded-md border text-sm">
      {items.map((it) => (
        <li key={it} className="text-foreground flex items-center gap-2 px-3 py-2.5">
          <span
            aria-hidden
            className="bg-court-500/15 text-court-500 inline-flex h-5 w-5 items-center justify-center rounded-full"
          >
            <svg viewBox="0 0 16 16" className="h-3 w-3 fill-current">
              <path d="M6.5 11 3 7.6l1.2-1.2L6.5 8.6l5.3-5.3L13 4.5 6.5 11Z" />
            </svg>
          </span>
          {it}
        </li>
      ))}
    </ul>
  );
}
