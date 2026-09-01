-- sql/ai_usage_events.sql — one shared monthly counter for every AI action.
-- NOT applied. Run manually (Supabase SQL editor or apply_migration) once reviewed.
--
-- Replaces the per-feature recipe_import_events counter with a single pot shared across all
-- three AI features: free households get FREE_MONTHLY_AI_ACTIONS (5, see lib/premium.ts) actions
-- per calendar month TOTAL — not 5 each. Premium is unlimited.
--
-- Deliberately NOT counted here, and the edge functions don't insert for them:
--   * barcode scan (app/(tabs)/scan.tsx) — reads an open product database, costs no AI tokens,
--     so metering it would charge users for something that costs nothing to serve.
--   * submit-feedback — its Claude call is a spam filter that exists for OUR benefit, not the
--     user's. Rationing feedback would mean the people most annoyed with the app are the ones
--     silenced first, which is exactly backwards.
--
-- recipe_import_events is intentionally left in place and simply stops being written to (see the
-- note at the bottom).

create table if not exists public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  action_type text not null check (action_type in ('recipe_import', 'receipt_scan', 'event_extract')),
  created_at timestamptz not null default now()
);

-- The only query this table ever serves: "how many actions has THIS household used since the
-- start of THIS month". Index matches that shape exactly.
create index if not exists ai_usage_events_household_created_idx
  on public.ai_usage_events (household_id, created_at desc);

alter table public.ai_usage_events enable row level security;

-- Same policy shape as recipe_import_events: a member may log their OWN action for a household
-- they actually belong to, and may read the household's usage (the app shows "3 of 5 used").
-- No UPDATE or DELETE policy at all — this is an append-only counter, and letting a client
-- delete rows would let it reset its own quota.
drop policy if exists ai_usage_events_insert on public.ai_usage_events;
create policy ai_usage_events_insert on public.ai_usage_events
  for insert
  with check (is_household_member(household_id) and user_id = auth.uid());

drop policy if exists ai_usage_events_select on public.ai_usage_events;
create policy ai_usage_events_select on public.ai_usage_events
  for select
  using (is_household_member(household_id));

-- ── On the old recipe_import_events table ────────────────────────────────────────────────
-- Left standing, no longer written to. It currently holds 0 rows (verified before this change),
-- so there is nothing to migrate — a backfill would copy an empty table. If it is still empty
-- when this is applied, dropping it is safe and tidy:
--
--   drop table if exists public.recipe_import_events;
--
-- Deliberately NOT part of this script: dropping a table is irreversible, and it costs nothing
-- to leave an empty unused table sitting there until you decide.
