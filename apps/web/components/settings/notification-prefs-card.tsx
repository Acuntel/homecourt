"use client";

import { toast } from "sonner";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  NOTIFICATION_PREF_KEYS,
  NOTIFICATION_PREF_LABELS,
  useNotificationPrefs,
  type NotificationPrefKey,
} from "@/stores/notification-prefs";

export function NotificationPrefsCard() {
  const prefs = useNotificationPrefs((s) => s.prefs);
  const setPref = useNotificationPrefs((s) => s.setPref);

  const handleChange = (key: NotificationPrefKey, value: boolean) => {
    setPref(key, value);
    toast.success("Preferences saved.");
  };

  return (
    <ul className="border-border divide-border bg-card divide-y rounded-md border">
      {NOTIFICATION_PREF_KEYS.map((key) => {
        const id = `pref-${key}`;
        const checked = prefs[key];
        return (
          <li key={key} className="flex items-center justify-between gap-4 px-4 py-3">
            <Label htmlFor={id} className="text-foreground cursor-pointer text-sm font-medium">
              {NOTIFICATION_PREF_LABELS[key]}
            </Label>
            <Switch
              id={id}
              checked={checked}
              onCheckedChange={(value) => handleChange(key, value)}
              aria-label={NOTIFICATION_PREF_LABELS[key]}
            />
          </li>
        );
      })}
    </ul>
  );
}
