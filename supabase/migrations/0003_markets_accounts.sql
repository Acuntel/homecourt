-- HOMECOURT M2 — 0003_markets_accounts.sql
-- markets (5-bucket binary range) + accounts.

do $$ begin
  create type market_state as enum ('upcoming','open','closing','settled','voided');
exception when duplicate_object then null; end $$;

create table if not exists public.markets (
  id                 uuid primary key default gen_random_uuid(),
  slug               text not null unique,
  property_id        uuid not null references public.properties(id) on delete cascade,
  listing_id         uuid not null references public.listings(id)   on delete cascade,
  kind               text not null default 'binary_range_5' check (kind = 'binary_range_5'),
  -- jsonb array of { label, low_cents, high_cents }; must be exactly 5 buckets for binary_range_5
  buckets            jsonb not null check (
    jsonb_typeof(buckets) = 'array' and jsonb_array_length(buckets) = 5
  ),
  opens_at           timestamptz not null,
  closes_at          timestamptz not null,
  resolves_at        timestamptz not null,
  state              market_state not null default 'upcoming',
  oracle_source      text not null default 'mock',
  final_price_cents  bigint,
  final_bucket       int check (final_bucket is null or final_bucket between 0 and 4),
  created_at         timestamptz not null default now()
);

create index if not exists markets_state_idx       on public.markets (state);
create index if not exists markets_property_id_idx on public.markets (property_id);
create index if not exists markets_listing_id_idx  on public.markets (listing_id);
create index if not exists markets_closes_at_idx   on public.markets (closes_at);
create index if not exists markets_resolves_at_idx on public.markets (resolves_at);

create table if not exists public.accounts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null unique references public.users(id) on delete cascade,
  cash_cents    bigint not null default 0 check (cash_cents    >= 0),
  locked_cents  bigint not null default 0 check (locked_cents  >= 0),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists accounts_user_id_idx on public.accounts (user_id);
