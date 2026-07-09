-- Heimlig Self — initial schema (run once against the new Supabase project).
-- Mirrors the auth pattern used by the main Heimlig app (Supabase Auth + RLS keyed
-- on auth.uid()), but scoped to a single-user profile instead of a household.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  avatar_color text not null default '#6C5CE7',
  language text not null default 'de' check (language in ('de', 'en')),
  dark_mode boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);
