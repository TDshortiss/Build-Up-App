-- Build Up database setup. Run once in Supabase: SQL Editor → New query → paste → Run.
-- Safe to re-run.

-- Each user's app state (profile, plan, workout logs, rehab progress) as one JSON document.
create table if not exists public.user_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.user_state enable row level security;

drop policy if exists "Read own state" on public.user_state;
create policy "Read own state" on public.user_state
  for select using (auth.uid() = user_id);

drop policy if exists "Insert own state" on public.user_state;
create policy "Insert own state" on public.user_state
  for insert with check (auth.uid() = user_id);

drop policy if exists "Update own state" on public.user_state;
create policy "Update own state" on public.user_state
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Subscription tier. Users can read their own row but never change it; only the server
-- (a future payment webhook using the service role key) can set 'pro'.
create table if not exists public.accounts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  tier text not null default 'free' check (tier in ('free', 'pro')),
  created_at timestamptz not null default now()
);

alter table public.accounts enable row level security;

drop policy if exists "Read own account" on public.accounts;
create policy "Read own account" on public.accounts
  for select using (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.accounts (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Lets a signed-in user permanently delete their own account (required by the App Store and Play Store).
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
