// HOMECOURT — Settings shell (M12): left sub-nav + right content panel.

import type { Metadata } from "next";

import { SettingsSubNav } from "@/components/settings/settings-sub-nav";

export const metadata: Metadata = {
  title: "Settings",
  description: "Manage your HOMECOURT profile, security, notifications, API keys, and tax docs.",
};

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-fg text-sm">
          Manage your profile, security, notifications, API keys, and tax docs.
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-[200px_1fr]">
        <aside className="md:sticky md:top-20 md:self-start">
          <SettingsSubNav />
        </aside>
        <section className="min-w-0">{children}</section>
      </div>
    </div>
  );
}
