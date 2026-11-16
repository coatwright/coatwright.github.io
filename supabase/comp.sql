-- Coatwright complimentary access (free Pro without a subscription: the owner, demos, beta testers, partners).
-- Paste this whole file into Supabase → SQL Editor → New query → Run (after setup.sql). Safe to run more than once.
--
-- Access is granted here in the database by email, never from the app, so nobody can give it to themselves.
-- Gmail "+" / "." variations count as the same address (same rule as the free trial).
--
-- GIVE someone free Pro (run in the SQL Editor; replace the email):
--   insert into public.comp_access (email_norm, note) values (public.normalize_email('someone@example.com'), 'Owner')
--   on conflict (email_norm) do update set note = excluded.note;
--
-- TAKE it away:
--   delete from public.comp_access where email_norm = public.normalize_email('someone@example.com');
--
-- SEE who has it:
--   select * from public.comp_access order by created_at;

create table if not exists public.comp_access (
  email_norm text primary key,
  note text,                        -- e.g. 'Owner', 'Beta tester', 'Partner'
  created_at timestamptz not null default now()
);

alter table public.comp_access enable row level security;
revoke all on table public.comp_access from anon, authenticated;
grant select on table public.comp_access to authenticated;
grant all on table public.comp_access to service_role;

-- Each signed-in user can see only the row for their own email (to unlock the app), nothing else.
drop policy if exists "Users see their own complimentary access" on public.comp_access;
create policy "Users see their own complimentary access"
  on public.comp_access for select
  to authenticated
  using (email_norm = public.normalize_email((select auth.jwt()) ->> 'email'));
