// HOMECOURT — /settings/profile (M12).

import { redirect } from "next/navigation";

import { ProfileForm } from "@/components/settings/profile-form";
import { SettingsSection } from "@/components/settings/settings-section";
import { createClient } from "@/lib/supabase/server";

export default async function ProfileSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("username, display_name, email, phone")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <SettingsSection title="Profile" description="Your public identity on HOMECOURT.">
      <ProfileForm
        username={profile?.username ?? ""}
        displayName={profile?.display_name ?? ""}
        email={profile?.email ?? user.email ?? ""}
        phone={profile?.phone ?? ""}
      />
    </SettingsSection>
  );
}
