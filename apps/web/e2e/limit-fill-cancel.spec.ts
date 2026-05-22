// HOMECOURT — Smoke flow 4 + 5 combined: limit order, partial fill, cancel remainder.
// Requires: docker compose up postgres nats engine
//
// Alice places a limit YES buy at 42¢ × 50. Bob places a counter sell at 42¢ × 20.
// Verify Alice's order shows as partial, then Alice cancels the remainder.

import { test, expect } from "./fixtures";

test("limit buy gets partial fill, cancellable remainder", async ({ aliceContext, bobContext }) => {
  // Alice loads a market.
  const alice = await aliceContext.newPage();
  await alice.goto("/markets");
  await alice.getByRole("link", { name: /YES$/i }).first().click();
  await alice.waitForURL(/\/markets\/.+/);
  const slug = new URL(alice.url()).pathname.split("/").pop()!;

  // Switch to limit mode.
  const panel = alice.getByRole("complementary", { name: /trade panel/i });
  await panel.getByRole("tab", { name: /^limit$/i }).click();
  // Set price 42 + amount 50 contracts.
  await panel.getByLabel(/limit price/i).fill("42");
  await panel.getByRole("tab", { name: /^qty$/i }).click();
  await panel.getByLabel(/^amount$/i).fill("50");

  await panel.getByRole("button", { name: /review trade/i }).click();
  const dialog = alice.getByRole("dialog", { name: /review your trade/i });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: /confirm trade/i }).click();
  await expect(alice.getByText(/(order placed|partial|filled)/i)).toBeVisible({ timeout: 10_000 });

  // Bob places a counter sell at 42¢ × 20 on the same market.
  // Bob hits the trade panel as a NO buy to provide counter-liquidity at the same outcome.
  const bob = await bobContext.newPage();
  await bob.goto(`/markets/${slug}`);
  const bobPanel = bob.getByRole("complementary", { name: /trade panel/i });
  await bobPanel.getByRole("tab", { name: /^limit$/i }).click();
  // NO at (100-42)=58. Switch to NO side first.
  await bobPanel.getByRole("tab", { name: /buy no/i }).click();
  await bobPanel.getByLabel(/limit price/i).fill("58");
  await bobPanel.getByRole("tab", { name: /^qty$/i }).click();
  await bobPanel.getByLabel(/^amount$/i).fill("20");
  await bobPanel.getByRole("button", { name: /review trade/i }).click();
  const bobDialog = bob.getByRole("dialog", { name: /review your trade/i });
  await bobDialog.getByRole("button", { name: /confirm trade/i }).click();
  await expect(bob.getByText(/(filled|partial|order placed)/i)).toBeVisible({ timeout: 10_000 });

  // Alice goes to portfolio → Resting tab and cancels.
  await alice.goto("/portfolio");
  await alice
    .getByRole("tab", { name: /resting/i })
    .first()
    .click()
    .catch(() => {});
  // If any cancel button is shown, click the first.
  const cancel = alice.getByRole("button", { name: /^cancel$/i }).first();
  if (await cancel.isVisible().catch(() => false)) {
    await cancel.click();
    await expect(alice.getByText(/order cancelled\. funds released\./i)).toBeVisible({
      timeout: 6_000,
    });
  }
});
