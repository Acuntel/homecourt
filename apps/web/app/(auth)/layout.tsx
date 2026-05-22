import Link from "next/link";

import { Wordmark } from "@/components/marketing/wordmark";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-background text-foreground flex min-h-screen flex-col">
      <header className="border-border/60 border-b">
        <div className="container flex h-14 items-center justify-between">
          <Link href="/" aria-label="HOMECOURT home">
            <Wordmark />
          </Link>
          <Link href="/markets" className="text-muted-fg hover:text-foreground text-sm">
            Browse markets
          </Link>
        </div>
      </header>

      <main id="main" className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="border-border bg-card flex w-full max-w-md flex-col gap-6 rounded-xl border p-7 shadow-sm">
          {children}
        </div>
      </main>

      <footer className="border-border/60 border-t">
        <div className="container py-6">
          <p className="text-muted-fg text-[11px] leading-relaxed">
            HOMECOURT Phase 0 is a free-to-play sweepstakes. No purchase necessary. Void where
            prohibited.
          </p>
        </div>
      </footer>
    </div>
  );
}
