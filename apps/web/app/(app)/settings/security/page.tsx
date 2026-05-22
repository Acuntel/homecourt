// HOMECOURT — /settings/security (M12).

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { GlobalSignOutButton } from "@/components/settings/global-sign-out-button";
import { SettingsSection } from "@/components/settings/settings-section";

export default function SecuritySettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <SettingsSection
        title="Two-factor authentication"
        description="Add a second factor for extra protection. Sweepstakes mode keeps it optional."
      >
        <div className="border-border bg-muted/30 flex items-center justify-between gap-4 rounded-md border p-4">
          <div className="flex flex-col">
            <p className="text-foreground text-sm font-medium">Sweepstakes mode — 2FA optional</p>
            <p className="text-muted-fg text-xs">
              2FA is required before you can withdraw real funds (Phase 1).
            </p>
          </div>
          <span className="bg-court-500/10 text-court-500 rounded-full px-2.5 py-1 text-xs font-medium">
            Optional
          </span>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Password"
        description="HOMECOURT uses passwordless magic-links — request a fresh link to sign in or rotate access."
      >
        <div>
          <Button asChild variant="outline" className="gap-2">
            <Link href="/login">Change password</Link>
          </Button>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Active sessions"
        description="Sign out everywhere if you've left a session open on a device you no longer control."
      >
        <ul className="border-border divide-border bg-muted/20 divide-y rounded-md border text-sm">
          <li className="flex items-center justify-between px-4 py-3">
            <span className="text-foreground">Current device</span>
            <span className="text-muted-fg text-xs">This browser</span>
          </li>
          <li className="text-muted-fg flex items-center justify-between px-4 py-3 text-xs">
            <span>Other devices</span>
            <span>(coming soon)</span>
          </li>
        </ul>
        <div>
          <GlobalSignOutButton />
        </div>
      </SettingsSection>
    </div>
  );
}
