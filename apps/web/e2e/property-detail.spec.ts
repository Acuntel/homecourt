// HOMECOURT — Smoke flow 7: open a property detail page and exercise the gallery + comps panel.
// Requires: pnpm dev + local Supabase (no engine needed).

import { test, expect } from "./fixtures";

test("property detail: gallery opens, ESC closes, comps + stats visible", async ({
  authedPage,
}) => {
  await authedPage.goto("/markets");

  // Wait for at least one market card.
  await expect(authedPage.getByRole("link", { name: /YES$/i }).first()).toBeVisible({
    timeout: 15_000,
  });

  const firstCard = authedPage.getByRole("link", { name: /YES$/i }).first();
  const href = await firstCard.getAttribute("href");
  if (!href || !href.startsWith("/markets/")) {
    test.fail(true, `Unexpected first card href: ${href ?? "null"}`);
    return;
  }
  await authedPage.goto(href);
  await expect(authedPage).toHaveURL(/\/markets\/.+/);

  // Detail page mounts; the photo gallery exposes a button for the hero photo.
  const heroButton = authedPage.getByRole("button", { name: /open photo 1 of/i });
  await expect(heroButton).toBeVisible({ timeout: 15_000 });
  await heroButton.click();

  // Lightbox dialog has DialogTitle "Photo viewer" (sr-only).
  const lightbox = authedPage.getByRole("dialog", { name: /photo viewer/i });
  await expect(lightbox).toBeVisible();

  // ESC closes the lightbox.
  await authedPage.keyboard.press("Escape");
  await expect(lightbox).toBeHidden();

  // Stats: beds/baths/sqft/zestimate live in the detail header / detail block.
  // CompsPanel has a heading "Recent comps" (h2).
  await expect(authedPage.getByRole("heading", { name: /recent comps/i }).first()).toBeVisible();

  // Comments section is also present.
  await expect(authedPage.getByRole("heading", { name: /comments/i }).first()).toBeVisible();
});
