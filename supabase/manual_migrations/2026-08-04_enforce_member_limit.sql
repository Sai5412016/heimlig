-- Enforce the household member limit server-side: 3 for free households, 6 for premium or
-- grandfathered ones. Run once in the Supabase SQL editor (project eabwlyihcmofkbqtbryz),
-- then this file can be deleted (see CONTEXT.md: schema changes aren't tracked as migrations).
--
-- Implemented as a BEFORE INSERT trigger on `members` rather than inside
-- join_household_by_code, for two reasons:
--   1. It covers EVERY insert path (join RPC, household creation, any future one, and direct
--      client inserts), not just the one function.
--   2. It leaves the existing SECURITY DEFINER onboarding RPC untouched.
-- Same pattern as the existing trg_prevent_member_field_escalation trigger.
--
-- Existing households that are already over their limit are NOT affected — this only blocks
-- new inserts, it never removes anyone.

create or replace function public.enforce_member_limit()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_limit int;
  v_count int;
begin
  -- This condition mirrors hasPremiumAccess() in lib/premium.ts and the inline check in
  -- supabase/functions/extract-recipe/index.ts. If the premium rule ever changes, it has to
  -- change in all three places.
  -- FOR UPDATE locks the household row so two people joining at the same moment can't both
  -- pass the count check and end up one over the limit.
  select case when h.plan_tier <> 'free' or coalesce(h.grandfathered, false) then 6 else 3 end
    into v_limit
  from households h
  where h.id = new.household_id
  for update;

  -- No household row (yet): let the foreign key raise the real error instead of masking it.
  if v_limit is null then
    return new;
  end if;

  select count(*) into v_count from members where household_id = new.household_id;

  if v_count >= v_limit then
    -- Bare marker string: the app matches on it (isMemberLimitError in lib/premium.ts) and
    -- shows a translated message, so this text is never displayed to a user directly.
    raise exception 'member_limit_reached' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_member_limit on public.members;

create trigger trg_enforce_member_limit
  before insert on public.members
  for each row execute function public.enforce_member_limit();
