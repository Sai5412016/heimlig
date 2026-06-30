-- Shared household pinboard / chat
create table if not exists public.household_messages (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  member_id uuid,
  text text not null,
  created_at timestamptz not null default now()
);
create index if not exists messages_household_idx on public.household_messages (household_id, created_at);
alter table public.household_messages enable row level security;
drop policy if exists "messages_all" on public.household_messages;
create policy "messages_all" on public.household_messages
  for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
-- enable realtime
alter publication supabase_realtime add table public.household_messages;
