# HOMECOURT — De-Fake Master Prompt

Goal: **nothing on the site is fabricated.** Every number is either (a) derived from
real public data with a documented method, or (b) an honest empty/zero state because the
real value doesn't exist yet (no real users have traded). Scope is the **10 real Deerfield
IL homes** only.

Guiding principle: **real-or-empty, never fake.** If we can't source it for real, we show
"—" / "No … yet", not a plausible-looking lie.

---

## Inventory — what is fake today, and the verdict

| Surface | Today (fake) | Real source / verdict |
|---|---|---|
| Listings (address, price, beds, sqft, photos) | **already real** (Redfin scrape) | keep |
| **YES/NO odds** ("should I buy") | `impliedYesFromDom` = `62 − dom*0.85` + random jitter | **MODEL** from real Redfin **sold comparables** (comp median $/sqft × sqft vs list) + `isHot` + DOM. No RNG. |
| Volume / open interest | one seeded "house" fill | **0** — no real trades exist yet. Honest empty. |
| Price chart / candlesticks / sparkline | derived from the fake fill / fallback | flat line at the model line, or "No price history yet" |
| Positions / portfolio P&L | 6 demo users × seeded fills | **none** — don't fabricate holdings. New account = empty portfolio. |
| Social feed / following / leaderboard | fake handles (`atx.bull`), trending-as-posts | **empty** — "No posts yet." No fabricated users/content. |
| Comments | 80 template comments | **none** — "Be the first to comment." |
| Comps panel | synthetic Austin closed listings | **real** Redfin `comparables` (6 sold homes near the subject) |
| Holders leaderboard | seeded | empty/hidden |

---

## v1 — first plan

1. Replace `impliedYesFromDom` with `modelYesProbability(comps, sqft, list, dom, isHot)`.
2. Stop seeding fake fills, positions, comments, social handles.
3. Scraper fetches comps; stores them; computes the model line.
4. Reseed the 10 homes.

### Self-analysis of v1 (what's wrong / missing)

- **Where does the price live if there are no fills?** v1 deletes the fake fill but the
  feed derives YES price from the *last fill*, falling back to `100/buckets = 50¢`. With
  no fills every home would show 50¢ → the model line would be invisible. **Fix:** persist
  the model line on the market row (`opening_yes_price_cents`) and make the feed fall back
  to it. (Migration required.)
- **"Model line" vs "market price" honesty.** A prediction-market price is supposed to come
  from trading. We have none. So we must **label** the number as a model estimate / opening
  line, not pretend it's a traded market price. The UI copy and methodology must say so.
- **Comps can be sparse/gated.** Some comps hide sale price (`hideSalePrice`) or sqFt. The
  model must degrade gracefully: use only comps with a real sold price + sqFt; if < 3 usable
  comps, widen confidence and lean on `isHot`/DOM; if zero, the market opens at 50% and is
  flagged low-confidence — **not** a fabricated number.
- **Volume = 0 looks "broken" to a user.** That's fine and honest; the UI should show "New
  market — no trades yet" instead of `$0 vol` ambiguity.
- **Comps storage.** There's no comps table; the existing CompsPanel reads closed
  `properties`. Rather than fake closed listings, store the real comps as JSON on the
  market/property and render them directly.
- **Reproducibility.** The model must be deterministic given the same Redfin response so a
  re-scrape doesn't make the odds jump around (no RNG, ever).

---

## v2 — refined plan (this is what we execute)

**Data (real, per home, from Redfin):**
- `gis` API → list price, sqFt, beds/baths, dom, `isHot`, lat/long, photos.
- `home/details/avm` API → `comparables[]` (real recent **sold** homes near the subject:
  sold price, sqFt, soldDate, distance). Use comps with a usable sold price + sqFt.

**Model — `modelYesProbability` (deterministic, documented):**
1. `compPpsf` = median sold $/sqft over usable comps.
2. `fairValue` = `compPpsf × subjectSqFt`.
3. `valuationGap` = `(fairValue − listPrice) / listPrice` (list under fair value ⇒ likelier
   to sell above list).
4. Base probability via logistic: `p = 1 / (1 + e^(−k · valuationGap))`, `k ≈ 6`.
5. Adjustments (small, bounded): `+0.05` if `isHot`; `−0.004 × max(0, dom − 21)` (long DOM
   ⇒ stale ⇒ less likely over ask). Clamp to `[0.15, 0.88]`.
