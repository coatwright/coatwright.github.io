# Cloud backup & sync: owner setup (one time, about 3 minutes)

**What it does:** while a painter is signed in, their jobs, customers, expenses, settings and logo are saved to their
Coatwright account and kept in sync on every phone, tablet or computer they sign in on. The app still works offline;
changes upload when it's back online. A new phone just signs in and everything is there.

**Where things live (for access later)**

| What | Where |
|---|---|
| Database table | Supabase project `tbgcxcocnqbnmjnvncic` → Table Editor → `user_data` (one row per account) |
| Table + security rules (SQL) | `supabase/sync.sql` in this repository (safe to run more than once) |
| App switch | `app/config.js` → `sync: true` / `false` (false = feature hidden, app works as before) |
| Merge rules (how two devices are combined) | `app/sync.js`, tests in `app/tests/sync.test.js` |
| Network calls | `app/account.js` → `getUserData`, `insertUserData`, `updateUserData` |
| App wiring and the Settings card | `app/app.js`, section "Cloud backup & sync" |

**Security:** database rules let a signed-in painter read, create and update only their own row. Logged-out visitors and other
painters see nothing. Nobody can delete a row through the app; a row is removed automatically when its account is deleted in
Supabase (Authentication → Users). Sign-in details and subscription status are never part of the backup.
No passwords or secret keys are needed for this setup.

---

## Step 1: create the table (paste this prompt into Claude in Chrome)

Be signed in to supabase.com in Chrome first. Then paste this whole prompt into the extension:

````
Please help me run a database setup script in my Supabase project. Do not change anything else, and never type or reveal any password or secret key.

1. Open https://supabase.com/dashboard/project/tbgcxcocnqbnmjnvncic/sql/new (my Coatwright project's SQL Editor, new query). If I'm asked to sign in, stop and tell me.
2. Click in the empty query editor. Make sure it is empty (select all and delete if there is any text).
3. Paste (don't type character by character) exactly this SQL, unchanged:

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
create policy "Users read their own data" on public.user_data for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Users create their own data" on public.user_data;
create policy "Users create their own data" on public.user_data for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Users update their own data" on public.user_data;
create policy "Users update their own data" on public.user_data for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

4. Before running, check the editor text matches the SQL above exactly (no extra or missing brackets or quotes; editors sometimes add a closing bracket automatically). If it doesn't match, clear it and paste again.
5. Click Run. If Supabase warns that the query has "destructive operations", that is expected: the only "drop" lines replace this new table's own access rules (they don't delete any data). Confirm with "Run this query".
6. The result should say "Success. No rows returned". If you see any error, stop and tell me the exact error text.
7. Clear the editor, paste this check query, and click Run:

select (select relrowsecurity from pg_class where oid = 'public.user_data'::regclass) as rls_on, (select count(*) from pg_policies where schemaname = 'public' and tablename = 'user_data') as policies;

8. Tell me the result. It should be one row: rls_on = true, policies = 3.
````

**Doing it by hand instead:** Supabase → SQL Editor → New query → paste the SQL from step 3 → Run → expect
"Success. No rows returned". Then run the check query from step 7 and expect `true` and `3`.

## Step 2: tell Claude it's done

Send Claude the result of the check (`rls_on = true, policies = 3`). Claude then switches `sync: true` in `app/config.js`
and publishes the app, website and updated Privacy Policy together, once you approve.

## Turning it off again (if ever needed)

Set `sync: false` in `app/config.js` and publish. Painters' devices keep all their data; nothing in the database is deleted.
