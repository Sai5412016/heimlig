// lib/inviteFunnel.ts — instruments the household-invite funnel (invite_opened -> invite_shared
// -> join_opened -> join_completed) into public.invite_funnel_events. See sql/invite_funnel.sql
// (not applied yet) for the table/RPC/view this talks to.
//
// Fire-and-forget everywhere: a failed analytics write must never break the actual invite/join
// flow, so every function here swallows its own errors instead of throwing into the caller.
//
// SWALLOWED, BUT NOT SILENT. Every write below logs a warning when it fails. supabase-js RETURNS
// an { error } on a rejected insert rather than throwing, so a try/catch alone catches nothing —
// an RLS denial or a violated CHECK used to leave no trace at all: no row, no warning, nothing.
//
// That gap has misled us three times in one week, always the same way: an empty analytics table
// was read as "nobody does this", when the truth was "nothing was written". recipe_import_events
// looked like nobody imported recipes while the function simply wasn't writing; share_events was
// read as "invites never get sent" while that table measures something else entirely; and
// invite_funnel_events' anon_id column looked broken when the branch was merely never reached.
//
// So: an empty table only ever proves that nothing was written. It never proves that nothing
// happened. These warnings are what makes the difference visible.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

// invite_code_copied is tracked separately from invite_shared on purpose: copying the code and
// pasting it by hand is a different act from the share sheet, and probably the more common
// one. Folding them together would hide which of the two people actually use.
export type InviteFunnelStep = 'invite_opened' | 'invite_shared' | 'invite_code_copied' | 'join_opened' | 'join_completed';

export function logInviteFunnelStep(step: InviteFunnelStep, householdId: string): void {
  (async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return; // no user_id to log yet
      const { error } = await supabase.from('invite_funnel_events').insert({ household_id: householdId, user_id: user.id, step });
      if (error) console.warn(`[inviteFunnel] ${step} was not recorded —`, error.code, error.message);
    } catch (e: any) {
      // Never surfaced to the user, but never invisible either — see the header.
      console.warn(`[inviteFunnel] ${step} threw before reaching the server —`, e?.message ?? e);
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
      const { error } = await supabase.from('invite_funnel_events').insert({ household_id: householdId, anon_id: anonId, step: 'join_opened' });
      if (error) console.warn('[inviteFunnel] anonymous join_opened was not recorded —', error.code, error.message);
    } catch (e: any) {
      console.warn('[inviteFunnel] anonymous join_opened threw before reaching the server —', e?.message ?? e);
    }
  })();
}

// Dedupes join_opened per code. app/join/[code].tsx's screen can legitimately mount more than
// once for the SAME physical "someone opened this invite" event: expo-router auto-navigates
// there the instant the link is tapped, then app/_layout.tsx's checkSession (pre-existing
// behavior, not new) and app/onboarding.tsx's post-login handoff (new in this release) both
// redirect back to /join/[code] again once the recipient has a session — each of those redirects
// is a fresh mount, and without this guard each one would log another join_opened row for what
// is, from the recipient's side, one single open. Cleared together with the pending code, so a
// genuinely new later attempt (or a different code entirely) still logs fresh.
const JOIN_OPENED_LOGGED_FOR_KEY = '@heimlig/joinOpenedLoggedForCode';

async function hasLoggedJoinOpened(code: string): Promise<boolean> {
  try { return (await AsyncStorage.getItem(JOIN_OPENED_LOGGED_FOR_KEY)) === code; } catch { return false; }
}

async function markJoinOpenedLogged(code: string): Promise<void> {
  try { await AsyncStorage.setItem(JOIN_OPENED_LOGGED_FOR_KEY, code); } catch { /* best-effort */ }
}

// Root cause of the 3 join_opened rows seen in production for one recipient: read-then-write
// across an `await` is not atomic. Android can genuinely deliver the SAME initial deep link
// twice to JS — once via Linking.getInitialURL() in app/_layout.tsx's cold-start path, and again
// via the Linking 'url' event listener firing once the bridge is up (a known RN/Expo double-
// delivery quirk on cold start) — so app/join/[code].tsx's effect can run twice in quick
// succession for one open. Both calls used to run `await hasLoggedJoinOpened(code)` — a separate
// AsyncStorage read — before either had written the "logged" flag with `markJoinOpenedLogged`;
// AsyncStorage has no compare-and-swap, so both reads returned "not logged yet" and both proceeded
// to insert a row. A synchronous, in-memory guard (checked and set with no `await` in between)
// closes that gap for calls within the same JS session, which is exactly where the race happens.
const loggedOrInFlightJoinOpenedCodes = new Set<string>();

