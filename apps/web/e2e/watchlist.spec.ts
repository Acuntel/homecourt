// HOMECOURT — Smoke flow 5: watchlist add + remove via the heart button.
// Requires: pnpm dev + local Supabase (no engine needed).

import { test, expect } from "./fixtures";

test.describe.serial("watchlist add/remove", () => {
  test("alice can heart a market and see it on /watchlist", async ({ authedPage }) => {
    // Land on /markets and grab the first market card.
    const firstCard = authedPage.getByRole("link", { name: /YES$/i }).first();
    await expect(firstCard).toBeVisible();
    const href = await firstCard.getAttribute("href");
    expect(href).toMatch(/^\/markets\//);

    // Click the heart inside the card. Cards are <a>, the heart is a child <button>.
    const heart = firstCard.getByRole("button", { name: /add to watchlist/i });
    if (await heart.isVisible().catch(() => false)) {
      await heart.click();
      await expect(authedPage.getByText(/added to watchlist/i)).toBeVisible({ timeout: 4_000 });
    }

    // Go to /watchlist and confirm there's at least one card.
    await authedPage.goto("/watchlist");
    await expect(authedPage.getByRole("heading", { name: /^watchlist$/i })).toBeVisible();
    const cards = authedPage.getByRole("link", { name: /YES$/i });
    await expect(cards.first()).toBeVisible({ timeout: 8_000 });

    // Remove via the heart on the watchlist page.
    const removeHeart = cards.first().getByRole("button", { name: /remove from watchlist/i });
    await removeHeart.click();
    await expect(authedPage.getByText(/removed from watchlist/i)).toBeVisible({ timeout: 4_000 });
  });
});