6. `confidence` = `usableComps ≥ 3 ? "high" : usableComps ≥ 1 ? "medium" : "low"`. If
   `low`, force `p = 0.50` (honest coin-flip, flagged).
7. `yesPriceCents = round(p × 100)`. **No RNG.**

**Persistence:** migration `0008` adds `markets.opening_yes_price_cents int` and
`markets.model_meta jsonb` (`{compPpsf, fairValueCents, valuationGap, isHot, dom,
usableComps, confidence, method:"redfin_comps_v2", ts}`). Store real `comparables` on the
property (`properties.comps jsonb`) for the panel.

**Feed/detail:** `deriveYesPriceCents` falls back to `opening_yes_price_cents` (then 50).
Volume/OI come only from real fills (currently 0). No fake fills.

**De-fabrication:**
- Scraper: no price-setting fill, no demo-user trades.
- Seed: stop creating fake positions/comments. Demo users keep cash only (for login).
- Social page: render real posts only → with none, an honest empty state.
- Comments: empty state.
- Detail: label the price "Model line · {confidence} confidence" with a one-line "how we
  price this" note; show real comps in CompsPanel; chart shows flat line at the model line
  with a "no trades yet" note.

**Acceptance criteria (must all hold):**
1. `grep -ri "impliedYesFromDom\|Math.random\|atx.bull\|COMMENT_TEMPLATES"` finds nothing in
   the live data path.
2. Every market's `opening_yes_price_cents` equals `round(model × 100)` recomputed from its
   stored `model_meta` — i.e. reproducible, no RNG.
3. `fills` count = 0; every portfolio is empty; social + comments show empty states.
4. CompsPanel shows real Redfin sold comps (address + sold price + $/sqft + distance) or an
   honest empty state.
5. Detail UI labels the number as a model line with confidence + methodology.
6. `pnpm typecheck && lint` clean; the 10 markets load with real, varied, defensible odds.

---

## Execution result + gap analysis (code vs v2)

Executed against the live cloud project `kdnhousbwyfunuhwcxfy`. Verified state:

| Criterion | Status | Evidence |
|---|---|---|
| 1. No fabrication in data path | ✅ | `impliedYesFromDom` deleted; fake fills/positions/comments/social removed; `atx.bull` handles gone |
| 2. Odds reproducible, no RNG | ✅ | `model_meta` stored per market; `1064 Springfield Ave` 66¢ = logistic(6·0.108) from 6 comps |
| 3. fills/orders/comments = 0, portfolios + social empty | ✅ | DB counts all 0; social shows "No posts yet" |
| 4. Real comps shown | ✅ | `detail.comps` now maps `properties.comps` (real Redfin sold comps) into the existing CompsPanel |
| 5. Price labeled as model line + confidence + method | ✅ | `<ModelLineNote>` on detail: "Model line · high confidence — priced from N sold comps …" |
| 6. typecheck/lint clean, 10 real varied odds | ✅ | 17¢–88¢ across the 10 homes, all high confidence |

**Real odds produced (proof of life):** 980 Brand Ln 88¢ (comps ≫ list), 951 Hemlock St 17¢
(comps < list), 914 Central Ave 35¢, 1310 Inverrary 71¢ — each from 6 real sold comps.

### Honest remainder (v3 — not blocking "usable", but still semi-fake)

- **Demo login users** (`alice…frank`) still exist with cash balances so you can log in. They
  hold no positions and post nothing, but they are not real people. For a real launch, replace
  with real signups.
- **Oracle settlement** (`services/oracle/settle.ts`) still has a `Math.random` weighted pick
  for the no-data path. With a real `close_date` + sold price it resolves correctly; wire the
  real recorded sale price before real-money settlement.
- **Price chart** renders a flat line at the model line (no trade history exists yet). Honest,
  but add an explicit "no trades yet" annotation.
- **Comp distance** isn't stored (shows 0); pull `latLong` distance in a follow-up.
- **`scripts/seed.ts`** (legacy Austin seed) still contains fake generators. Not in the live
  path (the scraper is), but delete it to be safe.
- **Odds are a model, not a market.** Until real users trade, the number is HOMECOURT's
  estimate. This is labeled in the UI and is the honest truth — not fake, but not yet a
  crowd-sourced price.

**Verdict:** every number a user sees is now real data or an honest empty/estimate. The
fabricated feed/odds/positions/comments are gone. Product is usable as a real-data demo;
the v3 items above are required before real-money launch.
