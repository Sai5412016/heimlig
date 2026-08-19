-- sql/invite_funnel.sql — invite funnel table + resolver RPC + reporting view.
-- Written for Heimlig / Supabase project eabwlyihcmofkbqtbryz. NOT applied — run manually
-- (SQL editor or `apply_migration`) once reviewed. Depends on the `analytics` schema created in
-- sql/retention.sql (guarded with `if not exists` here too, so this file also works standalone).

create schema if not exists analytics;
revoke all on schema analytics from public;
grant usage on schema analytics to service_role;


-- New table rather than repurposing share_events: share_events is a same-day-per-platform
-- gamification log for sharing the APP on social media (Instagram/Facebook/...) for points —
-- unrelated to household invites (see the diagnosis in the PR description / report). Conflating
-- the two would make both metrics meaningless.
create table if not exists public.invite_funnel_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  step text not null check (step in ('invite_opened', 'invite_shared', 'join_opened', 'join_completed')),
  created_at timestamptz not null default now()
);

create index if not exists invite_funnel_events_household_step_idx
  on public.invite_funnel_events (household_id, step);

alter table public.invite_funnel_events enable row level security;

-- Insert-only from the client, no SELECT policy for anon/authenticated (same pattern as
-- feedback/purchases — reporting only via analytics.v_invite_funnel for service_role).
--
-- Asymmetric on purpose: invite_opened/invite_shared are logged by the INVITER, who is already a
-- household member at that point, so those two require is_household_member(). join_opened/
-- join_completed are logged by the RECIPIENT, who by definition is NOT yet a member when
-- join_opened fires (that's the whole point of that step) — so those two only require that the
-- caller is logging their own user_id, not household membership.
create policy invite_funnel_events_insert on public.invite_funnel_events
  for insert
  with check (
    auth.uid() = user_id
    and (
      step in ('join_opened', 'join_completed')
      or is_household_member(household_id)
    )
  );


-- Resolves an invite code to its household WITHOUT joining, so join_opened can be logged with a
-- real household_id before the recipient commits to joining (join_household_by_code only reveals
-- the household as a side effect of actually joining). SECURITY DEFINER because it must read
-- across households by code; safe because the invite_code itself is already the shared secret
-- handed to the invitee — identical trust boundary to join_household_by_code, which already
-- accepts an arbitrary code from any authenticated caller. Read-only, no side effects.
create or replace function public.resolve_invite_code(p_invite_code text)
returns table (household_id uuid, household_name text)
language sql
security definer
set search_path = public
as $$
  select id, name from households where invite_code = upper(trim(p_invite_code));
$$;

revoke all on function public.resolve_invite_code(text) from public;
grant execute on function public.resolve_invite_code(text) to authenticated;


-- Four steps as absolute counts and as % of the immediately preceding step.
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

grant select on analytics.v_invite_funnel to service_role;
