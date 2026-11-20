-- Coatwright usage counts + the owner's private dashboard.
-- Paste this whole file into Supabase → SQL Editor → New query → Run (after setup.sql, billing.sql and comp.sql). Safe to run more than once.
--
-- • events: the app records ACTIONS only (e.g. "quote_created", "status_won", "takeoff_opened") with small labels like the job type.
--   Never customer names, addresses, prices or job details. Signed-in painters can only ADD their own events; nobody can read them
--   from the app except through owner_stats().
-- • owner_stats(): one summary for the dashboard (sign-ups, trials, paying customers, founding spots, activity, per-painter usage).
--   Only accounts with complimentary access noted 'Owner' (comp.sql) can run it; everyone else gets "Not allowed".

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

-- Is the signed-in account the owner? (complimentary access with the note 'Owner')
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
  billing_start constant timestamptz := '2026-11-15';  -- trials count from here at the earliest (app/billing.js startDate)
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
      case when props ->> 'n' ~ '^[0-9]{1,6}$' then (props ->> 'n')::int else 1 end as w  -- repeats folded into one event carry a count
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
