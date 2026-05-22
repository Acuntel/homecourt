"use client";

// HOMECOURT — small client button that DELETEs a resting order.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

interface ApiErr {
  error: string;
  message?: string;
}

interface CancelOrderButtonProps {
  orderId: string;
}

export function CancelOrderButton({ orderId }: CancelOrderButtonProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [, startTransition] = useTransition();

  async function onClick() {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({ error: "request_failed" }))) as ApiErr;
        toast.error(err.message ?? err.error ?? "Cancel failed.");
        return;
      }
      toast.success("Order cancelled. Funds released.");
      startTransition(() => router.refresh());
    } catch {
      toast.error("Network error — try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Button
      size="sm"
      variant="outline"
      type="button"
      onClick={onClick}
      disabled={submitting}
      className="h-7 px-2 text-xs"
    >
      {submitting ? "Cancelling…" : "Cancel"}
    </Button>
  );
}
