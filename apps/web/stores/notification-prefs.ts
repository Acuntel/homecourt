// HOMECOURT — local Zustand store for notification preference toggles.
// P0: persisted to localStorage. Backend wiring is Phase 1.

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type NotificationPrefKey =
  | "orderFills"
  | "marketSettlements"
  | "watchlistPriceAlerts"
  | "newMarketsInCategories";

export const NOTIFICATION_PREF_KEYS: ReadonlyArray<NotificationPrefKey> = [
  "orderFills",
  "marketSettlements",
  "watchlistPriceAlerts",
  "newMarketsInCategories",
];

export const NOTIFICATION_PREF_LABELS: Readonly<Record<NotificationPrefKey, string>> = {
  orderFills: "Order fills",
  marketSettlements: "Market settlements",
  watchlistPriceAlerts: "Price alerts on watchlist",
  newMarketsInCategories: "New markets in followed categories",
};

interface NotificationPrefsState {
  prefs: Record<NotificationPrefKey, boolean>;
  setPref: (key: NotificationPrefKey, value: boolean) => void;
  hydrated: boolean;
  setHydrated: (h: boolean) => void;
}

const DEFAULT_PREFS: Record<NotificationPrefKey, boolean> = {
  orderFills: true,
  marketSettlements: true,
  watchlistPriceAlerts: true,
  newMarketsInCategories: false,
};

export const useNotificationPrefs = create<NotificationPrefsState>()(
  persist(
    (set) => ({
      prefs: DEFAULT_PREFS,
      hydrated: false,
      setHydrated: (hydrated) => set({ hydrated }),
      setPref: (key, value) =>
        set((state) => ({
          prefs: { ...state.prefs, [key]: value },
        })),
    }),
    {
      name: "homecourt:notification-prefs",
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    },
  ),
);
