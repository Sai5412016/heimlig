-- In-app feedback ("Feedback & Wünsche"). Run once in the Supabase SQL editor
-- (project eabwlyihcmofkbqtbryz), then this file can be deleted (see CONTEXT.md: schema
-- changes aren't tracked as a migration history).
--
-- Only TEXT is ever stored here. There is deliberately no audio: voice input happens through
-- the device keyboard's own microphone key, which transcribes before the text ever reaches the
-- app. That avoids a transcription service, audio storage and the extra privacy surface.
--
-- Writes come exclusively from the submit-feedback edge function using the service-role key.
-- The client can only ever READ ITS OWN rows — same pattern as `purchases`: no client-writable
-- policy at all, so nobody can forge a 'delivered' row or write on someone else's behalf.

create table if not exists public.feedback (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  -- Nullable on purpose: a user without a household (fresh sign-up, or after leaving the last
  -- one) must still be able to send feedback — that is exactly when it is most valuable.
  household_id  uuid references public.households(id) on delete set null,
  message       text not null,
  contact_email text,
  -- 'delivered' = passed the topic check and counts as real feedback.
  -- 'rejected'  = clearly off-topic/abusive; kept (not silently dropped) so a wrongly rejected
  --               message can still be found and read manually.
  status        text not null check (status in ('delivered', 'rejected')),
  reject_reason text,
  app_version   text,
  platform      text,
  created_at    timestamptz not null default now()
);

-- Reading the inbox is always "newest first, optionally filtered by status".
create index if not exists feedback_created_at_idx on public.feedback (created_at desc);
create index if not exists feedback_status_created_idx on public.feedback (status, created_at desc);

alter table public.feedback enable row level security;

-- Users see their own submissions and nothing else. Note this covers rejected rows too, which
-- is intended: the sender should be able to see that their message was not accepted.
drop policy if exists feedback_select on public.feedback;
create policy feedback_select on public.feedback
  for select using (user_id = auth.uid());

-- No INSERT / UPDATE / DELETE policy exists on purpose. Without one, RLS denies those for every
-- client role, so the only writer is the edge function's service-role client (which bypasses
-- RLS). Do not add a client INSERT policy — it would let anyone write a 'delivered' row and
-- skip the topic check entirely.
