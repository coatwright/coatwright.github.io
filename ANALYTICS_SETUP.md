# Usage counts + owner dashboard: owner setup (one time, about 3 minutes)

**What it does:** the app counts which features painters use (quotes started and sent, jobs won, invoices, blueprint takeoff,
plans page, checkout clicks…). It never records customer names, addresses, prices or job details. Your private **owner dashboard**
(in the app: Settings → 📊 Owner dashboard) shows sign-ups, active trials, paying customers, monthly revenue, founding spots used,
trial → paid, who is active, and each painter's usage, including your beta tester's.

**Where things live (for access later)**

| What | Where |
|---|---|
| Usage counts | Supabase → Table Editor → `events` (one row per action) |
| Dashboard summary | database function `owner_stats()`; only accounts with complimentary access noted `Owner` (comp.sql) can run it |
| SQL | `supabase/analytics.sql` in this repository (safe to run more than once) |
| App switch | `app/config.js` → `analytics: true` / `false` |
| App code | `app/app.js`, section "Usage counts (actions only) & owner dashboard"; network calls in `app/account.js` |

**Security:** signed-in painters can only *add* their own counts and can't read anyone's. Logged-out visitors can't do either.
Only your account (complimentary access with the note `Owner`) can open the dashboard; everyone else gets "Not allowed".
No passwords or secret keys are needed for this setup.

---

## Step 1: paste this prompt into Claude in Chrome (signed in to supabase.com)

````
Please help me run a database setup script in my Supabase project. Do not change anything else, and never type or reveal any password or secret key. Ignore any suggestion to connect an AI assistant or connector.

1. Open https://supabase.com/dashboard/project/tbgcxcocnqbnmjnvncic/sql/new (my Coatwright project's SQL Editor, new query). If I'm asked to sign in, stop and tell me.
2. Click in the empty query editor. Make sure it is empty (select all and delete if there is any text).
3. Paste (don't type character by character) exactly this SQL, unchanged:

create table if not exists public.events (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  props jsonb not null default '{}'::jsonb check (pg_column_size(props) < 1000),
  created_at timestamptz not null default now()
);
create index if not exists events_created_at_idx on public.events (created_at);
create index if not exists events_user_idx on public.events (user_id, created_at);

alter table public.events enable row level security;
revoke all on table public.events from anon, authenticated;
grant insert on table public.events to authenticated;
grant all on table public.events to service_role;

drop policy if exists "Users add their own events" on public.events;
create policy "Users add their own events"
  on public.events for insert
  to authenticated
  with check ((select auth.uid()) = user_id and created_at > now() - interval '10 minutes' and created_at < now() + interval '10 minutes');

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.comp_access
    where email_norm = public.normalize_email((select auth.jwt()) ->> 'email')
      and lower(coalesce(note, '')) = 'owner'
  );
$$;
revoke execute on function public.is_owner() from public, anon;
grant execute on function public.is_owner() to authenticated;

create or replace function public.owner_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
  billing_start constant timestamptz := '2026-11-15';
