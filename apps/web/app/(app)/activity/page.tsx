// HOMECOURT — /activity (M8): chronological feed of deposits, orders, fills,
// cancels, and settlements. CSV export button at the top.

import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { ActivityFeed } from "@/components/portfolio/activity-feed";
import { ExportCsvButton } from "@/components/portfolio/export-csv-button";
import { loadActivity } from "@/lib/portfolio/activity";

export const metadata: Metadata = {
  title: "Activity",
  description: "Chronological HOMECOURT activity — deposits, orders, fills, and settlements.",
};

export default async function ActivityPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const events = await loadActivity(user.id, { limit: 200 });

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Activity</h1>
          <p className="text-muted-fg text-sm">
            Every deposit, order, fill, cancel, and settlement on your account.
          </p>
        </div>
        <ExportCsvButton />
      </header>

      <ActivityFeed events={events} />
    </div>
  );
}
