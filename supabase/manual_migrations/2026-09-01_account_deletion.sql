-- 2026-09-01_account_deletion.sql
-- Self-service account deletion (Google Play policy: an app with accounts must offer a way to
-- delete them, in-app and on the web).
--
-- Background — why this is more than "delete from members":
-- Of the 10 foreign keys pointing at `members`, 9 are NO ACTION (only member_scores cascades).
-- The moment somebody has created a task, transaction, recipe, shopping list or item, their
-- members row can no longer be deleted. And because members.user_id -> auth.users IS
-- `on delete cascade`, deleting the auth user runs into exactly the same violation, so
-- auth.admin.deleteUser() would fail for every real account.
--
-- The way out is a tombstone: keep the row as an anchor for content other people still need,
-- but strip everything personal from it (no auth user, no name). See delete_account below.

-- 1) Tombstone support ------------------------------------------------------------------------
-- deleted_at marks an anonymised row. The app filters these out of its member list, so they never
-- show up in pickers, scoreboards or the member count.
alter table public.members add column if not exists deleted_at timestamptz;

-- user_id has to become nullable: it is what a tombstone gives up, and nulling it is also what
-- stops auth.users' cascade from deleting the row (and tripping the FKs above) when the auth user
-- is removed a moment later.
alter table public.members alter column user_id drop not null;

comment on column public.members.deleted_at is
  'Set when the person deleted their account but their row is still referenced by household '
  'content. Row is anonymised (user_id NULL, display_name empty), grants no access, and is '
  'filtered out client-side. NULL for every normal member.';


-- 2) Escalation trigger: controlled bypass + a NULL hole closed ---------------------------------
create or replace function public.prevent_member_field_escalation()
returns trigger
language plpgsql
as $$
begin
  -- Controlled bypass for public.delete_account, which has to move the admin role to the next
  -- member and blank out the leaving user's row. The setting is transaction-local (third argument
  -- of set_config is `is_local`) and is only ever set inside that SECURITY DEFINER function.
  -- A client cannot reach it: PostgREST exposes functions, not arbitrary SQL, so there is no way
  -- to set the GUC and then issue an UPDATE in the same transaction.
  if coalesce(current_setting('app.member_admin_transfer', true), 'off') = 'on' then
    return new;
  end if;

  -- `is distinct from` instead of `<>`: with `<>` a NULL on either side makes the whole condition
  -- NULL rather than true, so an update setting one of these columns to NULL slipped through the
  -- check unnoticed. Tightened while we were in here.
  if new.user_id is distinct from old.user_id
     or new.household_id is distinct from old.household_id
     or new.role is distinct from old.role then
    raise exception 'Cannot change user_id, household_id, or role via direct update';
  end if;

  return new;
end;
$$;


-- 3) The deletion itself ------------------------------------------------------------------------
-- Runs as one transaction, per household, with the household row locked. Called only by the
-- delete-account edge function (service role), which deletes the auth user afterwards.
create or replace function public.delete_account(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
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
        update members
           set user_id = null, display_name = '', deleted_at = now()
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
$$;

-- Takes an arbitrary user id, so it must never be reachable from a client — otherwise anyone
-- could wipe someone else's memberships. Only the edge function (service role) may call it.
revoke all on function public.delete_account(uuid) from public;
revoke all on function public.delete_account(uuid) from anon;
revoke all on function public.delete_account(uuid) from authenticated;
grant execute on function public.delete_account(uuid) to service_role;


-- 4) Read-only preview for the confirmation screen ---------------------------------------------
-- Same rules as delete_account, so the screen can't drift from what actually happens. Takes no
-- argument and reads auth.uid(), so it can only ever describe the caller's own account.
create or replace function public.preview_account_deletion()
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid            uuid := auth.uid();
  v_m              record;
  v_other_members  int;
  v_other_admins   int;
  v_successor_name text;
  v_result         jsonb := '[]'::jsonb;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  for v_m in
    select m.id, m.household_id, m.role, h.name as household_name
    from members m
    join households h on h.id = m.household_id
    where m.user_id = v_uid
    order by m.joined_at
  loop
    select count(*) into v_other_members
    from members
    where household_id = v_m.household_id and id <> v_m.id and deleted_at is null;

    v_successor_name := null;
    if v_other_members > 0 and v_m.role = 'admin' then
      select count(*) into v_other_admins
      from members
      where household_id = v_m.household_id and id <> v_m.id
        and deleted_at is null and role = 'admin';

      if v_other_admins = 0 then
        select display_name into v_successor_name
        from members
        where household_id = v_m.household_id and id <> v_m.id and deleted_at is null
        order by joined_at asc nulls last, id asc
        limit 1;
      end if;
    end if;

    v_result := v_result || jsonb_build_object(
      'household_id',              v_m.household_id,
      'household_name',            v_m.household_name,
      'other_members',             v_other_members,
      'household_will_be_deleted', v_other_members = 0,
      'new_admin',                 v_successor_name
    );
  end loop;

  return jsonb_build_object('households', v_result);
end;
$$;

revoke all on function public.preview_account_deletion() from public;
revoke all on function public.preview_account_deletion() from anon;
grant execute on function public.preview_account_deletion() to authenticated;
