import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function Hero() {
  return (
    <section className="border-border/60 relative overflow-hidden border-b">
      {/* Subtle court-green glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_15%_0%,rgba(16,185,129,0.18),transparent_55%),radial-gradient(circle_at_85%_30%,rgba(31,79,255,0.12),transparent_60%)]"
      />
      <div className="container flex flex-col gap-10 py-20 md:py-28">
        <div className="flex max-w-2xl flex-col gap-6">
          <span className="border-court-500/30 bg-court-500/10 text-court-500 inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium tracking-wide">
            <span className="bg-court-500 h-1.5 w-1.5 rounded-full" aria-hidden />
            Phase 0 — sweepstakes coins, real-time order books
          </span>
          <h1 className="text-foreground text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            Trade the price of every house in America.
          </h1>
          <p className="text-muted-fg max-w-xl text-lg">
            Sweepstakes coins. Real-time order books. No brokers. HOMECOURT turns every US
            single-family listing into a five-bucket market — pick where it closes, place a trade,
            settle against the tape.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link
              href="/signup"
              className="bg-court-500 text-ink-950 hover:bg-court-400 focus-visible:ring-court-500 focus-visible:ring-offset-ink-950 inline-flex items-center justify-center gap-2 rounded-md px-5 py-2.5 text-sm font-medium shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            >
              Start trading free
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link
              href="/markets"
              className="border-border bg-card text-foreground hover:border-court-500/40 hover:bg-muted focus-visible:ring-court-500 focus-visible:ring-offset-ink-950 inline-flex items-center justify-center gap-2 rounded-md border px-5 py-2.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            >
              Browse markets
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
