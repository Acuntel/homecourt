// HOMECOURT — Settings sub-nav smoke check (M12 Part A).
// Verifies the 5 settings pages all render with their section header.

import { test, expect } from "./fixtures";

const PAGES: ReadonlyArray<[string, RegExp]> = [
  ["/settings/profile", /profile/i],
  ["/settings/security", /two-factor authentication/i],
  ["/settings/notifications", /^notifications$/i],
  ["/settings/api-keys", /api keys/i],
  ["/settings/tax", /tax documents/i],
];

test("settings sub-nav loads all 5 panels", async ({ authedPage }) => {
  for (const [path, heading] of PAGES) {
    await authedPage.goto(path);
    await expect(authedPage.getByRole("heading", { name: heading }).first()).toBeVisible({
      timeout: 6_000,
    });
  }
});
