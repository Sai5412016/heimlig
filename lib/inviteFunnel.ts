// lib/inviteFunnel.ts — instruments the household-invite funnel (invite_opened -> invite_shared
// -> join_opened -> join_completed) into public.invite_funnel_events. See sql/invite_funnel.sql
// (not applied yet) for the table/RPC/view this talks to.
//
// Fire-and-forget everywhere: a failed analytics write must never break the actual invite/join
// flow, so every function here swallows its own errors instead of throwing into the caller.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

export type InviteFunnelStep = 'invite_opened' | 'invite_shared' | 'join_opened' | 'join_completed';

export function logInviteFunnelStep(step: InviteFunnelStep, householdId: string): void {
  (async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return; // no user_id to log yet
      await supabase.from('invite_funnel_events').insert({ household_id: householdId, user_id: user.id, step });
    } catch {
      // analytics only, never surfaced to the user
    }
  })();
}

// join_opened is the one step that can legitimately happen before the opener has ever
// authenticated — that's the exact recipient-has-no-account case this whole feature is about.
// Needs sql/invite_funnel.sql's nullable user_id + anon_id column (see the report) applied
// first; until then the insert just fails silently, same fire-and-forget contract as above.
const ANON_ID_KEY = '@heimlig/anonId';

async function getOrCreateAnonId(): Promise<string> {
  const existing = await AsyncStorage.getItem(ANON_ID_KEY);
  if (existing) return existing;
  // Not a real UUID — doesn't need to be. This only ever labels an anonymous analytics row,
  // never anything security-sensitive, so a lightweight generator avoids pulling in a UUID lib
  // for one non-critical identifier.
  const id = `anon-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  await AsyncStorage.setItem(ANON_ID_KEY, id);
  return id;
}

export function logAnonymousJoinOpened(householdId: string): void {
  (async () => {
    try {
      const anonId = await getOrCreateAnonId();
      await supabase.from('invite_funnel_events').insert({ household_id: householdId, anon_id: anonId, step: 'join_opened' });
    } catch {
      // analytics only, never surfaced to the user
    }
  })();
}

// Resolves an invite code to its household WITHOUT joining, so join_opened can be logged with a
// real household_id before the recipient commits. Needs sql/invite_funnel.sql's
// resolve_invite_code() RPC applied first (and its execute grant now includes anon — see the
// report) — until then this silently returns null and join_opened just isn't logged.
export async function resolveInviteCode(code: string): Promise<{ household_id: string; household_name: string } | null> {
  try {
    const { data, error } = await supabase.rpc('resolve_invite_code', { p_invite_code: code });
    if (error || !data || data.length === 0) return null;
    return data[0];
  } catch {
    return null;
  }
}

// ─── Pending invite code — survives the auth flow (signup, email confirmation, login) ─────────
// Written as soon as app/join/[code].tsx sees a code, read by app/_layout.tsx (cold boot /
// login) and app/onboarding.tsx (post-signup), cleared once the join actually completes.
//
// AsyncStorage rather than a route param or Supabase user metadata: it's the only one of the
// three that survives ALL of (a) an app restart, (b) the user leaving the app to confirm their
// email in a separate mail client, and (c) working identically whether the recipient ends up
// signing up or logging into an existing account — a route param dies the moment the app
// re-launches, and user metadata can't be written until a user row exists, which doesn't help
// the pre-signup window where the code first needs to be captured. Known limitation: this is
// local to the device the link was first opened on — if the recipient opens the link on device A
// but confirms their email on device B, the pending code doesn't follow them there. Fixing that
// would need a server-side pending-invite record keyed by email, which is a bigger feature than
// this task asked for.
const PENDING_CODE_KEY = '@heimlig/pendingInviteCode';

export async function savePendingInviteCode(code: string): Promise<void> {
  try { await AsyncStorage.setItem(PENDING_CODE_KEY, code); } catch { /* best-effort */ }
}

export async function getPendingInviteCode(): Promise<string | null> {
  try { return await AsyncStorage.getItem(PENDING_CODE_KEY); } catch { return null; }
}

export async function clearPendingInviteCode(): Promise<void> {
  try { await AsyncStorage.removeItem(PENDING_CODE_KEY); } catch { /* best-effort */ }
}
