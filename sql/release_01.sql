-- sql/release_01.sql — consolidated pre-release SQL for PR #20 + #21 + #22, in the order that
-- makes them work together. NOT applied. Written for Heimlig / Supabase project
-- eabwlyihcmofkbqtbryz — run manually (SQL editor or `apply_migration`) once reviewed.
--
-- Idempotent: safe to run this whole file more than once against the same database without
-- erroring. Supersedes running sql/retention.sql, sql/invite_funnel.sql and
-- sql/household_type.sql separately — this is the single, ordered, de-duplicated version of all
-- three (their schema-setup preambles were identical and only need to run once; the RLS policy
-- statement needed a drop-if-exists added since `CREATE POLICY` has no IF NOT EXISTS in
-- Postgres — everything else in the three source files was already idempotent as written).
--
-- Precondition: is_household_member(uuid) must already exist (pre-existing project helper, not
-- created by this file — used in the invite_funnel_events RLS policy below).

-- ═══════════════════════════════════════════════════════════════════════════
-- 1) Shared `analytics` schema — used by both the retention views (PR #20) and the invite funnel
--    view (PR #21/#22). Never exposed via PostgREST (only public/graphql_public are by default);
--    access is service_role-only via the explicit grants below.
-- ═══════════════════════════════════════════════════════════════════════════
create schema if not exists analytics;
revoke all on schema analytics from public;
grant usage on schema analytics to service_role;


-- ═══════════════════════════════════════════════════════════════════════════
-- 2) Retention / activity reporting views (PR #20, sql/retention.sql).
--    Schema reality check done before writing these (introspected, not assumed): none of
--    shopping_items/tasks/transactions/recipes/household_notes have a user_id column — their
--    author fields (added_by/created_by/member_id) are all FKs to public.members(id), not
--    auth.users(id). Every view below resolves the real user via members.user_id.
-- ═══════════════════════════════════════════════════════════════════════════

-- 2a) Registrations per day.
create or replace view analytics.v_signups_daily as
select
  (u.created_at at time zone 'utc')::date as signup_date,
  count(*) as signups
from auth.users u
group by 1
order by 1;


-- 2b) Day-1 / Day-7 / Day-30 retention: share of users who performed at least one tracked action
-- ON that exact day offset after signup. Cohorts that haven't reached a given day-offset yet are
-- excluded from that offset's denominator.
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


-- 2c) Households with >= 2 members that had at least one tracked action in the last 7 days.
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


-- 2d) Onboarding funnel: signed up -> household created/joined -> first entry.
-- "household_created_or_joined" (not "created") on purpose — members has no reliable way to
-- distinguish the two, and this is the robust, verifiable conversion point.
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


-- ═══════════════════════════════════════════════════════════════════════════
-- 3) Invite funnel (PR #21, later amended by PR #22 — this is the final, post-#22 shape:
--    user_id nullable + anon_id, so join_opened can be logged before the recipient has ever
--    authenticated, which is the main case the whole feature exists for).
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists public.invite_funnel_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  anon_id text,
  step text not null check (step in ('invite_opened', 'invite_shared', 'join_opened', 'join_completed')),
  created_at timestamptz not null default now(),
  constraint invite_funnel_events_identity_chk check (
    case
      when step = 'join_opened' then user_id is not null or anon_id is not null
      else user_id is not null
    end
  )
);

create index if not exists invite_funnel_events_household_step_idx
  on public.invite_funnel_events (household_id, step);

alter table public.invite_funnel_events enable row level security;

-- CREATE POLICY has no IF NOT EXISTS in Postgres — drop-then-create is what actually makes this
-- statement idempotent (this is the one genuinely non-idempotent statement across all three
-- source files; every other statement in this script was already safe to re-run as written).
drop policy if exists invite_funnel_events_insert on public.invite_funnel_events;
create policy invite_funnel_events_insert on public.invite_funnel_events
  for insert
  with check (
    case
      when step = 'join_opened' then
        (auth.uid() is not null and auth.uid() = user_id)
        or (auth.uid() is null and user_id is null and anon_id is not null)
      when step = 'join_completed' then
        auth.uid() = user_id
      else
        auth.uid() = user_id and is_household_member(household_id)
    end
  );

