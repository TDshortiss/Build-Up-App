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

-- Where each account came from (the link they arrived through, if any). Saved at sign-up from the app's
-- "src" sign-up metadata. Users can read it on their own row but can't change it.
alter table public.accounts
  add column if not exists signup_source text,
  add column if not exists signup_medium text,
  add column if not exists signup_campaign text,
  add column if not exists signup_content text,
  add column if not exists signup_referrer text,
  add column if not exists signup_landing text;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  src jsonb := case when jsonb_typeof(new.raw_user_meta_data -> 'src') = 'object' then new.raw_user_meta_data -> 'src' else '{}'::jsonb end;
begin
  insert into public.accounts (user_id, signup_source, signup_medium, signup_campaign, signup_content, signup_referrer, signup_landing)
  values (
    new.id,
    nullif(left(lower(trim(src ->> 'source')), 100), ''),
    nullif(left(lower(trim(src ->> 'medium')), 100), ''),
    nullif(left(lower(trim(src ->> 'campaign')), 100), ''),
    nullif(left(lower(trim(src ->> 'content')), 100), ''),
    nullif(left(lower(trim(src ->> 'referrer')), 100), ''),
    nullif(left(trim(src ->> 'landing'), 200), '')
  )
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Only the trigger should run this, never the public API.
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- Lets a signed-in user permanently delete their own account (required by the App Store and Play Store).
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- Arrivals through a tagged link (?utm_source=…, builduptraining.com/ig) or from another website.
-- No cookies, ids or IP addresses: just which link, and when. Anyone can add a row; nobody can read
-- them through the app's API. Read them in the Supabase dashboard (see signup_sources below).
create table if not exists public.visits (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  source text not null check (char_length(source) between 1 and 100),
  medium text check (char_length(medium) <= 100),
  campaign text check (char_length(campaign) <= 100),
  content text check (char_length(content) <= 100),
  referrer text check (char_length(referrer) <= 100),
  landing text check (char_length(landing) <= 200)
);

alter table public.visits enable row level security;

drop policy if exists "Anyone can log a visit" on public.visits;
create policy "Anyone can log a visit" on public.visits
  for insert to anon, authenticated with check (true);

revoke all on public.visits from anon, authenticated;
grant insert (source, medium, campaign, content, referrer, landing) on public.visits to anon, authenticated;

-- Visits and sign-ups per link. In the dashboard: SQL Editor → `select * from signup_sources;`
-- "direct" sign-ups came without a tracked link (typed the address, word of mouth, or older accounts).
create or replace view public.signup_sources with (security_invoker = true) as
select
  coalesce(source, 'direct') as source,
  coalesce(medium, '') as medium,
  coalesce(campaign, '') as campaign,
  coalesce(content, '') as content,
  sum(visits)::int as visits,
  sum(signups)::int as signups
from (
  select source, medium, campaign, content, count(*) as visits, 0 as signups
  from public.visits group by 1, 2, 3, 4
  union all
  select signup_source, signup_medium, signup_campaign, signup_content, 0, count(*)
  from public.accounts group by 1, 2, 3, 4
) t
group by 1, 2, 3, 4
order by signups desc, visits desc;

revoke all on public.signup_sources from public, anon, authenticated;
