-- Where visitors and sign-ups come from. Safe to re-run. Run after 2026-11-18-referrals.sql.
--
-- The app sends two optional things with a sign-up: "src" (the tagged link or website they arrived from, if any)
-- and "heard" (their answer to "How did you hear about Build Up?"). The sign-up trigger saves both on the account.
-- Arrivals through tagged links are also counted in public.visits, with no cookies, ids or IP addresses.
-- See the numbers in the SQL Editor: select * from signup_sources;  and  select * from heard_about_us;

-- 1. Sign-up source on each account. Users can read their own row but can't change it.
alter table public.accounts
  add column if not exists signup_source text,
  add column if not exists signup_medium text,
  add column if not exists signup_campaign text,
  add column if not exists signup_content text,
  add column if not exists signup_referrer text,
  add column if not exists signup_landing text,
  add column if not exists signup_heard text;

-- 2. The sign-up trigger: invite code (unchanged from the referrals migration) plus the source fields.
-- Bad or missing values never block a sign-up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  src jsonb := case when jsonb_typeof(meta -> 'src') = 'object' then meta -> 'src' else '{}'::jsonb end;
  code text := upper(nullif(trim(meta ->> 'invite'), ''));
  inviter uuid;
begin
  insert into public.accounts (user_id) values (new.id) on conflict do nothing;

  begin
    update public.accounts set
      signup_source   = nullif(left(lower(trim(src ->> 'source')), 100), ''),
      signup_medium   = nullif(left(lower(trim(src ->> 'medium')), 100), ''),
      signup_campaign = nullif(left(lower(trim(src ->> 'campaign')), 100), ''),
      signup_content  = nullif(left(lower(trim(src ->> 'content')), 100), ''),
      signup_referrer = nullif(left(lower(trim(src ->> 'referrer')), 100), ''),
      signup_landing  = nullif(left(trim(src ->> 'landing'), 200), ''),
      signup_heard    = nullif(left(lower(trim(meta ->> 'heard')), 40), '')
    where user_id = new.id;
  exception when others then
    null;
  end;

  if code is not null then
    begin
      select user_id into inviter from public.accounts where invite_code = code and user_id <> new.id;
      if inviter is not null then
        insert into public.referrals (friend_id, referrer_id) values (new.id, inviter) on conflict do nothing;
      end if;
    exception when others then
      null;
    end;
  end if;
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- 3. Arrivals through a tagged link (?utm_source=…, builduptraining.com/ig), an invite link, or another website.
-- Anyone can add a row; nobody can read them through the app's API.
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

-- 4. Reports (dashboard only, not exposed to the app).
-- Visits and sign-ups per link. "direct" = signed up without a tracked link (typed the address, or older accounts).
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

-- Answers to "How did you hear about Build Up?"
create or replace view public.heard_about_us with (security_invoker = true) as
select coalesce(signup_heard, 'no answer') as answer, count(*)::int as signups
from public.accounts
group by 1
order by signups desc;
revoke all on public.heard_about_us from public, anon, authenticated;
