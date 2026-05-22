-- HOMECOURT M2 — 0006_rls_policies.sql
-- Row-level security on every table. Service-role always bypasses RLS.

-- users: select own row only ------------------------------------------------
alter table public.users enable row level security;
drop policy if exists "users_select_self"   on public.users;
drop policy if exists "users_update_self"   on public.users;
create policy "users_select_self" on public.users
  for select using (auth.uid() = id);
create policy "users_update_self" on public.users
  for update using (auth.uid() = id);

-- accounts: select own row only --------------------------------------------
alter table public.accounts enable row level security;
drop policy if exists "accounts_select_self" on public.accounts;
create policy "accounts_select_self" on public.accounts
  for select using (auth.uid() = user_id);

-- properties / listings / markets: public read ----------------------------
alter table public.properties enable row level security;
drop policy if exists "properties_public_read" on public.properties;
create policy "properties_public_read" on public.properties
  for select using (true);

alter table public.listings enable row level security;
drop policy if exists "listings_public_read" on public.listings;
create policy "listings_public_read" on public.listings
  for select using (true);

alter table public.markets enable row level security;
drop policy if exists "markets_public_read" on public.markets;
create policy "markets_public_read" on public.markets
  for select using (true);

-- orders: select own only; inserts via server action only -----------------
alter table public.orders enable row level security;
drop policy if exists "orders_select_self" on public.orders;
create policy "orders_select_self" on public.orders
  for select using (auth.uid() = user_id);
-- NOTE(m2): no insert/update policy — only service role writes here.

-- fills: select own only (joined via orders.user_id) ----------------------
alter table public.fills enable row level security;
drop policy if exists "fills_select_self" on public.fills;
create policy "fills_select_self" on public.fills
  for select using (
    exists (
      select 1 from public.orders o
      where (o.id = taker_order_id or o.id = maker_order_id)
        and o.user_id = auth.uid()
    )
  );

-- journal: select own only -------------------------------------------------
alter table public.journal enable row level security;
drop policy if exists "journal_select_self" on public.journal;
create policy "journal_select_self" on public.journal
  for select using (auth.uid() = user_id);

-- watchlist: own rows only ------------------------------------------------
alter table public.watchlist enable row level security;
drop policy if exists "watchlist_select_self" on public.watchlist;
drop policy if exists "watchlist_insert_self" on public.watchlist;
drop policy if exists "watchlist_delete_self" on public.watchlist;
create policy "watchlist_select_self" on public.watchlist
  for select using (auth.uid() = user_id);
create policy "watchlist_insert_self" on public.watchlist
  for insert with check (auth.uid() = user_id);
create policy "watchlist_delete_self" on public.watchlist
  for delete using (auth.uid() = user_id);

-- comments: public read of non-deleted; insert if uid matches; update only deleted_at by author
alter table public.comments enable row level security;
drop policy if exists "comments_public_read"  on public.comments;
drop policy if exists "comments_insert_self"  on public.comments;
drop policy if exists "comments_update_self"  on public.comments;
create policy "comments_public_read" on public.comments
  for select using (deleted_at is null);
create policy "comments_insert_self" on public.comments
  for insert with check (auth.uid() = user_id);
-- NOTE(m2): full UPDATE allowed only for self; column-level lock-down of body
-- is enforced in app-layer code (server action only writes deleted_at).
create policy "comments_update_self" on public.comments
  for update using (auth.uid() = user_id);

-- comment_votes: own row only --------------------------------------------
alter table public.comment_votes enable row level security;
drop policy if exists "comment_votes_select_public"  on public.comment_votes;
drop policy if exists "comment_votes_modify_self"    on public.comment_votes;
drop policy if exists "comment_votes_delete_self"    on public.comment_votes;
create policy "comment_votes_select_public" on public.comment_votes
  for select using (true);
create policy "comment_votes_modify_self" on public.comment_votes
  for insert with check (auth.uid() = user_id);
create policy "comment_votes_delete_self" on public.comment_votes
  for delete using (auth.uid() = user_id);

-- settlements: public read ------------------------------------------------
alter table public.settlements enable row level security;
drop policy if exists "settlements_public_read" on public.settlements;
create policy "settlements_public_read" on public.settlements
  for select using (true);

-- notifications: own rows only -------------------------------------------
alter table public.notifications enable row level security;
drop policy if exists "notifications_select_self" on public.notifications;
drop policy if exists "notifications_update_self" on public.notifications;
create policy "notifications_select_self" on public.notifications
  for select using (auth.uid() = user_id);
create policy "notifications_update_self" on public.notifications
  for update using (auth.uid() = user_id);

-- engine_snapshots: service-role only (no public policies = no select for anon/auth)
alter table public.engine_snapshots enable row level security;
-- NOTE(m2): intentionally no policies — only service-role reads these.

-- idempotency_keys: service-role only
alter table public.idempotency_keys enable row level security;
-- NOTE(m2): intentionally no policies — only service-role touches this table.
