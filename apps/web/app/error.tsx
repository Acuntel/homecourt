"use client";

import { useEffect } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { log } from "@/lib/log";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    log.error({ err: error.message, digest: error.digest }, "app error boundary");
  }, [error]);

  return (
    <div className="bg-background text-foreground flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Something broke on our end.</h1>
      <p className="text-muted-fg max-w-md text-sm leading-relaxed">
        We logged the error — it&apos;ll get a look. In the meantime, you can retry or head back to
        the markets feed.
      </p>
      <div className="flex gap-2">
        <Button onClick={reset} type="button">
          Try again
        </Button>
        <Button variant="outline" type="button" asChild>
          <Link href="/markets">Back to markets</Link>
        </Button>
      </div>
    </div>
  );
}
