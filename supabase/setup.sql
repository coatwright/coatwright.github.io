-- Coatwright accounts: one free trial per email.
-- Paste this whole file into Supabase → SQL Editor → New query → Run. Safe to run more than once.
--
-- What it does
--   • trial_claims: remembers every email (normalized) that has started a trial, with the start time.
--     Nobody can read or change it from the app.
--   • profiles: one row per account with its trial start. Each user can read only their own row and
--     cannot change it.
--   • A trigger fills both when someone signs up, so signing up again with the same email (or a Gmail
--     "+" / "." variation) never starts a new trial.

-- 1. Normalize emails so variations count as the same address --------------------------------------
create or replace function public.normalize_email(e text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when e is null or position('@' in e) = 0 then lower(trim(e))
    when split_part(lower(trim(e)), '@', 2) in ('gmail.com', 'googlemail.com') then
      replace(split_part(split_part(lower(trim(e)), '@', 1), '+', 1), '.', '') || '@gmail.com'
    else
      split_part(split_part(lower(trim(e)), '@', 1), '+', 1) || '@' || split_part(lower(trim(e)), '@', 2)
  end
$$;

-- 2. Trial claims (private) --------------------------------------------------------------------------
create table if not exists public.trial_claims (
  email_norm text primary key,
  claimed_at timestamptz not null default now()
);
alter table public.trial_claims enable row level security;
revoke all on table public.trial_claims from anon, authenticated;

-- 3. Profiles (each user can read only their own) ----------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  trial_started_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;

drop policy if exists "Users read their own profile" on public.profiles;
create policy "Users read their own profile"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

-- 4. On sign-up: claim the trial (first time only) and create the profile ----------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  n text;
  started timestamptz;
begin
  if new.email is null then
    return new;
  end if;
  n := public.normalize_email(new.email);
  insert into public.trial_claims (email_norm) values (n) on conflict (email_norm) do nothing;
  select claimed_at into started from public.trial_claims where email_norm = n;
  insert into public.profiles (id, email, full_name, trial_started_at)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    started
  )
  on conflict (id) do nothing;
  return new;
end
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 5. Accounts created before this script ran (normally none) ----------------------------------------
insert into public.trial_claims (email_norm, claimed_at)
select public.normalize_email(u.email), min(u.created_at)
from auth.users u
where u.email is not null
group by public.normalize_email(u.email)
on conflict (email_norm) do nothing;

insert into public.profiles (id, email, full_name, trial_started_at)
select u.id, u.email,
       coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name'),
       c.claimed_at
from auth.users u
join public.trial_claims c on c.email_norm = public.normalize_email(u.email)
where u.email is not null
on conflict (id) do nothing;
