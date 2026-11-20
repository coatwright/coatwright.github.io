-- Coatwright cloud backup & sync: each painter's jobs, customers, expenses and settings, saved to their account.
-- Paste this whole file into Supabase → SQL Editor → New query → Run (after setup.sql). Safe to run more than once.
--
-- • One row per account. A signed-in painter can only read, create and update THEIR OWN row.
-- • Nobody else (and no logged-out visitor) can see it. Rows are removed automatically if the account is deleted.
-- • `version` goes up by one on every save, so two devices saving at the same moment can't overwrite each other.

create table if not exists public.user_data (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  version bigint not null default 1,
  updated_at timestamptz not null default now()
);

alter table public.user_data enable row level security;
revoke all on table public.user_data from anon, authenticated;
grant select, insert, update on table public.user_data to authenticated;
grant all on table public.user_data to service_role;

drop policy if exists "Users read their own data" on public.user_data;
create policy "Users read their own data"
  on public.user_data for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users create their own data" on public.user_data;
create policy "Users create their own data"
  on public.user_data for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users update their own data" on public.user_data;
create policy "Users update their own data"
  on public.user_data for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