create or replace function public.resolve_invite_code(p_invite_code text)
returns table (household_id uuid, household_name text)
language sql
security definer
set search_path = public
as $$
  select id, name from households where invite_code = upper(trim(p_invite_code));
$$;

revoke all on function public.resolve_invite_code(text) from public;
grant execute on function public.resolve_invite_code(text) to authenticated, anon;

create or replace view analytics.v_invite_funnel as
with counts as (
  select step, count(*) as n
  from public.invite_funnel_events
  group by step
),
ordered as (
  select 1 as step_order, 'invite_opened' as step
  union all select 2, 'invite_shared'
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


-- ═══════════════════════════════════════════════════════════════════════════
-- 4) Household type (PR #22, sql/household_type.sql) — independent of everything above, ordered
--    last here only because it was written last; no actual dependency either direction.
-- ═══════════════════════════════════════════════════════════════════════════
alter table public.households
  add column if not exists household_type text
  check (household_type in ('couple', 'wg', 'family', 'solo'));

create or replace function public.create_household_for_user(
  p_name text,
  p_display_name text,
  p_avatar_color text,
  p_language text default 'de',
  p_household_type text default null
)
returns json
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_user_id uuid;
  v_household_id uuid;
  v_member_id uuid;
  v_list_id uuid;
  v_list_name text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  v_list_name := case when p_language = 'en' then 'Shopping List' else 'Einkaufsliste' end;

  insert into households (name, household_type) values (p_name, p_household_type) returning id into v_household_id;
  insert into members (user_id, household_id, display_name, avatar_color, role)
    values (v_user_id, v_household_id, p_display_name, p_avatar_color, 'admin')
    returning id into v_member_id;
  insert into shopping_lists (household_id, name, emoji, created_by)
    values (v_household_id, v_list_name, '🛒', v_member_id)
    returning id into v_list_id;

  return json_build_object(
    'household_id', v_household_id,
    'member_id', v_member_id,
    'list_id', v_list_id
  );
end;
$$;

-- BLOCKER FIX (experimentally proven: Postgres 42725 "function is not unique"): before this
-- statement, create_household_for_user existed live as BOTH (text,text,text,text) — no
-- defaults, added when p_language shipped in app versionCode 73 (app/onboarding.tsx, commit
-- bc5623f) — AND the 5-arg overload just created above, whose 4th and 5th parameters
-- (p_language, p_household_type) both have defaults. A call with exactly 4 named arguments
-- satisfies BOTH overloads, so PostgREST can no longer pick one — the live app (versionCode 76
-- and every build back to 73) calls with exactly those 4 arguments, so leaving both in place
-- would have broken household creation for every user on any of those builds the instant this
-- migration ran.
drop function if exists public.create_household_for_user(text, text, text, text);

-- The (text,text,text) overload (pre-p_language, versionCode <= 72) is ALSO dropped, for the
-- identical reason, not because it's unused — this needed a second look, since the first pass
-- assumed keeping it was the cautious choice and that was wrong. The 5-arg overload's 4th AND
-- 5th parameters both have defaults, so a 3-argument call satisfies it too, exactly the same
-- ambiguity as the 4-arg case above, just one parameter further back. Postgres's overload
-- resolution doesn't distinguish "one default filled in" from "two defaults filled in" — it's
-- ambiguous either way once more than one candidate can satisfy the call. Keeping the 3-arg
-- overload would therefore have broken household creation for the very versionCode <= 72
-- population it was meant to protect, the moment this migration ran — the opposite of the
-- intended effect. Dropping it is what actually keeps old clients working: with only the 5-arg
-- overload left, a 3-argument call resolves to it unambiguously, defaulting p_language to 'de'
-- and p_household_type to null — functionally identical to what the old 3-arg overload did.
drop function if exists public.create_household_for_user(text, text, text);


-- ═══════════════════════════════════════════════════════════════════════════
-- 5) Final blanket grant — MUST run after every view above is created (grants on "all tables in
--    schema" only cover what already exists at the moment this statement executes). Covers all
--    five analytics views (4 from section 2, 1 from section 3) in one statement, matching how
--    each source file already placed its own equivalent grant last.
-- ═══════════════════════════════════════════════════════════════════════════
grant select on all tables in schema analytics to service_role;
