-- 2026-09-02_remove_membership.sql
-- "Haushalt verlassen" and "Mitglied entfernen" silently do nothing today.
--
-- Both call sites delete the members row directly. Of the ten foreign keys pointing at `members`,
-- nine are NO ACTION, so the delete is refused for anyone who ever created a task, transaction,
-- recipe, list or item. Neither call site checks the error, so the UI reports success while the
-- row is still there — reproduced in the browser with member e019fa57-0397-4fd3-8d97-4aaad7731ca1
-- (2 referencing rows in transactions.member_id, transactions_member_id_fkey = NO ACTION).
--
-- Account deletion already solved this exact problem in 2026-09-01_account_deletion.sql. Rather
-- than write the logic a second time, that function's per-membership body moves into
-- remove_membership_unchecked() below, and delete_account() now calls it. delete_account's
-- behaviour is deliberately unchanged: it is tested and live, so the body was moved, not edited.

-- 1) The shared logic ---------------------------------------------------------------------------
-- NO authorization check — that is the caller's job. Never grant this to a client: it takes an
-- arbitrary member id and would let anyone throw anyone out of any household. Callers are
-- delete_account() (service role) and remove_membership() (checks auth.uid() first).
create or replace function public.remove_membership_unchecked(p_member_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_m              record;
  v_other_members  int;
  v_other_admins   int;
  v_successor_id   uuid;
  v_successor_name text;
  v_action         text;
begin
  select m.id, m.household_id, m.role, h.name as household_name
    into v_m
  from members m
  join households h on h.id = m.household_id
  where m.id = p_member_id;

  if not found then
    return jsonb_build_object('action', 'not_found');
  end if;

  -- The same row lock enforce_member_limit() takes on join. Without it, someone joining at this
  -- exact moment could land in a household that the branch below is about to delete, or the
  -- last admin could leave without handing over.
  perform 1 from households where id = v_m.household_id for update;

  select count(*) into v_other_members
  from members
  where household_id = v_m.household_id and id <> v_m.id and deleted_at is null;

  if v_other_members = 0 then
    -- Last one out. Everything household-scoped hangs off households.id with `on delete cascade`,
    -- so this single delete clears the lists, tasks, budget, recipes and the membership row.
    delete from households where id = v_m.household_id;
    return jsonb_build_object(
      'household_id',   v_m.household_id,
      'household_name', v_m.household_name,
      'action',         'household_deleted',
      'new_admin',      null
    );
  end if;

  -- Hand over only when this member is the LAST admin — if another admin is already there,
  -- nothing needs to change.
  if v_m.role = 'admin' then
    select count(*) into v_other_admins
    from members
    where household_id = v_m.household_id and id <> v_m.id
      and deleted_at is null and role = 'admin';

    if v_other_admins = 0 then
      -- Longest-standing member takes over.
      select id, display_name into v_successor_id, v_successor_name
      from members
      where household_id = v_m.household_id and id <> v_m.id and deleted_at is null
      order by joined_at asc nulls last, id asc
      limit 1;

      perform set_config('app.member_admin_transfer', 'on', true);
      update members set role = 'admin' where id = v_successor_id;
      perform set_config('app.member_admin_transfer', 'off', true);
    end if;
  end if;

  -- Rows that belong to the person rather than to the household. push_tokens especially has to
  -- go: a token left behind would keep delivering this household's notifications to a device
  -- whose owner is no longer in it.
  delete from push_tokens      where member_id = v_m.id;
  delete from member_locations where member_id = v_m.id;
  delete from push_debug       where member_id = v_m.id;
  delete from member_scores    where member_id = v_m.id;

  -- Preferred outcome is that the row disappears entirely; that works only while nothing
  -- references it. Rather than enumerate the nine referencing tables — and silently miss the
  -- tenth once somebody adds it — try the delete and fall back to the tombstone when the FKs
  -- refuse.
  --
  -- Deliberately NOT done: nulling those references instead. transactions.member_id IS NULL
  -- already means "gemeinsam bezahlt", so nulling would retroactively turn this person's
  -- expenses into shared ones and rewrite what everyone else owes.
  begin
    delete from members where id = v_m.id;
    v_action := 'member_deleted';
  exception when foreign_key_violation then
    perform set_config('app.member_admin_transfer', 'on', true);
    update members
       set user_id = null, display_name = '', role = 'member', deleted_at = now()
     where id = v_m.id;
    perform set_config('app.member_admin_transfer', 'off', true);
    v_action := 'member_anonymised';
  end;

  return jsonb_build_object(
    'household_id',   v_m.household_id,
    'household_name', v_m.household_name,
    'action',         v_action,
    'new_admin',      v_successor_name
  );
end;
$fn$;

revoke all on function public.remove_membership_unchecked(uuid) from public;
revoke all on function public.remove_membership_unchecked(uuid) from anon;
revoke all on function public.remove_membership_unchecked(uuid) from authenticated;


-- 2) The client-callable wrapper ----------------------------------------------------------------
-- Unlike delete_account (service-role only, takes a user id), this one is reachable from the app,
-- so it derives the actor from auth.uid() and refuses anything else. Two ways to be allowed:
-- you are removing yourself, or you are an admin of that member's household.
create or replace function public.remove_membership(p_member_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_uid       uuid := auth.uid();
  v_target    record;
  v_result    jsonb;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  select id, household_id, user_id into v_target
  from members
  where id = p_member_id and deleted_at is null;

  if not found then
    raise exception 'member_not_found' using errcode = 'P0001';
  end if;

  -- is_household_admin() reads auth.uid() itself, so it checks the CALLER, not the target.
  if v_target.user_id is distinct from v_uid
     and not is_household_admin(v_target.household_id) then
    raise exception 'not_permitted' using errcode = 'P0001';
  end if;

  v_result := remove_membership_unchecked(p_member_id);
  return v_result || jsonb_build_object('ok', true);
end;
$fn$;

revoke all on function public.remove_membership(uuid) from public;
revoke all on function public.remove_membership(uuid) from anon;
grant execute on function public.remove_membership(uuid) to authenticated;


-- 3) delete_account now uses the shared function ------------------------------------------------
-- Same behaviour as the live version, byte for byte in what it does: the per-membership body was
-- moved into remove_membership_unchecked(), not changed. The loop, the edge_rate_limits cleanup
-- and the returned shape are untouched.
create or replace function public.delete_account(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_member_id uuid;
  v_result    jsonb := '[]'::jsonb;
begin
  if p_user_id is null then
    raise exception 'delete_account: p_user_id is required';
  end if;

  for v_member_id in
    select m.id from members m where m.user_id = p_user_id order by m.joined_at
  loop
    v_result := v_result || remove_membership_unchecked(v_member_id);
  end loop;

  -- Keyed by user_id but with no foreign key to auth.users, so deleting the auth user would
  -- leave these behind.
  delete from edge_rate_limits where user_id = p_user_id;

  return jsonb_build_object('ok', true, 'households', v_result);
end;
$fn$;

revoke all on function public.delete_account(uuid) from public;
revoke all on function public.delete_account(uuid) from anon;
revoke all on function public.delete_account(uuid) from authenticated;
grant execute on function public.delete_account(uuid) to service_role;
