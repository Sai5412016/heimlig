-- sql/retention.sql — read-only retention/activity reporting views, service_role only.
--
-- Written for Heimlig / Supabase project eabwlyihcmofkbqtbryz. Not applied automatically —
-- run manually (SQL editor or `apply_migration`) once reviewed.
--
-- IMPORTANT — schema reality check done before writing this (per instruction: introspect, don't
-- guess). The activity tables named in the task (shopping_items, tasks, transactions, recipes,
-- "notes") do NOT have a `user_id` column at all:
--   - shopping_items.added_by / checked_by   -> FK to public.members(id)
--   - tasks.created_by / completed_by / assigned_to -> FK to public.members(id)
--   - transactions.member_id                  -> FK to public.members(id)
--   - recipes.created_by                      -> FK to public.members(id)
--   - there is no table literally called "notes" — the closest match is household_notes.
--     household_notes.created_by has NO foreign key constraint at all, but a data check
--     (matching values against members.id) confirms it also holds a members.id, not a user id.
-- `members.id` is a per-household membership row, distinct from `auth.users.id` (one auth user
-- can have several members rows, one per household). Every view below resolves the real
-- auth.users.id by joining through members.user_id.
--
-- For contrast: share_events.user_id and recipe_import_events.user_id ARE real auth.users.id
-- values directly (checked the same way) — but those two tables were not in the requested list,
-- so they are not used here.
--
-- Access control: all four views live in a dedicated `analytics` schema, which is never exposed
-- via PostgREST (only `public`/`graphql_public` are by default) and has no grants for
-- anon/authenticated. Views are left as SECURITY DEFINER (Postgres' default for views, i.e. they
-- run with the privileges of the view owner) specifically so they can read auth.users without
-- requiring service_role to hold direct grants on the auth schema — access to the *views* is
-- still restricted to service_role via explicit schema/table grants below.

create schema if not exists analytics;
revoke all on schema analytics from public;
grant usage on schema analytics to service_role;


-- 1) Registrations per day.
create or replace view analytics.v_signups_daily as
select
  (u.created_at at time zone 'utc')::date as signup_date,
  count(*) as signups
from auth.users u
group by 1
order by 1;


-- 2) Day-1 / Day-7 / Day-30 retention: share of users who performed at least one tracked
-- action ON that exact day offset after signup (classic "Day-N retention", not cumulative).
-- Activity signal = created_at on shopping_items / tasks / transactions / recipes /
-- household_notes, resolved to a real user via members.user_id (see note above).
--
-- Cohorts that haven't reached a given day-offset yet are excluded from that offset's
-- denominator (a user who signed up yesterday can't have "Day 30" data yet) — without this,
-- retention_pct would be artificially depressed by immature cohorts.
create or replace view analytics.v_retention_d1_d7_d30 as
with activity as (
  select m.user_id, si.created_at::date as activity_date
  from public.shopping_items si
  join public.members m on m.id = si.added_by
  where si.added_by is not null

  union all
  select m.user_id, t.created_at::date
  from public.tasks t
  join public.members m on m.id = t.created_by
  where t.created_by is not null

  union all
  select m.user_id, tr.created_at::date
  from public.transactions tr
  join public.members m on m.id = tr.member_id
  where tr.member_id is not null

  union all
  select m.user_id, r.created_at::date
  from public.recipes r
  join public.members m on m.id = r.created_by
  where r.created_by is not null

  union all
  select m.user_id, hn.created_at::date
  from public.household_notes hn
  join public.members m on m.id = hn.created_by
  where hn.created_by is not null
),
signups as (
  select id as user_id, (created_at at time zone 'utc')::date as signup_date
  from auth.users
),
horizons as (
  select unnest(array[1, 7, 30]) as day_n
),
eligible as (
  -- Only cohorts old enough that "signup_date + day_n" has already happened.
  select s.user_id, s.signup_date, h.day_n, (s.signup_date + h.day_n) as target_date
  from signups s
  cross join horizons h
  where (s.signup_date + h.day_n) <= (now() at time zone 'utc')::date
),
retained as (
  select
    e.user_id,
    e.day_n,
    exists (
      select 1 from activity a
      where a.user_id = e.user_id and a.activity_date = e.target_date
    ) as was_active
  from eligible e
)
select
  day_n,
  count(*) as eligible_users,
  count(*) filter (where was_active) as retained_users,
  round(100.0 * count(*) filter (where was_active) / nullif(count(*), 0), 1) as retention_pct
from retained
group by day_n
order by day_n;


-- 3) Households with >= 2 members that had at least one tracked action in the last 7 days.
-- shopping_items has no household_id of its own — resolved via shopping_lists.household_id.
create or replace view analytics.v_active_households as
with household_activity as (
  select sl.household_id, si.created_at
  from public.shopping_items si
  join public.shopping_lists sl on sl.id = si.list_id

  union all
  select t.household_id, t.created_at from public.tasks t

  union all
  select tr.household_id, tr.created_at from public.transactions tr

  union all
  select r.household_id, r.created_at from public.recipes r

  union all
  select hn.household_id, hn.created_at from public.household_notes hn
),
member_counts as (
  select household_id, count(*) as member_count
  from public.members
  group by household_id
)
select
  h.id as household_id,
  h.name as household_name,
  mc.member_count,
  max(ha.created_at) as last_activity_at
