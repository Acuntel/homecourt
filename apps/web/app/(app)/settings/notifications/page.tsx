// HOMECOURT — /settings/notifications (M12).

import { NotificationPrefsCard } from "@/components/settings/notification-prefs-card";
import { SettingsSection } from "@/components/settings/settings-section";

export default function NotificationsSettingsPage() {
  return (
    <SettingsSection
      title="Notifications"
      description="Pick what you want to hear about. Preferences sync to this device in P0."
    >
      <NotificationPrefsCard />
    </SettingsSection>
  );
}
