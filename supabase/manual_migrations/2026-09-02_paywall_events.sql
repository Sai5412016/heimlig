-- 2026-09-02_paywall_events.sql
-- Instrumentation for the AI-quota paywall: does the wall ever get seen, and does anyone act on it.
--
-- A SEPARATE TABLE, not extra rows in ai_usage_events. That is not a style preference: the free
-- quota is enforced by counting rows in ai_usage_events for the current month (see the three edge
-- functions and lib/aiUsage.ts's fetchAiActionsUsed). Writing a "wall was shown" row in there
-- would consume the user's own quota — and it would happen precisely when they have already run
-- out, so every rejection would push the counter further past the limit. The two things are
-- counted for different reasons and must not share a table.

create table if not exists public.paywall_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  -- wall_shown: the quota wall was actually rendered to someone.
  -- upgrade_clicked: they pressed "Premium ansehen" on it.
  -- Both are needed; either number alone says nothing about the other.
  event text not null check (event in ('wall_shown', 'upgrade_clicked')),
  -- Which of the three AI features they were trying to use when they hit it.
  source text not null check (source in ('recipe_import', 'receipt_scan', 'event_photo')),
  created_at timestamptz not null default now()
);

create index if not exists paywall_events_household_event_idx
  on public.paywall_events (household_id, event);

alter table public.paywall_events enable row level security;

-- Insert-only from the client, no SELECT policy for authenticated — same shape as feedback and
-- invite_funnel_events. Reporting happens through the service-role view below, so a client can
-- record its own events but cannot read anybody's.
create policy paywall_events_insert on public.paywall_events
  for insert
  with check (auth.uid() = user_id and is_household_member(household_id));


-- Reporting: how often the wall was seen, how often it was acted on, per source.
create schema if not exists analytics;
revoke all on schema analytics from public;
grant usage on schema analytics to service_role;

create or replace view analytics.v_paywall_conversion as
select
  source,
  count(*) filter (where event = 'wall_shown')      as walls_shown,
  count(*) filter (where event = 'upgrade_clicked') as upgrades_clicked,
  round(
    100.0 * count(*) filter (where event = 'upgrade_clicked')
    / nullif(count(*) filter (where event = 'wall_shown'), 0),
    1
  ) as pct_clicked,
  count(distinct household_id)                       as households
from public.paywall_events
group by source
order by walls_shown desc;

grant select on analytics.v_paywall_conversion to service_role;
