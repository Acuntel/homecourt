import type { Metadata } from "next";
import Link from "next/link";
import { MailCheck, AlertTriangle } from "lucide-react";

export const metadata: Metadata = {
  title: "Check your inbox",
  description: "We sent a magic link to finish signing into HOMECOURT.",
};

const ERROR_COPY: Record<string, { title: string; detail: string }> = {
  auth_callback_failed: {
    title: "That link didn't work.",
    detail:
      "Your magic link may have expired or already been used. Request a fresh one from the login screen.",
  },
  expired: {
    title: "Link expired.",
    detail: "Magic links expire after a short window. Request a new one and try again.",
  },
};

type VerifyPageProps = {
  searchParams: Promise<{ status?: string; error?: string; email?: string }>;
};

export default async function VerifyPage({ searchParams }: VerifyPageProps) {
  const params = await searchParams;
  const errorKey = params.error ?? null;
  const status = params.status ?? null;
  const email = params.email ?? null;

  if (errorKey) {
    const copy = ERROR_COPY[errorKey] ??
      ERROR_COPY.auth_callback_failed ?? {
        title: "Something went wrong.",
        detail: "Please try again.",
      };
    return (
      <div className="flex w-full flex-col gap-5">
        <div className="border-no-500/30 bg-no-500/5 flex items-start gap-3 rounded-md border p-4">
          <AlertTriangle className="text-no-500 mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <div className="flex flex-col gap-1">
            <p className="text-foreground text-sm font-medium">{copy.title}</p>
            <p className="text-muted-fg text-xs leading-relaxed">{copy.detail}</p>
          </div>
        </div>
        <div className="flex flex-col gap-2 text-sm">
          <Link href="/login" className="text-cobalt-500 underline-offset-2 hover:underline">
            Back to log in
          </Link>
          <Link
            href="/signup"
            className="text-muted-fg hover:text-foreground underline-offset-2 hover:underline"
          >
            Create a new account
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-5">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-xl font-semibold tracking-tight">Check your inbox.</h1>
        <p className="text-muted-fg text-sm">
          We sent {email ? <span className="text-foreground">{email}</span> : "you"} a magic link.
          Open it in this browser to finish signing in.
        </p>
      </header>

      <div className="border-court-500/30 bg-court-500/5 flex items-start gap-3 rounded-md border p-4">
        <MailCheck className="text-court-500 mt-0.5 h-5 w-5 shrink-0" aria-hidden />
        <div className="flex flex-col gap-1">
          <p className="text-foreground text-sm font-medium">
            {status === "sent" ? "Magic link sent." : "Waiting for verification."}
          </p>
          <p className="text-muted-fg text-xs leading-relaxed">
            The link expires in 10 minutes. If you don&apos;t see it, check spam or request another
            from the log-in page.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2 text-sm">
        <Link href="/login" className="text-cobalt-500 underline-offset-2 hover:underline">
          Request a new magic link
        </Link>
        <Link
          href="/"
          className="text-muted-fg hover:text-foreground underline-offset-2 hover:underline"
        >
          Back home
        </Link>
      </div>
    </div>
  );
}
