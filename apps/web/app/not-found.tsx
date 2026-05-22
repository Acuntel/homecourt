import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="bg-background text-foreground flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">We couldn&apos;t find that page.</h1>
      <p className="text-muted-fg max-w-md text-sm leading-relaxed">
        The link may be stale, the market may have been withdrawn, or you may have wandered off the
        path. Head home and try again.
      </p>
      <div className="flex gap-2">
        <Button asChild>
          <Link href="/markets">Browse markets</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/">Home</Link>
        </Button>
      </div>
    </div>
  );
}
