-- 2026-09-02_invite_code_copied.sql
-- Adds a fifth event to the invite funnel and stops the reporting view from under-reporting.
--
-- Why this is needed at all: 39 of 49 households have exactly one person, and the funnel says
-- invite_shared = 1 against invite_opened = 11. That number could not be trusted, because the
-- client never logged two of the ways an invite actually leaves the app:
--   - the web "share" path (clipboard) logged nothing
--   - copying the code logged nothing — and worse, on native it never even copied (no clipboard
--     call existed; fixed in the same change by adding expo-clipboard)
-- Anyone reading the view would have concluded that people open the invite screen and then do
-- nothing, when part of that group had handed the code over by a route we simply could not see.

-- 1) Allow the new step -------------------------------------------------------------------------
-- The old constraint listed exactly four values, so an insert with the new one is rejected
-- outright. Named explicitly rather than dropped by pattern, so this fails loudly if the schema
-- is not what this file expects.
alter table public.invite_funnel_events
  drop constraint if exists invite_funnel_events_step_check;

alter table public.invite_funnel_events
  add constraint invite_funnel_events_step_check
  check (step in ('invite_opened', 'invite_shared', 'invite_code_copied', 'join_opened', 'join_completed'));

-- invite_funnel_events_identity_chk is deliberately left alone: copying only happens inside the
-- app with a session, so the new step falls into its `else user_id is not null` branch, which is
-- exactly right.


-- 2) The funnel view: count a hand-off, not just a share ----------------------------------------
-- SUPERSEDED by 2026-09-02_invite_funnel_pct_note.sql, which suppresses the percentage between
-- invite_handed_off and join_opened. Those two steps are reached by DIFFERENT people — the sender
-- hands off, the recipient joins — and codes also travel by word of mouth, so the ratio between
-- them is not a conversion rate. The view as written below prints 400 % there, which is not bad
-- data but a question with no answer.
-- Step 3 becomes "invite_handed_off" = shared OR code copied. That is the question the funnel is
-- actually asking — did the invite leave the app — and keeping the chain four steps long means
-- pct_of_previous_step still works (a fifth row would break the lag() chain).
--
-- Stored rows are untouched: they keep their exact step values, and the split stays visible in
-- v_invite_handoff below.
create or replace view analytics.v_invite_funnel as
with counts as (
  select
    case when step in ('invite_shared', 'invite_code_copied') then 'invite_handed_off' else step end as step,
    count(*) as n
  from public.invite_funnel_events
  group by 1
),
ordered as (
  select 1 as step_order, 'invite_opened' as step
  union all select 2, 'invite_handed_off'
  union all select 3, 'join_opened'
  union all select 4, 'join_completed'
)
select
  o.step_order,
  o.step,
  coalesce(c.n, 0) as events,
  round(
    100.0 * coalesce(c.n, 0)
    / nullif(lag(coalesce(c.n, 0)) over (order by o.step_order), 0),
    1
  ) as pct_of_previous_step
from ordered o
left join counts c on c.step = o.step
order by o.step_order;

grant select on analytics.v_invite_funnel to service_role;


-- 3) The split, for deciding which route to invest in -------------------------------------------
-- Distinct households as well as raw events: one person sharing five times is not five households
-- trying to grow, and the raw count alone would read like it was.
create or replace view analytics.v_invite_handoff as
select
  count(*) filter (where step = 'invite_shared')                     as shared_events,
  count(*) filter (where step = 'invite_code_copied')                as copied_events,
  count(distinct household_id) filter (where step = 'invite_shared')      as households_shared,
  count(distinct household_id) filter (where step = 'invite_code_copied') as households_copied,
  count(distinct household_id) filter (where step in ('invite_shared', 'invite_code_copied')) as households_either
from public.invite_funnel_events;

grant select on analytics.v_invite_handoff to service_role;
