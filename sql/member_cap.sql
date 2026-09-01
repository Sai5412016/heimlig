-- sql/member_cap.sql — drops the member limit as a paid feature.
-- NOT applied. Run manually (Supabase SQL editor or apply_migration) once reviewed.
--
-- Before: enforce_member_limit() allowed 3 members on the free tier and 6 on premium (or
-- grandfathered), so household size was something Premium sold. That is gone: Premium now sells
-- taken-over work (the AI quota, see sql/ai_usage_events.sql), not a barrier.
--
-- After: ONE cap of 20, identical for every tier. This is not monetisation — it is an abuse
-- guard, so nobody can inflate a household to thousands of rows. No real household hits 20.
--
-- Idempotent: CREATE OR REPLACE, safe to run more than once. The trigger itself
-- (trg_enforce_member_limit on public.members) already exists and is NOT recreated here — only
-- the function body it calls changes, so the trigger keeps working untouched.
--
-- The raised exception message stays exactly 'member_limit_reached': lib/premium.ts's
-- isMemberLimitError() matches on that string, and three client call sites depend on it
-- (app/onboarding.tsx, app/join/[code].tsx, app/(tabs)/household.tsx). Changing the message
-- would silently turn a friendly "household is full" message into a raw database error.

create or replace function public.enforce_member_limit()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  -- Same number for free, premium and grandfathered households on purpose. Keep in sync with
  -- HOUSEHOLD_MEMBER_CAP in lib/premium.ts, which is what the UI shows.
  v_limit constant int := 20;
  v_count int;
begin
  -- Lock the household row so two concurrent joins can't both read count = 19 and both insert.
  perform 1 from households h where h.id = new.household_id for update;

  select count(*) into v_count from members where household_id = new.household_id;

  if v_count >= v_limit then
    raise exception 'member_limit_reached' using errcode = 'P0001';
  end if;

  return new;
end;
$$;
