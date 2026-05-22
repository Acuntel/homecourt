import Link from "next/link";
import { Wordmark } from "./wordmark";

export function MarketingFooter() {
  return (
    <footer className="border-border/60 border-t">
      <div className="container flex flex-col gap-6 py-10 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-2">
          <Wordmark size="sm" />
          <p className="text-muted-fg max-w-md text-xs">
            HOMECOURT Phase 0 is a free-to-play sweepstakes. No purchase necessary. Void where
            prohibited. Not securities. Not insurance. Not real estate brokerage.
          </p>
        </div>
        <ul className="text-muted-fg flex items-center gap-5 text-xs">
          <li>
            <Link href="/legal" className="hover:text-foreground">
              Legal
            </Link>
          </li>
          <li>
            <Link href="/how-it-works" className="hover:text-foreground">
              How it works
            </Link>
          </li>
          <li>
            <Link href="/markets" className="hover:text-foreground">
              Markets
            </Link>
          </li>
        </ul>
      </div>
    </footer>
  );
}