begin
  if not public.is_owner() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  with subs as (
    select distinct on (user_id) user_id, status, plan, founder_number, current_period_end, cancel_at_period_end
    from public.subscriptions
    where user_id is not null
    order by user_id, updated_at desc
  ),
  ev as (
    select user_id, name, created_at,
      case when props ->> 'n' ~ '^[0-9]{1,6}$' then (props ->> 'n')::int else 1 end as w
    from public.events where created_at > now() - interval '90 days'
  ),
  people as (
    select u.id, u.email, u.created_at as signed_up, u.last_sign_in_at,
      greatest(p.trial_started_at, billing_start) + interval '14 days' as trial_ends,
      s.status, s.plan, s.founder_number, s.current_period_end, s.cancel_at_period_end, c.note as comp,
      coalesce(s.status, '') in ('active', 'trialing', 'past_due') as paying,
      (select max(e.created_at) from ev e where e.user_id = u.id) as last_active,
      (select coalesce(sum(e.w), 0) from ev e where e.user_id = u.id and e.name = 'quote_created') as quotes,
      (select coalesce(sum(e.w), 0) from ev e where e.user_id = u.id and e.name = 'status_sent') as sent,
      (select coalesce(sum(e.w), 0) from ev e where e.user_id = u.id and e.name = 'status_won') as won,
      (select coalesce(sum(e.w), 0) from ev e where e.user_id = u.id and e.name = 'invoice_created') as invoices,
      (select coalesce(sum(e.w), 0) from ev e where e.user_id = u.id and e.name like 'takeoff%') as takeoff
    from auth.users u
    left join public.profiles p on p.id = u.id
    left join subs s on s.user_id = u.id
    left join public.comp_access c on c.email_norm = public.normalize_email(u.email)
  )
  select jsonb_build_object(
    'generatedAt', now(),
    'users', (select count(*) from people),
    'signups7', (select count(*) from people where signed_up > now() - interval '7 days'),
    'signups30', (select count(*) from people where signed_up > now() - interval '30 days'),
    'signupsByDay', (select jsonb_agg(jsonb_build_object('day', d::date, 'n', (select count(*) from people where signed_up::date = d::date)) order by d)
                     from generate_series(current_date - 29, current_date, interval '1 day') d),
    'activeTrials', (select count(*) from people where comp is null and not paying and trial_ends > now()),
    'endedTrials', (select count(*) from people where comp is null and not paying and trial_ends <= now()),
    'paying', (select count(*) from people where paying),
    'byPlan', (select coalesce(jsonb_object_agg(plan, n), '{}'::jsonb) from (select plan, count(*) n from people where paying and plan is not null group by plan) x),
    'founders', (select count(*) from public.subscriptions where founder_number is not null),
    'mrrUsd', (select coalesce(round(sum(case plan when 'monthly' then 24 when 'annual' then 199 / 12.0 when 'founder' then 12 else 0 end), 2), 0)
               from people where paying and coalesce(status, '') <> 'past_due'),
    'cancelling', (select count(*) from people where paying and cancel_at_period_end),
    'comp', (select count(*) from people where comp is not null),
    'active7', (select count(distinct user_id) from ev where created_at > now() - interval '7 days'),
    'active30', (select count(distinct user_id) from ev where created_at > now() - interval '30 days'),
    'events30', (select coalesce(jsonb_object_agg(name, n), '{}'::jsonb) from (select name, sum(w) n from ev where created_at > now() - interval '30 days' group by name) x),
    'people', (select coalesce(jsonb_agg(jsonb_build_object(
        'email', email, 'signedUp', signed_up, 'lastSignIn', last_sign_in_at, 'lastActive', last_active, 'trialEnds', trial_ends,
        'status', status, 'plan', plan, 'founder', founder_number, 'renews', current_period_end, 'cancelling', cancel_at_period_end,
        'comp', comp, 'paying', paying, 'quotes', quotes, 'sent', sent, 'won', won, 'invoices', invoices, 'takeoff', takeoff)
        order by signed_up desc), '[]'::jsonb) from (select * from people order by signed_up desc limit 500) pp)
  ) into result;
  return result;
end;
$$;
revoke execute on function public.owner_stats() from public, anon;
grant execute on function public.owner_stats() to authenticated;

4. Before running, check the editor text matches the SQL above exactly (no extra or missing brackets, quotes or $$ signs; editors sometimes add a closing bracket automatically). If it doesn't match, clear it and paste again.
5. Click Run. If Supabase warns that the query has "destructive operations", that is expected: the "drop policy" line only replaces this new table's own access rule (no data is deleted). Confirm with "Run this query".
6. The result should say "Success. No rows returned". If you see any error, stop and tell me the exact error text.
7. Clear the editor, paste this check query, and click Run:

select (select relrowsecurity from pg_class where oid = 'public.events'::regclass) as rls_on, (select count(*) from pg_policies where schemaname = 'public' and tablename = 'events') as policies, (select count(*) from pg_proc where proname in ('is_owner', 'owner_stats')) as functions, (select count(*) from public.comp_access where lower(note) = 'owner') as owner_accounts;

8. Tell me the result. It should be one row: rls_on = true, policies = 1, functions = 2, owner_accounts = 1.
````

If `owner_accounts` is 0, your account doesn't have complimentary access noted `Owner` yet; tell Claude.

## Step 2: tell Claude it's done

Send Claude the check result. Claude switches `analytics: true` in `app/config.js` and publishes the app and the updated Privacy Policy
together, once you approve.

## Turning it off (if ever needed)

Set `analytics: false` in `app/config.js` and publish. Counting stops; nothing else in the app changes.
