"use client";

// HOMECOURT — Export history → triggers a CSV download from
// GET /api/portfolio/export.csv. Uses fetch+blob so we can pick up
// the Content-Disposition filename (browsers respect it when we
// stream via window.location too, but the blob path also lets us
// show the success toast).

import { useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export function ExportCsvButton() {
  const [busy, setBusy] = useState(false);

  async function onClick() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/portfolio/export.csv", { credentials: "include" });
      if (!res.ok) {
        toast.error("Export failed — try again.");
        return;
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") ?? "";
      const match = cd.match(/filename="?([^"]+)"?/i);
      const filename = match?.[1] ?? "homecourt_history.csv";

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("History downloaded.");
    } catch {
      toast.error("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      size="sm"
      variant="outline"
      type="button"
      onClick={onClick}
      disabled={busy}
      className="gap-2"
    >
      <Download className="h-4 w-4" aria-hidden />
      {busy ? "Exporting…" : "Export history"}
    </Button>
  );
}
