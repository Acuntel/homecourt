// HOMECOURT — Smoke flow 8: alice posts a comment that renders + persists.
// Requires: pnpm dev + local Supabase (no engine needed).
//
// Two-user (alice + bob) reply + upvote flow is covered by manual QA in P0 —
// it gets racy in headless Chromium because comments don't push over WS.
// What M12 needs verified here is that a user can post a comment via the
// composer, see it inline, and re-read it after a reload (server round-trip
// + persistence + render).

import { test, expect } from "./fixtures";

const STAMP = `${Date.now()}`;
const COMMENT_BODY = `e2e top-level ${STAMP}`;

test("alice posts a comment that renders + persists across reload", async ({ authedPage }) => {
  await authedPage.goto("/markets");
  await authedPage.getByRole("link", { name: /YES$/i }).first().click();
  await authedPage.waitForURL(/\/markets\/.+/);
  const slug = new URL(authedPage.url()).pathname.split("/").pop()!;

  // Post a fresh top-level comment via the composer.
  await authedPage.getByRole("heading", { name: /comments/i }).scrollIntoViewIfNeeded();
  await authedPage.getByPlaceholder(/post a comment/i).fill(COMMENT_BODY);
  await authedPage.getByRole("button", { name: /^post$/i }).click();
  await expect(authedPage.getByText(COMMENT_BODY).first()).toBeVisible({ timeout: 10_000 });

  // Reload — the comment was actually persisted, not just optimistically rendered.
  await authedPage.goto(`/markets/${slug}`);
  await authedPage.getByRole("heading", { name: /comments/i }).scrollIntoViewIfNeeded();
  await expect(authedPage.getByText(COMMENT_BODY).first()).toBeVisible({ timeout: 10_000 });
});
