-- Play Billing infrastructure: purchases table + RLS.
-- Run this once in the Supabase SQL editor (project eabwlyihcmofkbqtbryz).
-- Not tracked as an ongoing local-migrations setup (see CONTEXT.md convention) — this file
-- only exists because the MCP apply_migration/execute_sql calls were blocked mid-session;
-- delete it after running once applied, same as any other one-off schema change.

create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  product_id text not null,
  purchase_token text not null unique,
  platform text not null check (platform in ('android', 'ios')),
  status text not null check (status in ('active', 'expired', 'cancelled', 'refunded')) default 'active',
  purchased_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.purchases enable row level security;

-- Household members can see their household's purchase history. Deliberately NO insert/
-- update/delete policy for `authenticated` at all — a client sending a fabricated purchase
-- token could otherwise grant itself Premium for free. All writes go through the
-- verify-purchase edge function, which uses the service-role key (bypasses RLS) only after
-- validating the token against the Google Play Developer API server-side.
create policy "purchases_select" on public.purchases for select
  using (is_household_member(household_id));

create index purchases_household_idx on public.purchases (household_id);
