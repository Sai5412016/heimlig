-- 2026-09-02_review_events.sql
-- Instrumentation for the manual "Heimlig bewerten" entry added in build 88.
--
-- A SEPARATE TABLE, not extra rows in paywall_events. Same reasoning as when paywall_events was
-- split off from ai_usage_events, and it applies just as literally here:
--   - paywall_events.source has a CHECK on the three AI features, and paywall_events.event has a
--     CHECK on wall_shown/upgrade_clicked. Recording a rating would mean loosening both, after
--     which the table holds two unrelated things and neither CHECK constrains anything useful.
--   - analytics.v_paywall_conversion groups by source and computes a click-through rate. Rating
--     rows landing in there would silently corrupt a number we use to make monetisation
--     decisions.
--
-- What this can and cannot answer: the tap is all we get. Google's In-App Review API deliberately
-- reports nothing back — not whether the sheet appeared, not whether a rating was left, not what
-- it said (a quota can swallow the request entirely). And once the Play Store opens in a browser
-- or the Play app, the user is outside anything we can observe. So review_events measures INTENT,
-- never outcome, and the numbers must be read that way.

create table if not exists public.review_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  -- review_tapped: somebody tapped the entry. review_route: which way they were actually sent,
  -- which is decided at runtime and is not the same on every device.
  event text not null check (event in ('review_tapped', 'review_route')),
  -- Only set for review_route. 'in_app' = the native Play In-App Review flow was requested;
  -- 'store' = we opened the store listing instead, because the native flow was unavailable or we
  -- are on the web build.
  route text check (route is null or route in ('in_app', 'store')),
  created_at timestamptz not null default now(),
  -- Keeps the two shapes honest: a route belongs to a review_route row and nowhere else.
  constraint review_events_route_chk check (
    case when event = 'review_route' then route is not null else route is null end
  )
);

create index if not exists review_events_household_event_idx
  on public.review_events (household_id, event);

alter table public.review_events enable row level security;

-- Insert-only from the client, no SELECT policy — same shape as feedback, invite_funnel_events
-- and paywall_events. Reporting goes through the service-role view below.
create policy review_events_insert on public.review_events
  for insert
  with check (auth.uid() = user_id and is_household_member(household_id));


-- Reporting ------------------------------------------------------------------------------------
create schema if not exists analytics;
revoke all on schema analytics from public;
grant usage on schema analytics to service_role;

-- Deliberately no "conversion rate" column. There is no outcome to divide by — see the header.
create or replace view analytics.v_review_intent as
select
  count(*) filter (where event = 'review_tapped')                        as taps,
  count(distinct household_id) filter (where event = 'review_tapped')    as households_tapped,
  count(*) filter (where event = 'review_route' and route = 'in_app')    as routed_in_app,
  count(*) filter (where event = 'review_route' and route = 'store')     as routed_to_store
from public.review_events;

grant select on analytics.v_review_intent to service_role;
