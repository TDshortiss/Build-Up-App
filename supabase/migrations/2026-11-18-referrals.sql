-- Invite a friend. Safe to re-run.
--
-- Every account gets a short invite code (shared as builduptraining.com/?invite=CODE). When someone signs up
-- through that link, the sign-up trigger records who invited them. Once the friend finishes their first workout,
-- the invite counts and both people get bonus XP in the app. Rows are only readable through my_referrals().

-- 1. Invite codes: 6 characters, no look-alikes (0/O, 1/I/L).
create or replace function public.new_invite_code()
returns text language plpgsql set search_path = public as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  c text;
begin
  loop
    c := '';
    for i in 1..6 loop
      c := c || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.accounts where invite_code = c);
  end loop;
  return c;
end;
$$;
revoke all on function public.new_invite_code() from public, anon, authenticated;

alter table public.accounts add column if not exists invite_code text unique;
update public.accounts set invite_code = public.new_invite_code() where invite_code is null;
alter table public.accounts alter column invite_code set default public.new_invite_code();
alter table public.accounts alter column invite_code set not null;

-- 2. Who invited whom. One row per invited friend. No policies: the app reads it only via my_referrals().
create table if not exists public.referrals (
  friend_id uuid primary key references auth.users (id) on delete cascade,
  referrer_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  -- Set once the friend has finished a workout. That's when the invite counts.
  activated_at timestamptz,
  check (friend_id <> referrer_id)
);
create index if not exists referrals_referrer_idx on public.referrals (referrer_id);
alter table public.referrals enable row level security;

-- 3. The sign-up trigger now also records the invite code passed in the sign-up metadata.
-- A bad or unknown code never blocks the sign-up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  code text := upper(nullif(trim(new.raw_user_meta_data ->> 'invite'), ''));
  inviter uuid;
begin
  insert into public.accounts (user_id) values (new.id) on conflict do nothing;
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

-- 4. Everything the app shows about invites, for the signed-in user. Also marks invites as counted once
-- the friend has finished a workout (a completed plan day or one of their own workouts).
create or replace function public.my_referrals()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    return null;
  end if;

  update public.referrals r set activated_at = now()
  where r.activated_at is null
    and (r.referrer_id = me or r.friend_id = me)
    and exists (
      select 1 from public.user_state s
      where s.user_id = r.friend_id
        and (jsonb_path_exists(s.state, '$.logs.*.completedAt ? (@ != null)')
          or jsonb_path_exists(s.state, '$.sessions.* ? (@.completedAt != null && !(@.deleted == true))'))
    );

  return jsonb_build_object(
    'code', (select invite_code from public.accounts where user_id = me),
    'friends', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', split_part(trim(coalesce(s.state -> 'profile' ->> 'name', '')), ' ', 1),
        'joinedAt', r.created_at,
        'activeAt', r.activated_at) order by r.created_at)
      from public.referrals r left join public.user_state s on s.user_id = r.friend_id
      where r.referrer_id = me), '[]'::jsonb),
    'invitedBy', (
      select jsonb_build_object(
        'name', split_part(trim(coalesce(s.state -> 'profile' ->> 'name', '')), ' ', 1),
        'joinedAt', r.created_at,
        'activeAt', r.activated_at)
      from public.referrals r left join public.user_state s on s.user_id = r.referrer_id
      where r.friend_id = me)
  );
end;
$$;
revoke all on function public.my_referrals() from public, anon;
grant execute on function public.my_referrals() to authenticated;
