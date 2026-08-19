-- sql/household_type.sql — persist the onboarding "household type" answer (couple/wg/family/
-- solo), currently asked but discarded (see the PR-21 diagnosis: households has no matching
-- column, confirmed by introspection, not assumed). NOT applied.
--
-- DEPLOY ORDER: apply this before a build containing the client change (app/onboarding.tsx now
-- sends p_household_type) ships, so the type actually gets saved from day one. Not a hard
-- requirement anymore though — that client code catches PGRST202 ("Could not find the
-- function... in the schema cache", i.e. this overload doesn't exist yet) and retries once
-- without p_household_type, so shipping out of order degrades to "type not saved yet" instead of
-- breaking signups. Applying this first is still the point, that fallback is just a safety net.

alter table public.households
  add column if not exists household_type text
  check (household_type in ('couple', 'wg', 'family', 'solo'));

-- New overload (adds p_household_type after the existing p_language, with a default so any
-- caller that still only sends 4 args keeps working) — mirrors how p_language itself was added
-- on top of the original 3-arg version; both older overloads are left in place untouched, same
-- as they already were before this file.
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
