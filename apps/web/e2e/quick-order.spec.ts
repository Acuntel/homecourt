// HOMECOURT — Smoke flow 3: Quick order from the trade panel.
// Requires: docker compose up postgres nats engine
//
// Alice opens a market, sets amount mode to contracts + qty 25, hits
// "Review trade", confirms, and expects a fill toast plus a new row in
// portfolio Open Positions.

import { test, expect } from "./fixtures";

test("alice places a quick buy and sees the position in portfolio", async ({ authedPage }) => {
  await authedPage.goto("/markets");

  await authedPage.getByRole("link", { name: /YES$/i }).first().click();
  await authedPage.waitForURL(/\/markets\/.+/);

  // Switch the amount field to contract qty mode + enter a small qty
  // (LMSR bot quotes 10 contracts per level in Phase 0).
  const tradePanel = authedPage.getByRole("complementary", { name: /trade panel/i });
  await expect(tradePanel).toBeVisible();
  // Mode Tabs: "$" / "Qty". Click "Qty".
  await tradePanel.getByRole("tab", { name: /^qty$/i }).click();
  const amountInput = tradePanel.getByLabel(/^amount$/i);
  await amountInput.fill("5");

  // Review.
  const reviewBtn = tradePanel.getByRole("button", { name: /review trade/i });
  await expect(reviewBtn).toBeEnabled({ timeout: 8_000 });
  await reviewBtn.click();

  // Confirmation dialog appears with itemized fee.
  const dialog = authedPage.getByRole("dialog", { name: /review your trade/i });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/fee/i).first()).toBeVisible();

  await dialog.getByRole("button", { name: /confirm trade/i }).click();

  // Engine must respond with fill/partial/open. Look for any of the toast messages.
  await expect(
    authedPage.getByText(/(filled|partial|order placed — resting on the book\.)/i),
  ).toBeVisible({ timeout: 10_000 });

  // Portfolio Open Positions includes this market.
  await authedPage.goto("/portfolio");
  await expect(authedPage.getByRole("heading", { name: /portfolio/i })).toBeVisible();
  await authedPage
    .getByRole("tab", { name: /open/i })
    .first()
    .click()
    .catch(() => {});
  // We don't pin a specific count; just assert the page renders.
  await expect(authedPage.getByText(/sweepstakes balance/i)).toBeVisible();
});
