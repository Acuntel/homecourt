import Link from "next/link";
import { Wordmark } from "./wordmark";

export function MarketingNav() {
  return (
    <header className="border-border/60 bg-background/80 sticky top-0 z-30 border-b backdrop-blur-md">
      <nav aria-label="Primary" className="container flex h-14 items-center justify-between">
        <Link href="/" className="rounded-md focus-visible:outline-none">
          <Wordmark />
        </Link>
        <ul className="text-muted-fg hidden items-center gap-6 text-sm md:flex">
          <li>
            <Link href="/markets" className="hover:text-foreground transition">
              Markets
            </Link>
          </li>
          <li>
            <Link href="/how-it-works" className="hover:text-foreground transition">
              How it works
            </Link>
          </li>
          <li>
            <Link href="/legal" className="hover:text-foreground transition">
              Legal
            </Link>
          </li>
        </ul>
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="text-muted-fg hover:text-foreground hidden rounded-md px-3 py-1.5 text-sm transition sm:inline-flex"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="bg-court-500 text-ink-950 hover:bg-court-400 focus-visible:ring-court-500 focus-visible:ring-offset-ink-950 inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          >
            Start trading free
          </Link>
        </div>
      </nav>
    </header>
  );
}
