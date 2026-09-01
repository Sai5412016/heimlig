-- 2026-09-01_account_deletion_fix_admin_role.sql
-- Follow-up to 2026-09-01_account_deletion.sql. Two defects found in the test run of the
-- deletion path; this file replaces the two affected functions and repairs existing rows.
--
-- Defect 1 — the tombstone kept role = 'admin'.
--   delete_account() moved the admin role to the next member but left the leaving member's own
--   role untouched while anonymising it. The household was then formally left with two admins,
--   one of which is a row nobody can log in as. Harmless in the app today (every admin check
--   runs through is_household_admin(), which matches on user_id = auth.uid() and so can never
--   match a tombstone with user_id NULL) but wrong in the data, and one is_household_admin
--   rewrite away from becoming a real privilege bug.
--
-- Defect 2 — enforce_member_limit() counted tombstones.
--   The cap is a plain count over members, so every anonymised row permanently used up one of
--   the 20 slots in that household. The cap itself is unchanged at 20; only rows that no longer
--   represent a person stop being counted.

-- 1) delete_account: strip the role along with the rest of the identity -------------------------
create or replace function public.delete_account(p_user_id uuid)
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
  v_result         jsonb := '[]'::jsonb;
begin
  if p_user_id is null then
    raise exception 'delete_account: p_user_id is required';
  end if;

  for v_m in
    select m.id, m.household_id, m.role, h.name as household_name
    from members m
    join households h on h.id = m.household_id
    where m.user_id = p_user_id
    order by m.joined_at
  loop
    -- The same row lock enforce_member_limit() takes on join. Without it, someone joining at this
    -- exact moment could land in a household that the branch below is about to delete, or the
    -- last admin could leave without handing over.
    perform 1 from households where id = v_m.household_id for update;

    select count(*) into v_other_members
    from members
    where household_id = v_m.household_id and id <> v_m.id and deleted_at is null;

    if v_other_members = 0 then
      -- Last one out. Everything household-scoped hangs off households.id with `on delete
      -- cascade`, so this single delete clears the lists, tasks, budget, recipes and the
      -- membership row along with it.
      delete from households where id = v_m.household_id;
      v_action := 'household_deleted';
      v_successor_name := null;

    else
      v_successor_id   := null;
      v_successor_name := null;

      -- Hand over only when this user is the LAST admin — if another admin is already there,
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

      -- Rows that belong to the person rather than to the household. push_tokens especially has
      -- to go: a token left behind would keep delivering this household's notifications to a
      -- device whose account no longer exists.
      delete from push_tokens      where member_id = v_m.id;
      delete from member_locations where member_id = v_m.id;
      delete from push_debug       where member_id = v_m.id;
      delete from member_scores    where member_id = v_m.id;

      -- Preferred outcome is that the row disappears entirely; that works only while nothing
      -- references it (a brand-new account, say). Rather than enumerate the nine referencing
      -- tables — and silently miss the tenth once somebody adds it — try the delete and fall
      -- back to the tombstone when the FKs refuse.
      --
      -- Deliberately NOT done: nulling those references instead. transactions.member_id IS NULL
      -- already means "gemeinsam bezahlt", so nulling would retroactively turn this person's
      -- expenses into shared ones and rewrite what everyone else owes.
      begin
        delete from members where id = v_m.id;
        v_action := 'member_deleted';
      exception when foreign_key_violation then
        perform set_config('app.member_admin_transfer', 'on', true);
        -- role goes back to 'member' in the same update: a tombstone is not a person and must
        -- not leave the household with a second, unreachable admin.
        update members
           set user_id = null, display_name = '', role = 'member', deleted_at = now()
         where id = v_m.id;
        perform set_config('app.member_admin_transfer', 'off', true);
        v_action := 'member_anonymised';
      end;
    end if;

    v_result := v_result || jsonb_build_object(
      'household_id',   v_m.household_id,
      'household_name', v_m.household_name,
      'action',         v_action,
      'new_admin',      v_successor_name
    );
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


-- 2) Member cap: don't let anonymised rows occupy a slot ----------------------------------------
-- Unchanged from the live version except for `and deleted_at is null` in the count. The cap is
-- still 20 for every tier — this is the abuse guard, not a paid feature gate.
create or replace function public.enforce_member_limit()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_limit constant int := 20;
  v_count int;
begin
  perform 1 from households h where h.id = new.household_id for update;

  select count(*) into v_count
  from members
  where household_id = new.household_id and deleted_at is null;

  if v_count >= v_limit then
    -- Bare marker string: the app matches on it (isMemberLimitError in lib/premium.ts) and
    -- shows a translated message, so this text is never displayed to a user directly.
    raise exception 'member_limit_reached' using errcode = 'P0001';
  end if;

  return new;
end;
$fn$;


-- 3) Repair rows already written by the first version -------------------------------------------
-- Scoped to anonymised rows only (deleted_at is not null), so it can never touch a real member.
-- Needs the same bypass as delete_account, because trg_prevent_member_field_escalation blocks
-- role changes.
do $do$
begin
  perform set_config('app.member_admin_transfer', 'on', true);
  update members set role = 'member' where deleted_at is not null and role <> 'member';
  perform set_config('app.member_admin_transfer', 'off', true);
end
$do$;
