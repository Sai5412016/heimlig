-- Security P0 hardening — apply via mcp__Supabase__apply_migration once the MCP
-- connection is back. Re-verify exact function signatures against pg_proc first
-- (see verification query at the bottom of this file) before running ALTER/REVOKE —
-- do not trust this file blindly, it was drafted while Supabase MCP was unreachable.

-- ── 1) Rate limiting for edge functions (needed by extract-recipe's rl_hit() call) ──
create table if not exists public.edge_rate_limits (
  user_id uuid not null,
  bucket text not null,
  window_start timestamptz not null,
  hits int not null default 0,
  primary key (user_id, bucket, window_start)
);
alter table public.edge_rate_limits enable row level security;
-- No policies for authenticated/anon on purpose: only reachable via the SECURITY DEFINER
-- rl_hit() RPC below (running as its owner), never via direct table access from a client.

create or replace function public.rl_hit(p_bucket text, p_limit int, p_window_seconds int default 3600)
returns boolean -- true = allowed, false = rate-limited
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_hits int;
begin
  if auth.uid() is null then
    return false;
  end if;
  insert into public.edge_rate_limits (user_id, bucket, window_start, hits)
  values (auth.uid(), p_bucket, v_window, 1)
  on conflict (user_id, bucket, window_start)
  do update set hits = edge_rate_limits.hits + 1
  returning hits into v_hits;
  return v_hits <= p_limit;
end;
$$;
revoke all on function public.rl_hit(text, int, int) from public;
grant execute on function public.rl_hit(text, int, int) to authenticated;

-- ── 2) Harden existing SECURITY DEFINER functions ──
-- Signatures as observed via get_advisors earlier in this session — VERIFY against
-- pg_proc before applying (query at bottom) in case anything changed since.
alter function public.is_household_member(uuid) set search_path = public, pg_temp;
alter function public.create_household_for_user(text, text, text) set search_path = public, pg_temp;
alter function public.join_household_by_code(text, text, text) set search_path = public, pg_temp;
alter function public.bump_item_catalog(uuid, text, text) set search_path = public, pg_temp;

revoke all on function public.is_household_member(uuid) from public;
revoke all on function public.create_household_for_user(text, text, text) from public;
revoke all on function public.join_household_by_code(text, text, text) from public;
revoke all on function public.bump_item_catalog(uuid, text, text) from public;

grant execute on function public.is_household_member(uuid) to authenticated;
grant execute on function public.create_household_for_user(text, text, text) to authenticated;
grant execute on function public.join_household_by_code(text, text, text) to authenticated;
grant execute on function public.bump_item_catalog(uuid, text, text) to authenticated;

-- ── 3) BONUS finding (not in the original report): households/members INSERT is
-- WITH CHECK (true). No app code inserts into these tables directly — everything goes
-- through create_household_for_user / join_household_by_code, which are SECURITY DEFINER
-- and bypass RLS anyway. That means the permissive INSERT policy is pure attack surface:
-- any authenticated client could call supabase.from('members').insert({...,role:'admin'})
-- directly and join ANY household without an invite code. Close it — RPCs still work
-- because SECURITY DEFINER functions bypass RLS regardless of table policies.
drop policy if exists "households_insert" on public.households;
drop policy if exists "members_insert" on public.members;
-- (No replacement INSERT policy for authenticated: all inserts must go through the RPCs.)

-- ── 4) member_locations TTL — stale shares older than 2h no longer visible/queryable.
-- Prefer pg_cron if the extension is available (check with list_extensions first);
-- otherwise this app-level fallback runs on every loadLocations() call.
create or replace function public.purge_stale_locations()
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from public.member_locations where updated_at < now() - interval '2 hours';
$$;
revoke all on function public.purge_stale_locations() from public;
grant execute on function public.purge_stale_locations() to authenticated;
-- If pg_cron is available:
-- select cron.schedule('purge-member-locations', '*/15 * * * *',
--   $$ delete from public.member_locations where updated_at < now() - interval '2 hours' $$);

-- ═══════════════════════════════════════════════════════════════════
-- VERIFY FIRST — run this before the ALTER/REVOKE/GRANT statements above:
-- select p.proname, pg_get_function_identity_arguments(p.oid) as args
-- from pg_proc p join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public'
--   and p.proname in ('is_household_member','create_household_for_user',
--                      'join_household_by_code','bump_item_catalog');
--
-- select schemaname, tablename, policyname, cmd, roles, qual, with_check
-- from pg_policies where schemaname='public' and tablename in ('households','members');
--
-- select extname from pg_extension where extname = 'pg_cron';
-- ═══════════════════════════════════════════════════════════════════
