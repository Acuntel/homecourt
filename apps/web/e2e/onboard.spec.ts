// HOMECOURT — Smoke flow 1: brand-new user onboarding.
// Requires: pnpm dev + local Supabase + SUPABASE_SERVICE_ROLE_KEY env.
//
// We pre-create a fresh user via supabase.auth.admin.createUser (skipping the
// magic-link round-trip), then sign them in via /api/auth/dev-password-login
// and walk through identity → KYC → fund → /markets within 5 minutes.

import { test, expect, adminClient, DEMO_PASSWORD } from "./fixtures";

test("fresh user finishes onboarding and lands on /markets", async ({ browser }) => {
  let admin: ReturnType<typeof adminClient>;
  try {
    admin = adminClient();
  } catch {
    test.skip(true, "SUPABASE_SERVICE_ROLE_KEY not set — skipping onboarding flow.");
    return;
  }

  const stamp = Date.now();
  const email = `e2e-onboard-${stamp}@homecourt.test`;
  const username = `e2eonb${stamp}`.slice(0, 18);

  // 1. Pre-create the auth user. The handle_new_user trigger should seed users + accounts.
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { username, display_name: username },
  });
  if (error || !created.user) {
    test.skip(true, `couldn't create test user: ${error?.message ?? "no user"}`);
    return;
  }
  const userId = created.user.id;

  // Make sure a public.users row exists (the trigger may not run on the
  // demo instance — upsert to be safe).
  await admin.from("users").upsert(
    {
      id: userId,
      email,
      username,
      display_name: null,
      kyc_status: "pending",
    },
    { onConflict: "id" },
  );

  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  const t0 = Date.now();

  // 2. Sign in via the test-only endpoint.
  const res = await page.request.post("/api/auth/dev-password-login", {
    data: { email, password: DEMO_PASSWORD },
  });
  expect(res.ok()).toBeTruthy();

  // 3. Identity step.
  await page.goto("/onboarding/identity");
  await page.getByLabel(/first name/i).fill("E2E");
  await page.getByLabel(/last name/i).fill("Tester");
  await page.getByLabel(/date of birth/i).fill("2000-01-01");
  await page.getByLabel(/mobile phone/i).fill("+15555550100");
  await page.getByRole("button", { name: /send 6-digit code/i }).click();
  await page.getByLabel(/6-digit code/i).fill("000000");
  await page.getByRole("button", { name: /verify/i }).click();

  // 4. KYC step.
  await page.waitForURL(/\/onboarding\/kyc/, { timeout: 10_000 });
  await page.getByRole("button", { name: /skip kyc for sweepstakes/i }).click();

  // 5. 2FA step → skip.
  await page.waitForURL(/\/onboarding\/twofa/, { timeout: 10_000 });
  await page.getByRole("button", { name: /^skip$/i }).click();

  // 6. Fund step — the DepositSheet auto-opens with $500. Submit the form.
  await page.waitForURL(/\/onboarding\/fund/, { timeout: 10_000 });
  const depositBtn = page.getByRole("button", { name: /add play-money coins/i }).first();
  await expect(depositBtn).toBeVisible({ timeout: 8_000 });
  await depositBtn.click();

  // 7. Lands on /markets with the welcome toast.
  await page.waitForURL(/\/markets/, { timeout: 15_000 });
  await expect(
    page.getByText(/welcome to homecourt — here's \$500 in play-money to start\./i).first(),
  ).toBeVisible({ timeout: 6_000 });

  const elapsedMs = Date.now() - t0;
  expect(elapsedMs).toBeLessThan(5 * 60_000);

  await ctx.close();

  // Clean up the test user.
  await admin.auth.admin.deleteUser(userId).catch(() => {});
});
