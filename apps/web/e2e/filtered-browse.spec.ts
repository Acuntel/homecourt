// HOMECOURT — Smoke flow 6: filter the feed by ZIP + verify URL params.
// Requires: pnpm dev + local Supabase (no engine needed).

import { test, expect } from "./fixtures";

const ZIP = "78704";

test("filter markets by zip 78704 updates URL and feed", async ({ authedPage }) => {
  await authedPage.goto("/markets");

  // Type into the ZIP input + submit. The desktop filter strip uses an Input
  // with aria-label="Filter by ZIP code".
  const zipInput = authedPage.getByLabel(/filter by zip code/i);
  await expect(zipInput).toBeVisible();
  await zipInput.fill(ZIP);
  await zipInput.press("Enter");

  // URL params should now include zip=78704.
  await expect.poll(() => new URL(authedPage.url()).searchParams.get("zip")).toBe(ZIP);

  // Cards visible should all reference 78704. (Markets are seeded across 9 zips.)
  const cards = authedPage.getByRole("link", { name: /YES$/i });
  await expect(cards.first()).toBeVisible({ timeout: 10_000 });

  // Each visible card mentions the zip code somewhere in its text.
  const count = await cards.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < Math.min(count, 6); i++) {
    const card = cards.nth(i);
    await expect(card).toContainText(ZIP);
  }
});
