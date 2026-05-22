# HOMECOURT E2E suite (M12)

Ten Playwright smoke flows that gate the build per `BUILD.md §28`. The fixtures
live in `fixtures.ts` and sign demo users in via the
`/api/auth/dev-password-login` route (NODE_ENV-gated to non-prod).

## Run locally

```bash
# From repo root — Playwright spins up its own dev server on port 3010
# so it doesn't fight with Brady's other Next apps running on 3000.
pnpm e2e               # all chromium specs
pnpm e2e:ui            # interactive UI mode

# Run a single flow
pnpm -F web e2e e2e/watchlist.spec.ts

# Update browser binaries the first time
pnpm -F web exec playwright install chromium
```

Override the dev port with `PORT=3020 pnpm e2e` if 3010 is taken.

## What each flow needs

| #  | Spec                          | Requires                                                          |
|----|-------------------------------|-------------------------------------------------------------------|
| 1  | `onboard.spec.ts`             | supabase + `SUPABASE_SERVICE_ROLE_KEY`                            |
| 2  | `limit-fill-cancel.spec.ts`   | supabase + Go engine                                              |
| 3  | `quick-order.spec.ts`         | supabase + Go engine                                              |
| 4  | `sell-from-portfolio.spec.ts` | supabase + Go engine + seeded mock positions                      |
| 5  | `watchlist.spec.ts`           | supabase only                                                     |
| 6  | `filtered-browse.spec.ts`     | supabase only                                                     |
| 7  | `property-detail.spec.ts`     | supabase only                                                     |
| 8  | `comment.spec.ts`             | supabase only                                                     |
| 9  | `settlement.spec.ts`          | supabase + oracle worker + `SUPABASE_SERVICE_ROLE_KEY`            |
| 10 | `csv-export.spec.ts`          | supabase + seeded history                                         |
| —  | `settings.spec.ts`            | supabase only — sub-nav sanity (extra)                            |

Bring the engine + oracle up via `docker compose up postgres nats engine oracle`
before running the trade/settlement flows; otherwise they'll fail to fill or
time out. The non-engine flows (5/6/7/8/10) should be green on plain
`pnpm dev` + a freshly-seeded local Supabase.

## Environment variables

The fixtures read:

- `NEXT_PUBLIC_SUPABASE_URL` (defaults to `http://127.0.0.1:54321`)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` — required only for flows that mutate the DB
  directly (onboarding cleanup + settlement force-expire).
- `E2E_BASE_URL` — override the dev server URL.

## Cleanup

Each spec is designed to be idempotent. The onboarding spec deletes the
test user after the run. The settlement spec leaves the market in
`resolved` state — re-running the seed restores it.