from public.households h
join member_counts mc on mc.household_id = h.id and mc.member_count >= 2
join household_activity ha on ha.household_id = h.id
where ha.created_at >= now() - interval '7 days'
group by h.id, h.name, mc.member_count
order by last_activity_at desc;


-- 4) Onboarding funnel: signed up -> household created/joined -> first entry.
--
-- Interpretation note: the task says "Haushalt angelegt" (household *created*). members has no
-- flag distinguishing "created this household" from "joined via invite code", and both
-- create_household_for_user and join_household_by_code insert the same kind of members row.
-- Rather than guess at a fragile heuristic (e.g. comparing households.created_at to
-- members.joined_at timestamps), step 2 here is deliberately "created OR joined a household" —
-- the actually-verifiable, robust conversion point. Flagged here explicitly so it can be
-- corrected if literal creators-only was intended.
create or replace view analytics.v_onboarding_funnel as
with signups as (
  select id as user_id from auth.users
),
first_membership as (
  select user_id, min(joined_at) as household_at
  from public.members
  group by user_id
),
activity as (
  select m.user_id, si.created_at from public.shopping_items si join public.members m on m.id = si.added_by
  union all
  select m.user_id, t.created_at from public.tasks t join public.members m on m.id = t.created_by
  union all
  select m.user_id, tr.created_at from public.transactions tr join public.members m on m.id = tr.member_id
  union all
  select m.user_id, r.created_at from public.recipes r join public.members m on m.id = r.created_by
  union all
  select m.user_id, hn.created_at from public.household_notes hn join public.members m on m.id = hn.created_by
),
first_entry as (
  select user_id, min(created_at) as entry_at from activity group by user_id
),
totals as (
  select
    count(distinct s.user_id) as total_signups,
    count(distinct fm.user_id) as total_household,
    count(distinct fe.user_id) as total_first_entry
  from signups s
  left join first_membership fm on fm.user_id = s.user_id
  left join first_entry fe on fe.user_id = s.user_id
)
select 1 as step_order, 'signed_up' as step, total_signups as users, 100.0 as pct_of_signups
from totals
union all
select 2, 'household_created_or_joined', total_household,
       round(100.0 * total_household / nullif(total_signups, 0), 1)
from totals
union all
select 3, 'first_entry', total_first_entry,
       round(100.0 * total_first_entry / nullif(total_signups, 0), 1)
from totals
order by step_order;


grant select on all tables in schema analytics to service_role;
