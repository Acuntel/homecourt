import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Coins,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { MarketingNav } from "@/components/marketing/marketing-nav";
import { MarketingFooter } from "@/components/marketing/footer";

export const metadata: Metadata = {
  title: "How HOMECOURT works",
  description:
    "How HOMECOURT lets you call YES or NO on whether a real Deerfield, IL home sells above its list price — Phase 0 sweepstakes, the path to real money, settlement timing, and legal status.",
};

export default function HowItWorksPage() {
  return (
    <div className="bg-background text-foreground flex min-h-screen flex-col">
      <MarketingNav />

      <main className="container flex flex-col gap-12 py-12 lg:py-16">
        <section className="flex flex-col gap-3">
          <span className="text-court-500 text-[11px] font-semibold uppercase tracking-wide">
            How it works
          </span>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Will it sell above list?
          </h1>
          <p className="text-muted-fg max-w-2xl text-base leading-relaxed">
            HOMECOURT is a prediction market on real homes. We take a live Deerfield, IL listing and
            ask one question — does it sell above its list price? Call YES or NO, and get paid when
            the property closes. Phase 0 runs as a free-to-play sweepstakes — no real money at
            stake, no purchase necessary.
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button asChild>
              <Link href="/signup">Try the demo →</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/markets">Browse markets</Link>
            </Button>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <StepCard
            number="1"
            Icon={Building2}
            title="Pick a home"
            body="Real, currently-for-sale Deerfield, IL listings. Each market asks one binary question: will this home sell above its list price? YES pays if it does, NO pays if it doesn't."
          />
          <StepCard
            number="2"
            Icon={TrendingUp}
            title="Call YES or NO"
            body="Each side shows a payout multiplier — the longer the odds, the bigger the multiplier. Tap YES if you think it sells over ask, NO if you don't. Type an amount, slide to buy."
          />
          <StepCard
            number="3"
            Icon={Coins}
            title="Get paid on close"
            body="When the listing closes (or expires), the oracle settles every contract. Winners credit instantly. Losers expire worthless. Cash out via your portfolio."
          />
        </section>

        <section className="border-border bg-card flex flex-col gap-4 rounded-xl border p-6">
          <header className="flex items-center gap-2">
            <ShieldCheck className="text-court-500 h-4 w-4" aria-hidden />
            <h2 className="text-foreground text-sm font-semibold uppercase tracking-wide">
              Legal status &amp; the path to real money
            </h2>
          </header>
          <p className="text-muted-fg text-sm leading-relaxed">
            Today HOMECOURT runs as a Phase 0 sweepstakes — every account starts with $500 in
            play-money coins. That model is legal in all 50 states because there is no real-money
            consideration. Below is the realistic timeline to flip the switch on real money.
          </p>

          <div className="border-border/60 divide-border/60 flex flex-col divide-y overflow-hidden rounded-md border">
            <PhaseRow
              tag="LIVE NOW"
              tagTone="court"
              title="Phase 0 — Sweepstakes"
              timing="Today"
              body="Free-to-play. Binary YES/NO above-list-price contracts on real Deerfield, IL listings scraped from public data. Mock oracle settles when a listing's close date passes. Used to validate the trading loop, social layer, and house market-maker pricing model."
            />
            <PhaseRow
              tag="6–12 MO"
              tagTone="cobalt"
              title="Phase 1 — Kalshi DCM partnership"
              timing="2026 Q4 → 2027 Q2"
              body="List HOMECOURT contracts under an existing CFTC-regulated Designated Contract Market (Kalshi or QCEX). $2-5M setup, 30-60% rev share to the partner DCM. Real-money trading legal in ~40 US states once partnership signs. Settlement source: MLS close report + ATTOM transaction feed + county recorder deed (2-of-3 agreement, 7-day dispute window)."
            />
            <PhaseRow
              tag="24+ MO"
              tagTone="muted"
              title="Phase 2 — Own DCM + IRS §1256 PLR"
              timing="2028+"
              body="Apply for our own CFTC Designated Contract Market license. $30-60M and 24+ months. Then file an IRS Private Letter Ruling on §1256 treatment so user winnings get 60/40 LTCG/STCG instead of ordinary income — a marketable competitive moat vs. Kalshi (which has not secured this)."
            />
          </div>

          <p className="text-muted-fg text-[12px] leading-relaxed">
            The platform is architecturally ready for real money today. The blockers are regulatory
            partnership timelines and MLS data licensing (MRED / Midwest Real Estate Data
            commercial-tier license: 6-10 week approval, ~$5K-25K/mo).
          </p>
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <InfoCard
            Icon={ClipboardCheck}
            title="Settlement timing"
            body={
              <>
                Settlement fires the moment a listing&apos;s recorded close date passes. The mock
                oracle picks the winning bucket from the actual close price; if no close has been
                recorded, weighted-random by current YES prices. Real-money settlement (Phase 1)
                uses a <strong className="text-foreground">2-of-3 attestation</strong>: MLS close
                report, ATTOM transaction feed, and county recorder deed must agree within 1% before
                payouts release. <strong className="text-foreground">7-day dispute window</strong>{" "}
                for users to challenge with a $500 bond.
              </>
            }
          />
          <InfoCard
            Icon={Sparkles}
            title="Fees"
            body={
              <>
                Taker fee per contract is{" "}
                <strong className="text-foreground">7% × P × (1 − P)</strong>. That tops out at
                ~1.75¢ per contract at 50¢ pricing and approaches zero near the edges. No fees on
                cancels. No fees on settled losers. Maker fees are roughly 25% of taker fees (a
                rebate on resting limit orders).
              </>
            }
          />
          <InfoCard
            Icon={ShieldCheck}
            title="Anti-collusion"
            body={
              <>
                Listing agents are auto-blocked from trading their own listings via NAR + ARELLO
                license cross-checks. Suspicious price moves (close price below 50% of pre-close
                AVM) auto-void the market and refund all positions. Position caps of $1K per user
                per market and $50K total open interest per market in Phase 1.
              </>
            }
          />
          <InfoCard
            Icon={CheckCircle2}
            title="What's the alpha?"
            body={
              <>
                Zillow Zestimate has a ~7%+ off-market median error. The market-maker bot quotes
                from those Zestimates, so traders with local knowledge — school redistricting rumor,
                fresh comp closing, agent-quality signal — get to express it and earn edge.
                Crowd-corrected price discovery is the B2B asset Zillow and iBuyers would pay for.
              </>
            }
          />
        </section>

        <section className="border-border bg-card flex flex-col items-start gap-3 rounded-xl border p-6">
          <h2 className="text-foreground text-lg font-semibold tracking-tight">Ready to trade?</h2>
          <p className="text-muted-fg text-sm leading-relaxed">
            Sweepstakes onboarding is under 60 seconds. Magic-link sign in, $500 in play-money
            coins, full access to all 120 markets.
          </p>
          <Button asChild>
            <Link href="/signup">
              Start trading free
              <ArrowRight className="ml-2 h-3.5 w-3.5" aria-hidden />
            </Link>
          </Button>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}

interface StepCardProps {
  number: string;
  Icon: typeof Building2;
  title: string;
  body: string;
}

function StepCard({ number, Icon, title, body }: StepCardProps) {
  return (
    <div className="border-border bg-card flex flex-col gap-3 rounded-xl border p-5">
      <div className="flex items-center gap-3">
        <span className="bg-court-500/10 text-court-500 inline-flex h-8 w-8 items-center justify-center rounded-full font-mono text-sm tabular-nums">
          {number}
        </span>
        <Icon className="text-muted-fg h-4 w-4" aria-hidden />
      </div>
      <h3 className="text-foreground text-base font-semibold tracking-tight">{title}</h3>
      <p className="text-muted-fg text-sm leading-relaxed">{body}</p>
    </div>
  );
}

interface PhaseRowProps {
  tag: string;
  tagTone: "court" | "cobalt" | "muted";
  title: string;
  timing: string;
  body: string;
}

function PhaseRow({ tag, tagTone, title, timing, body }: PhaseRowProps) {
  const tagClass =
    tagTone === "court"
      ? "bg-court-500/15 text-court-500"
      : tagTone === "cobalt"
        ? "bg-cobalt-500/15 text-cobalt-500"
        : "bg-muted text-muted-fg";
  return (
    <div className="bg-card flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:gap-5">
      <div className="sm:w-32 sm:shrink-0">
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tagClass}`}
        >
          {tag}
        </span>
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex items-baseline gap-2">
          <h3 className="text-foreground text-sm font-semibold">{title}</h3>
          <span className="text-muted-fg text-[11px]">{timing}</span>
        </div>
        <p className="text-muted-fg text-xs leading-relaxed">{body}</p>
      </div>
    </div>
  );
}

interface InfoCardProps {
  Icon: typeof Building2;
  title: string;
  body: React.ReactNode;
}

function InfoCard({ Icon, title, body }: InfoCardProps) {
  return (
    <div className="border-border bg-card flex flex-col gap-2 rounded-xl border p-5">
      <div className="flex items-center gap-2">
        <Icon className="text-court-500 h-4 w-4" aria-hidden />
        <h3 className="text-foreground text-sm font-semibold tracking-tight">{title}</h3>
      </div>
      <p className="text-muted-fg text-sm leading-relaxed">{body}</p>
    </div>
  );
}
