-- Make the default shopping list created for every new household language-aware. Run once in
-- the Supabase SQL editor (project eabwlyihcmofkbqtbryz), then this file can be deleted (see
-- CONTEXT.md: schema changes aren't tracked as migrations).
--
-- create_household_for_user() previously always named the default list 'Einkaufsliste',
-- regardless of the household's chosen app language — an English-language household got a
-- German list name from the very first screen. New optional p_language param (defaults to 'de'
-- so any caller that doesn't pass it yet keeps today's behavior) picks the list name instead.
-- Existing households/lists are untouched — this only affects the INSERT for newly created ones.

create or replace function public.create_household_for_user(
  p_name text, p_display_name text, p_avatar_color text, p_language text default 'de'
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

  insert into households (name) values (p_name) returning id into v_household_id;
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
