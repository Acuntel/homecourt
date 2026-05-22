"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function GlobalSignOutButton() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    if (busy) return;
    setBusy(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut({ scope: "global" });
      // Hit our own logout endpoint to clear server-side cookies too.
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => {});
      queryClient.clear();
      toast.success("Signed out everywhere.");
      router.push("/login");
      router.refresh();
    } catch {
      toast.error("Couldn't sign out everywhere. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button type="button" variant="destructive" onClick={onClick} disabled={busy} className="gap-2">
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      ) : (
        <LogOut className="h-4 w-4" aria-hidden />
      )}
      Log out everywhere
    </Button>
  );
}
