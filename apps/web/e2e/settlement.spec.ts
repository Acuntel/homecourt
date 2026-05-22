// HOMECOURT — Smoke flow 9: force-expire a market and wait for the oracle worker
// to settle it. Verifies the ResolutionCard updates to "Resolved".
// Requires: docker compose up postgres nats engine oracle
//          + SUPABASE_SERVICE_ROLE_KEY env (for the admin client)

import { test, expect, adminClient } from "./fixtures";

test("oracle settles an expired market and the UI reflects it", async ({ authedPage }) => {
  // Pick a market to expire. Use the first OPEN market by slug.
  let admin: ReturnType<typeof adminClient>;
  try {
    admin = adminClient();
  } catch {
    test.skip(true, "SUPABASE_SERVICE_ROLE_KEY not set — skipping settlement flow.");
    return;
  }

  const { data: rows, error } = await admin
    .from("markets")
    .select("id, slug, state")
    .eq("state", "open")
    .order("created_at", { ascending: true })
    .limit(1);
  if (error || !rows || rows.length === 0) {
    test.skip(true, "No open markets to settle — seed first.");
    return;
  }
  const target = rows[0]!;

  // Move resolves_at + closes_at into the past so the worker picks it up.
  const past = new Date(Date.now() - 60_000).toISOString();
  const future = new Date(Date.now() + 60_000).toISOString();
  await admin
    .from("markets")
    .update({ resolves_at: past, closes_at: past, opens_at: future })
    .eq("id", target.id);

  // Visit the market page and wait for the oracle to settle.
  await authedPage.goto(`/markets/${target.slug}`);

  // The ResolutionCard renders one of: pending / settled / voided.
  // We poll the DB to see state flip to 'settled' (schema's market_state enum).
  await expect
    .poll(
      async () => {
        const { data } = await admin
          .from("markets")
          .select("state")
          .eq("id", target.id)
          .maybeSingle();
        return data?.state ?? "open";
      },
      { timeout: 90_000, intervals: [2_000, 3_000] },
    )
    .toBe("settled");

  await authedPage.reload();
  await expect(authedPage.getByText(/resolved|settled|final price/i).first()).toBeVisible({
    timeout: 10_000,
  });
});
