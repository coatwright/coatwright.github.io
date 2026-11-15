-- Coatwright subscriptions (Stripe) and founding members.
-- Paste this whole file into Supabase → SQL Editor → New query → Run (after setup.sql). Safe to run more than once.
--
-- What it does
--   • subscriptions: one row per Stripe customer, filled by the stripe-webhook function. Each user can read only
--     their own rows; nobody can change them from the app.
--   • Founding members: the first 100 paying founders get numbers 1–100 (founder_number), assigned once.
--   • founder_spots_left(): how many founding spots remain (public, for the pricing page).

create table if not exists public.subscriptions (
  customer_id text primary key,
  user_id uuid references auth.users (id) on delete set null,
  email text,
  subscription_id text,
  status text,                     -- Stripe status: active, trialing, past_due, canceled, unpaid, ...
  billing_interval text,           -- month | year
  founder boolean not null default false,
  plan text generated always as (
    case when founder and billing_interval = 'month' then 'founder'
         when billing_interval = 'year' then 'annual'
         when billing_interval = 'month' then 'monthly' end
  ) stored,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  founder_number integer unique check (founder_number between 1 and 100),
  event_at bigint not null default 0,  -- time of the newest Stripe subscription event applied (ignores older ones)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists subscriptions_user_id on public.subscriptions (user_id);

alter table public.subscriptions enable row level security;
revoke all on table public.subscriptions from anon, authenticated;
grant select on table public.subscriptions to authenticated;
grant all on table public.subscriptions to service_role;

drop policy if exists "Users read their own subscriptions" on public.subscriptions;
create policy "Users read their own subscriptions"
  on public.subscriptions for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- Checkout finished: link the Stripe customer to the Coatwright account.
create or replace function public.stripe_checkout(p_customer text, p_user uuid, p_email text, p_founder boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_customer is null or p_customer = '' then return; end if;
  insert into public.subscriptions (customer_id, user_id, email, founder)
  values (p_customer, p_user, p_email, coalesce(p_founder, false))
  on conflict (customer_id) do update set
    user_id = coalesce(excluded.user_id, public.subscriptions.user_id),
    email = coalesce(excluded.email, public.subscriptions.email),
    founder = public.subscriptions.founder or excluded.founder,
    updated_at = now();
end
$$;

-- A subscription was created or changed. Older events (Stripe can deliver out of order) are ignored.
create or replace function public.stripe_subscription(
  p_customer text, p_subscription text, p_status text, p_interval text,
  p_period_end timestamptz, p_cancel boolean, p_event_at bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_customer is null or p_customer = '' then return; end if;
  insert into public.subscriptions (customer_id, subscription_id, status, billing_interval, current_period_end, cancel_at_period_end, event_at)
  values (p_customer, p_subscription, p_status, p_interval, p_period_end, coalesce(p_cancel, false), coalesce(p_event_at, 0))
  on conflict (customer_id) do update set
    subscription_id = excluded.subscription_id,
    status = excluded.status,
    billing_interval = coalesce(excluded.billing_interval, public.subscriptions.billing_interval),
    current_period_end = coalesce(excluded.current_period_end, public.subscriptions.current_period_end),
    cancel_at_period_end = excluded.cancel_at_period_end,
    event_at = excluded.event_at,
    updated_at = now()
  where public.subscriptions.event_at <= excluded.event_at;
end
$$;

-- Give a founder their number (1–100), once. Returns the number, the email and whether it is new.
create or replace function public.assign_founder(p_customer text)
returns table (founder_number integer, email text, is_new boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.subscriptions%rowtype;
  n integer;
begin
  perform pg_advisory_xact_lock(727274);
  select * into r from public.subscriptions s where s.customer_id = p_customer for update;
  if not found or not r.founder or r.user_id is null or r.billing_interval is distinct from 'month'
     or r.status not in ('active', 'trialing', 'past_due') then
    return;
  end if;
  if r.founder_number is not null then
    return query select r.founder_number, r.email, false; return;
  end if;
  -- Someone who was already a founder (e.g. re-subscribed) keeps their original number.
  select s.founder_number into n from public.subscriptions s
    where s.user_id = r.user_id and s.founder_number is not null limit 1;
  if n is not null then
    return query select n, r.email, false; return;
  end if;
  select coalesce(max(s.founder_number), 0) + 1 into n from public.subscriptions s;
  if n > 100 then return; end if;
  update public.subscriptions s set founder_number = n, updated_at = now() where s.customer_id = p_customer;
  return query select n, r.email, true;
end
$$;

-- Founding spots still open (anyone can ask, e.g. the website).
create or replace function public.founder_spots_left()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select greatest(0, 100 - count(*))::integer from public.subscriptions where founder_number is not null
$$;

revoke execute on function public.stripe_checkout(text, uuid, text, boolean) from public, anon, authenticated;
revoke execute on function public.stripe_subscription(text, text, text, text, timestamptz, boolean, bigint) from public, anon, authenticated;
revoke execute on function public.assign_founder(text) from public, anon, authenticated;
grant execute on function public.stripe_checkout(text, uuid, text, boolean) to service_role;
grant execute on function public.stripe_subscription(text, text, text, text, timestamptz, boolean, bigint) to service_role;
grant execute on function public.assign_founder(text) to service_role;
grant execute on function public.founder_spots_left() to anon, authenticated;
