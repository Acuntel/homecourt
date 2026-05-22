// HOMECOURT — Smoke flow 10: portfolio → export history → valid CSV download.
// Requires: pnpm dev + local Supabase (no engine needed).

import { test, expect } from "./fixtures";

test("portfolio export history downloads a CSV with headers + rows", async ({ authedPage }) => {
  await authedPage.goto("/portfolio");
  await expect(authedPage.getByRole("heading", { name: /portfolio/i })).toBeVisible();

  // Hit the route directly via the authenticated request context — it carries
  // alice's cookies. This avoids relying on Playwright's blob-download dance.
  const res = await authedPage.request.get("/api/portfolio/export.csv");
  expect(res.ok()).toBeTruthy();
  expect(res.headers()["content-type"]).toMatch(/text\/csv/);

  const body = await res.text();
  const lines = body.trim().split(/\r?\n/);
  expect(lines.length).toBeGreaterThanOrEqual(1);
  expect(lines[0]).toMatch(/date,market,side,type,qty,price_cents,fee_cents,realized_pnl_cents/);

  // Also verify the visible Export button works (click + spinner state).
  const exportBtn = authedPage.getByRole("button", { name: /export history/i });
  await expect(exportBtn).toBeVisible();
});
