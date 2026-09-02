-- 2026-09-02_invite_funnel_pct_note.sql
-- Stops analytics.v_invite_funnel from printing a percentage that cannot mean anything.
--
-- A funnel rate is only meaningful when each step is a SUBSET of the one before it — the same
-- people, moving forward. Two of the three transitions in this view satisfy that. One does not:
--
--   1 -> 2  invite_opened   -> invite_handed_off   VALID. Same person, same session: they opened
--                                                  the invite screen and passed the code on.
--   2 -> 3  invite_handed_off -> join_opened       MEANINGLESS. Different people entirely — the
--                                                  sender hands off, the RECIPIENT joins. Codes
--                                                  also travel by word of mouth, on paper, or
--                                                  read out loud, so a join can happen with no
--                                                  hand-off recorded at all. The number today is
--                                                  400 %, which is not an error in the data: it
--                                                  is the view asking a question that has no
--                                                  answer.
--   3 -> 4  join_opened     -> join_completed      VALID. Same person, sequential.
--
-- A comment on the view would not help the person who runs `select * from
-- analytics.v_invite_funnel;` and reads 400 % — comments do not appear in query output. So the
-- view stops producing the number, and says why in a column that does show up.

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
),
tallied as (
  select
    o.step_order,
    o.step,
    coalesce(c.n, 0) as events,
    round(
      100.0 * coalesce(c.n, 0)
      / nullif(lag(coalesce(c.n, 0)) over (order by o.step_order), 0),
      1
    ) as raw_pct
  from ordered o
  left join counts c on c.step = o.step
)
select
  step_order,
  step,
  events,
  -- Suppressed for step 3: sender and recipient are different people, so the ratio between them
  -- is not a conversion rate. Every other transition keeps its number.
  case when step_order = 3 then null else raw_pct end as pct_of_previous_step,
  case
    when step_order = 3 then 'no rate: senders and recipients are different people, and codes also travel outside the app'
    else null
  end as note
from tallied
order by step_order;

grant select on analytics.v_invite_funnel to service_role;

comment on view analytics.v_invite_funnel is
  'Invite funnel. pct_of_previous_step is deliberately NULL for join_opened: that step is reached '
  'by the RECIPIENT, not the sender, and invite codes also travel by word of mouth, so the ratio '
  'to invite_handed_off is not a conversion rate. See the note column.';
