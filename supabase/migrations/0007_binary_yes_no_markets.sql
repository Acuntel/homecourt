-- HOMECOURT — 0007_binary_yes_no_markets.sql
-- Relax the markets table to support binary YES/NO (above/below list price)
-- markets in addition to the original 5-bucket range markets.
--
--   kind 'binary_yes_no' → exactly 2 buckets:
--     idx 0 = "Sells at or below $X"  (low 0, high listPrice)
--     idx 1 = "Sells above $X"        (low listPrice, high cap)   ← YES / anchor
--
-- The feed, engine (PricesFromZestimate/BucketForCents) and oracle
-- (bucketForCents, weights sized to buckets.length) are already generic over
-- N buckets, so no application/engine changes are required.

-- kind: allow the new binary kind alongside the legacy range kind.
alter table public.markets drop constraint if exists markets_kind_check;
alter table public.markets
  add constraint markets_kind_check
  check (kind in ('binary_range_5', 'binary_yes_no'));

-- buckets: allow 2..5 entries (was: exactly 5).
alter table public.markets drop constraint if exists markets_buckets_check;
alter table public.markets
  add constraint markets_buckets_check
  check (
    jsonb_typeof(buckets) = 'array'
    and jsonb_array_length(buckets) between 2 and 5
  );

-- final_bucket already allows 0..4, which covers binary indices 0/1.