// Single entry point for join_opened — folds in the dedup check so a call site can't accidentally
// log without it. authenticatedUserId is null for an anonymous opener (routes to
// logAnonymousJoinOpened instead).
//
// WHAT join_opened MEANS: "somebody holds an invite code and is trying to join". NOT "somebody
// opened a deep link". It used to mean the narrower thing purely by accident — app/join/[code].tsx
// was the only caller, while join_completed was logged from all three join routes, so the funnel
// reported more completions than opens. The other two callers are app/onboarding.tsx and
// app/(tabs)/household.tsx, both of which take a typed-in code, which is the route most people
// actually use.
//
// Because of that, the dedup below is load-bearing rather than a nicety: one recipient can pass
// through two of these call sites for a single arrival (deep link with no account -> onboarding
// -> sign up -> join). Every call site must pass the code normalised the same way
// (`.toUpperCase().trim()`), since the code string is the dedup key.
export function logJoinOpenedOnce(code: string, householdId: string, authenticatedUserId: string | null): void {
  if (loggedOrInFlightJoinOpenedCodes.has(code)) return;
  loggedOrInFlightJoinOpenedCodes.add(code);
  (async () => {
    if (await hasLoggedJoinOpened(code)) return;
    await markJoinOpenedLogged(code);
    if (authenticatedUserId) logInviteFunnelStep('join_opened', householdId);
    else logAnonymousJoinOpened(householdId);
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

// join_household_by_code's own static business-error text for "you're already a member of this
// household" (see that RPC's definition — it's the only branch that returns this exact string,
// no interpolation). Exact-string match, same pattern as isMemberLimitError in lib/premium.ts.
// This case is NOT a failure: the recipient's evident intent was to end up in that household, so
// every join call site treats it as success (switch to the household) rather than showing an
// error. Note the RPC does NOT return household_id in this branch — callers need
// resolveInviteCode() to get it.
const ALREADY_MEMBER_ERROR = 'Du bist bereits Mitglied in diesem Haushalt.';

export function isAlreadyMemberError(message: string | null | undefined): boolean {
  return message === ALREADY_MEMBER_ERROR;
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
const PENDING_CODE_SAVED_AT_KEY = '@heimlig/pendingInviteCodeSavedAt';
// A code that for any unforeseen reason never gets cleared (a bug, an error path nobody
// anticipated) must not be able to block a user forever — cap how long it's honored.
const PENDING_CODE_TTL_MS = 24 * 60 * 60 * 1000;

export async function savePendingInviteCode(code: string): Promise<void> {
  try {
    await AsyncStorage.setItem(PENDING_CODE_KEY, code);
    await AsyncStorage.setItem(PENDING_CODE_SAVED_AT_KEY, String(Date.now()));
  } catch { /* best-effort */ }
}

export async function getPendingInviteCode(): Promise<string | null> {
  try {
    const code = await AsyncStorage.getItem(PENDING_CODE_KEY);
    if (!code) return null;
    const savedAtRaw = await AsyncStorage.getItem(PENDING_CODE_SAVED_AT_KEY);
    const savedAt = savedAtRaw ? Number(savedAtRaw) : 0;
    // No timestamp (savedAt === 0) means this code was written by a build from before this
    // fix — treat it as expired too, which also self-heals any code already stuck in
    // AsyncStorage on a device from the production bug this fix addresses.
    if (Date.now() - savedAt > PENDING_CODE_TTL_MS) {
      await clearPendingInviteCode();
      return null;
    }
    return code;
  } catch { return null; }
}

export async function clearPendingInviteCode(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PENDING_CODE_KEY);
    await AsyncStorage.removeItem(PENDING_CODE_SAVED_AT_KEY);
    // Same lifecycle as the pending code itself: this join journey is over (completed or
    // abandoned in favor of creating a household), so a later new attempt — even with the same
    // code — should be free to log join_opened again.
    await AsyncStorage.removeItem(JOIN_OPENED_LOGGED_FOR_KEY);
    loggedOrInFlightJoinOpenedCodes.clear();
  } catch { /* best-effort */ }
}

// Whether `code` resolves to a household the caller already belongs to. Used to skip redirecting
// to app/join/[code].tsx altogether when it would just be a dead end: join_household_by_code can
// only ever answer "already a member" for that combination (see the RPC's definition). Returns
// false (safe default: keep the normal join flow) if the code can't be resolved at all.
export async function isPendingCodeAlreadyMember(code: string, memberHouseholdIds: string[]): Promise<boolean> {
  const resolved = await resolveInviteCode(code);
  return !!resolved && memberHouseholdIds.includes(resolved.household_id);
}
