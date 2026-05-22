-- HOMECOURT M2 — 0005_social_settlement.sql
-- watchlist, comments, comment_votes, settlements, notifications, engine_snapshots, idempotency_keys.

do $$ begin
  create type notification_kind as enum (
    'fill','settle','market_open','market_close','reply','mention','deposit'
  );
exception when duplicate_object then null; end $$;

-- watchlist ------------------------------------------------------------------

create table if not exists public.watchlist (
  user_id    uuid not null references public.users(id)   on delete cascade,
  market_id  uuid not null references public.markets(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, market_id)
);

create index if not exists watchlist_market_idx on public.watchlist (market_id);
create index if not exists watchlist_user_idx   on public.watchlist (user_id);

-- comments -------------------------------------------------------------------

create table if not exists public.comments (
  id          uuid primary key default gen_random_uuid(),
  market_id   uuid not null references public.markets(id) on delete cascade,
  user_id     uuid not null references public.users(id)   on delete cascade,
  parent_id   uuid references public.comments(id) on delete cascade,
  body        text not null check (length(body) > 0 and length(body) <= 600),
  score       int  not null default 0,
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create index if not exists comments_market_idx on public.comments (market_id, created_at desc);
create index if not exists comments_parent_idx on public.comments (parent_id);
create index if not exists comments_user_idx   on public.comments (user_id);

-- comment_votes --------------------------------------------------------------

create table if not exists public.comment_votes (
  comment_id uuid not null references public.comments(id) on delete cascade,
  user_id    uuid not null references public.users(id)    on delete cascade,
  value      smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

-- settlements ----------------------------------------------------------------

create table if not exists public.settlements (
  id                 uuid primary key default gen_random_uuid(),
  market_id          uuid not null unique references public.markets(id) on delete cascade,
  final_price_cents  bigint not null check (final_price_cents > 0),
  final_bucket       int    not null check (final_bucket between 0 and 4),
  oracle_payload     jsonb  not null default '{}'::jsonb,
  created_at         timestamptz not null default now()
);

-- notifications --------------------------------------------------------------

create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  kind       notification_kind not null,
  payload    jsonb not null default '{}'::jsonb,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_unread_idx
  on public.notifications (user_id, read_at, created_at desc);

-- engine_snapshots -----------------------------------------------------------

create table if not exists public.engine_snapshots (
  id          bigserial primary key,
  market_id   uuid not null references public.markets(id) on delete cascade,
  taken_at    timestamptz not null default now(),
  book        jsonb not null,
  lmsr_state  jsonb not null,
  last_seq    bigint not null
);

create index if not exists engine_snapshots_market_taken_idx
  on public.engine_snapshots (market_id, taken_at desc);

-- idempotency_keys -----------------------------------------------------------

create table if not exists public.idempotency_keys (
  key         text primary key,
  response    jsonb not null,
  created_at  timestamptz not null default now()
);

create index if not exists idempotency_keys_created_idx
  on public.idempotency_keys (created_at);
