-- HOMECOURT M2 — 0001_init_users.sql
-- Extensions + the `users` table that extends auth.users.
-- NOTE(m2): we mirror auth.users.id as the PK on public.users. Created automatically
-- via a trigger that fires after insert on auth.users.

create extension if not exists "pgcrypto";
create extension if not exists "citext";
create extension if not exists "postgis";

-- enums -----------------------------------------------------------------

do $$ begin
  create type kyc_status as enum ('none','pending','approved','rejected');
exception when duplicate_object then null; end $$;

-- users -----------------------------------------------------------------

create table if not exists public.users (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        citext unique not null,
  phone        text,
  username     citext unique,
  display_name text,
  kyc_status   kyc_status not null default 'none',
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz
);

create index if not exists users_email_idx    on public.users (email);
create index if not exists users_username_idx on public.users (username);

-- helper trigger: when a row lands in auth.users, mirror it into public.users.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, username, display_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'username', null),
    coalesce(new.raw_user_meta_data->>'display_name', null)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();
