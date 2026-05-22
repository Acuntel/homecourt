// HOMECOURT — Smoke flow 4 (sell side): close an existing position from the portfolio Open tab.
// Requires: docker compose up postgres nats engine
//
// Alice has seeded mock positions across ~30 markets — clicking [Sell] on the first
// open position fires a counter-market-order at 1¢/99¢ and shows a toast.

import { test, expect } from "./fixtures";

test("alice can sell an open position from /portfolio", async ({ authedPage }) => {
  await authedPage.goto("/portfolio");
  await expect(authedPage.getByRole("heading", { name: /portfolio/i })).toBeVisible();

  // Make sure we're on Open tab.
  await authedPage
    .getByRole("tab", { name: /open/i })
    .first()
    .click()
    .catch(() => {});

  const sellBtns = authedPage.getByRole("button", { name: /^sell$/i });
  await expect(sellBtns.first()).toBeVisible({ timeout: 10_000 });
  await sellBtns.first().click();

  // Either fill / partial / placed toast is acceptable.
  await expect(
    authedPage.getByText(
      /(filled — \d+ contracts\.|partial — \d+ filled|sell order placed — resting on the book\.)/i,
    ),
  ).toBeVisible({ timeout: 10_000 });
});
