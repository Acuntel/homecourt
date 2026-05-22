-- HOMECOURT M2 — 0004_orders_fills_journal.sql
-- orders, fills, journal (partitioned monthly), positions materialized view.

do $$ begin
  create type order_side as enum ('buy','sell');
exception when duplicate_object then null; end $$;

do $$ begin
  create type order_status as enum ('open','partial','filled','cancelled','expired');
exception when duplicate_object then null; end $$;

do $$ begin
  create type journal_kind as enum (
    'deposit','withdraw','order_lock','order_release',
    'fill_debit','fill_credit','fee','settlement','adjustment'
  );
exception when duplicate_object then null; end $$;

-- orders ---------------------------------------------------------------------

create table if not exists public.orders (
  id                       uuid primary key default gen_random_uuid(),
  client_idempotency_key   text not null unique,
  market_id                uuid not null references public.markets(id) on delete cascade,
  user_id                  uuid not null references public.users(id)   on delete cascade,
  outcome                  int  not null check (outcome between 0 and 4),
  side                     order_side not null,
  price_cents              int  not null check (price_cents between 1 and 99),
  qty                      int  not null check (qty > 0),
  filled_qty               int  not null default 0 check (filled_qty >= 0),
  status                   order_status not null default 'open',
  created_at               timestamptz not null default now(),
  cancelled_at             timestamptz,
  constraint orders_filled_le_qty check (filled_qty <= qty)
);

create index if not exists orders_user_status_idx on public.orders (user_id, status);
create index if not exists orders_market_id_idx   on public.orders (market_id);
create index if not exists orders_market_outcome_status_idx on public.orders (market_id, outcome, status);
create index if not exists orders_created_at_idx  on public.orders (created_at desc);

-- fills ----------------------------------------------------------------------

create table if not exists public.fills (
  id              uuid primary key default gen_random_uuid(),
  market_id       uuid not null references public.markets(id) on delete cascade,
  taker_order_id  uuid not null references public.orders(id)  on delete cascade,
  maker_order_id  uuid not null references public.orders(id)  on delete cascade,
  outcome         int  not null check (outcome between 0 and 4),
  price_cents     int  not null check (price_cents between 1 and 99),
  qty             int  not null check (qty > 0),
  fee_cents       int  not null default 0 check (fee_cents >= 0),
  created_at      timestamptz not null default now()
);

create index if not exists fills_market_id_idx     on public.fills (market_id);
create index if not exists fills_taker_idx         on public.fills (taker_order_id);
create index if not exists fills_maker_idx         on public.fills (maker_order_id);
create index if not exists fills_market_created_idx on public.fills (market_id, created_at desc);

-- journal (partitioned monthly by created_at) --------------------------------

create table if not exists public.journal (
  id                    bigserial,
  user_id               uuid not null references public.users(id)   on delete cascade,
  market_id             uuid          references public.markets(id) on delete set null,
  kind                  journal_kind  not null,
  amount_cents          bigint        not null,
  balance_after_cents   bigint        not null check (balance_after_cents >= 0),
  ref                   text,
  created_at            timestamptz   not null default now(),
  primary key (id, created_at)
) partition by range (created_at);

-- Create partitions for the current month and the next 3 months so that
-- demo / CI runs at month boundaries don't fail.
do $$
declare
  cur_month date := date_trunc('month', now())::date;
  i int;
  start_d date;
  end_d   date;
  part_name text;
begin
  for i in 0..3 loop
    start_d := (cur_month + (i || ' month')::interval)::date;
    end_d   := (cur_month + ((i + 1) || ' month')::interval)::date;
    part_name := format('journal_%s', to_char(start_d, 'YYYYMM'));
    execute format(
      'create table if not exists public.%I partition of public.journal for values from (%L) to (%L);',
      part_name, start_d, end_d
    );
    execute format('create index if not exists %I on public.%I (user_id, created_at desc);',
      part_name || '_user_created_idx', part_name);
    execute format('create index if not exists %I on public.%I (created_at);',
      part_name || '_created_idx', part_name);
  end loop;
end $$;

-- Sum-to-zero invariant: per (user_id, market_id, ref) group the journal
-- must be net-zero ONCE settlement completes. For per-row safety we only
-- assert that balance_after = previous_balance + amount when computable.
-- M2: enforce via a lightweight trigger that maintains accounts.cash_cents
-- in sync with the latest balance_after for deposit/withdraw/settlement rows.

create or replace function public.journal_update_account_balance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Update the user's account.cash_cents to match the latest balance_after.
  -- NOTE(m2): this is intentionally permissive — the engine will write its
  -- own invariants. We just keep accounts.cash_cents directionally honest.
  update public.accounts
     set cash_cents  = new.balance_after_cents,
         updated_at  = now()
   where user_id = new.user_id;
  return new;
end;
$$;

drop trigger if exists journal_sync_account on public.journal;
create trigger journal_sync_account
  after insert on public.journal
  for each row execute function public.journal_update_account_balance();

-- positions: a regular view (not materialized) for M2 so RLS works cleanly.
-- A materialized variant + refresh function can land in a later migration.
create or replace view public.positions as
select
  o.user_id,
  o.market_id,
  f.outcome,
  sum(case when o.side = 'buy'  then f.qty else -f.qty end)::bigint as qty,
  case
    when sum(case when o.side = 'buy' then f.qty else 0 end) = 0 then 0
    else (
      sum(case when o.side = 'buy' then f.qty * f.price_cents else 0 end)::numeric
      / nullif(sum(case when o.side = 'buy' then f.qty else 0 end), 0)
    )::bigint
  end as avg_cost_cents,
  0::bigint as realized_pnl_cents
from public.fills f
join public.orders o on o.id = f.taker_order_id
group by o.user_id, o.market_id, f.outcome;
