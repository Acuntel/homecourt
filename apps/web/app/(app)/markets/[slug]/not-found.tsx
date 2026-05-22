import Link from "next/link";
import { Home } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function MarketNotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <Home className="text-muted-fg h-10 w-10" aria-hidden />
      <h1 className="text-2xl font-semibold tracking-tight">Market not found.</h1>
      <p className="text-muted-fg max-w-md text-sm leading-relaxed">
        The market you&apos;re looking for may have settled, been withdrawn, or never existed. Head
        back to the feed to find something to trade.
      </p>
      <Button asChild>
        <Link href="/markets">Back to markets</Link>
      </Button>
    </div>
  );
}
