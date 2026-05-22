// HOMECOURT — /settings/tax (M12).

import Link from "next/link";
import { FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SettingsSection } from "@/components/settings/settings-section";

export default function TaxSettingsPage() {
  return (
    <SettingsSection
      title="Tax documents"
      description="Phase 0 is sweepstakes-mode. No real money moves, so no tax forms are issued."
    >
      <div className="border-border bg-muted/20 flex flex-col items-start gap-2 rounded-md border p-4 text-sm">
        <FileText className="text-muted-fg h-5 w-5" aria-hidden />
        <p className="text-foreground">
          Tax docs will appear here after Phase 0 closes. For now, export your trade history via
          Portfolio.
        </p>
      </div>
      <div>
        <Button asChild variant="outline">
          <Link href="/portfolio?tab=history">Go to portfolio history</Link>
        </Button>
      </div>
    </SettingsSection>
  );
}
