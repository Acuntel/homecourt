// HOMECOURT — Playwright fixtures for M12 smoke flows.
//
// We expose three fixtures so each spec stays terse:
//   - aliceContext  — a BrowserContext signed in as alice@homecourt.test
//   - bobContext    — a BrowserContext signed in as bob@homecourt.test
//   - authedPage    — convenience: alice's first page, landed on /markets
//
// Sign-in mechanism: POST to /api/auth/dev-password-login (a NODE_ENV-gated
// route) so @supabase/ssr writes the right cookie chunks into the response.
// The BrowserContext picks them up and the next page load is authed.

import { test as base, type BrowserContext, type Page, expect } from "@playwright/test";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";

export const DEMO_PASSWORD = "Homecourt!2026";
export const ALICE_EMAIL = "alice@homecourt.test";
export const BOB_EMAIL = "bob@homecourt.test";

export interface E2EFixtures {
  aliceContext: BrowserContext;
  bobContext: BrowserContext;
  authedPage: Page;
}

async function signInAsViaApi(page: Page, email: string, password: string): Promise<void> {
  const res = await page.request.post("/api/auth/dev-password-login", {
    data: { email, password },
  });
  if (!res.ok()) {
    const body = await res.text();
    throw new Error(`dev-password-login failed for ${email}: ${res.status()} ${body}`);
  }
}

/** Service-role helper for tests that need to mutate DB state directly. */
export function adminClient() {
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY ?? "";
  if (!serviceRole) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for tests that mutate state directly.");
  }
  return createSupabaseClient(SUPABASE_URL, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const test = base.extend<E2EFixtures>({
  aliceContext: async ({ browser }, use) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await signInAsViaApi(page, ALICE_EMAIL, DEMO_PASSWORD);
    await page.close();
    await use(ctx);
    await ctx.close();
  },

  bobContext: async ({ browser }, use) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await signInAsViaApi(page, BOB_EMAIL, DEMO_PASSWORD);
    await page.close();
    await use(ctx);
    await ctx.close();
  },

  authedPage: async ({ aliceContext }, use) => {
    const page = await aliceContext.newPage();
    await page.goto("/markets");
    await expect(page.getByRole("heading", { name: /^markets$/i })).toBeVisible({
      timeout: 15_000,
    });
    await use(page);
    await page.close();
  },
});

export { expect } from "@playwright/test";
