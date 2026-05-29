-- HOMECOURT — 0008_model_line.sql
-- Persist the data-derived opening line so markets show a real, documented
-- probability WITHOUT any fabricated trades. Volume/positions stay genuinely
-- empty until real users trade.

-- Opening YES price (1..99¢) = round(modelProbability * 100), from real comps.
alter table public.markets
  add column if not exists opening_yes_price_cents int
  check (opening_yes_price_cents is null or opening_yes_price_cents between 1 and 99);

-- How that line was computed (compPpsf, fairValueCents, valuationGap, isHot,
-- dom, usableComps, confidence, method, ts) — fully auditable, no RNG.
alter table public.markets
  add column if not exists model_meta jsonb;

-- Real Redfin sold comparables for the subject property (for the comps panel).
alter table public.properties
  add column if not exists comps jsonb;
