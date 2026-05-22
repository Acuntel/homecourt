// HOMECOURT — /settings/api-keys (M12).

import { redirect } from "next/navigation";

import { ApiKeysManager } from "@/components/settings/api-keys-manager";
import { SettingsSection } from "@/components/settings/settings-section";
import { createClient } from "@/lib/supabase/server";
import { loadApiKeyStubs } from "@/lib/settings/api-keys";

export const dynamic = "force-dynamic";

export default async function ApiKeysSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const keys = await loadApiKeyStubs(user.id);

  return (
    <SettingsSection
      title="API keys"
      description="Generate sweepstakes-mode keys to script your trades. Keys are display-only in P0."
    >
      <ApiKeysManager initialKeys={keys} />
    </SettingsSection>
  );
}
