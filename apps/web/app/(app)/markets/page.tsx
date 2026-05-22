import type { Metadata } from "next";

import { WelcomeToast } from "@/components/markets/welcome-toast";

export const metadata: Metadata = {
  title: "Markets",
  description: "Browse HOMECOURT markets — single-family homes, five-bucket binary contracts.",
};

type MarketsPageProps = {
  searchParams: Promise<{ welcome?: string }>;
};

export default async function MarketsPage({ searchParams }: MarketsPageProps) {
  const params = await searchParams;
  const showWelcome = params.welcome === "1";

  return (
    <div className="flex flex-col gap-6">
      {showWelcome ? <WelcomeToast /> : null}

      <header className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Markets</h1>
        <p className="text-muted-fg text-sm">
          Full markets feed lands in M4. Welcome — your starting balance is shown above.
        </p>
      </header>

      <section
        aria-label="Coming soon"
        className="border-border bg-card text-muted-fg flex flex-col gap-2 rounded-md border p-6 text-sm"
      >
        <p className="text-foreground font-medium">M4 ships the listings grid here.</p>
        <p>
          You&apos;ll be able to filter by city, price band, and close date, then dive into any
          listing to see its five-bucket order book.
        </p>
      </section>
    </div>
  );
}
