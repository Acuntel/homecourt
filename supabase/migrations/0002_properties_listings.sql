-- HOMECOURT M2 — 0002_properties_listings.sql
-- properties + listings.

do $$ begin
  create type listing_status as enum ('active','pending','closed','cancelled');
exception when duplicate_object then null; end $$;

create table if not exists public.properties (
  id              uuid primary key default gen_random_uuid(),
  address         text not null,
  city            text not null,
  state           char(2) not null,
  zip             text not null,
  lat             numeric(9,6) not null,
  lng             numeric(9,6) not null,
  beds            int  not null check (beds between 0 and 20),
  baths           numeric(3,1) not null check (baths >= 0 and baths <= 20),
  sqft            int  not null check (sqft > 0),
  year_built      int  not null check (year_built between 1800 and 2100),
  lot_sqft        int  check (lot_sqft is null or lot_sqft > 0),
  zestimate_cents bigint not null check (zestimate_cents > 0),
  photos          jsonb not null default '[]'::jsonb,
  geo             geography(point, 4326) not null,
  created_at      timestamptz not null default now()
);

create index if not exists properties_zip_idx   on public.properties (zip);
create index if not exists properties_state_idx on public.properties (state);
create index if not exists properties_geo_idx   on public.properties using gist (geo);
create index if not exists properties_beds_idx  on public.properties (beds);

create table if not exists public.listings (
  id               uuid primary key default gen_random_uuid(),
  property_id      uuid not null references public.properties(id) on delete cascade,
  mls_id           text,
  list_price_cents bigint not null check (list_price_cents > 0),
  list_date        date not null,
  close_date       date,
  status           listing_status not null default 'active',
  created_at       timestamptz not null default now()
);

create index if not exists listings_property_id_idx on public.listings (property_id);
create index if not exists listings_status_idx      on public.listings (status);
create index if not exists listings_list_date_idx   on public.listings (list_date);
create unique index if not exists listings_mls_id_uq on public.listings (mls_id) where mls_id is not null;
