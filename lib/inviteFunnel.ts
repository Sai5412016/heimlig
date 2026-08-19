// lib/inviteFunnel.ts — instruments the household-invite funnel (invite_opened -> invite_shared
// -> join_opened -> join_completed) into public.invite_funnel_events. See sql/invite_funnel.sql
// (not applied yet) for the table/RPC/view this talks to.
//
// Fire-and-forget everywhere: a failed analytics write must never break the actual invite/join
// flow, so every function here swallows its own errors instead of throwing into the caller.
import { supabase } from './supabase';

export type InviteFunnelStep = 'invite_opened' | 'invite_shared' | 'join_opened' | 'join_completed';

export function logInviteFunnelStep(step: InviteFunnelStep, householdId: string): void {
  (async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return; // no user_id to log yet — see report for where this applies
      await supabase.from('invite_funnel_events').insert({ household_id: householdId, user_id: user.id, step });
    } catch {
      // analytics only, never surfaced to the user
    }
  })();
}

// Resolves an invite code to its household WITHOUT joining, so join_opened can be logged with a
// real household_id before the recipient commits. Needs sql/invite_funnel.sql's
// resolve_invite_code() RPC applied first — until then this silently returns null and
// join_opened just isn't logged for that path.
export async function resolveInviteCode(code: string): Promise<{ household_id: string; household_name: string } | null> {
  try {
    const { data, error } = await supabase.rpc('resolve_invite_code', { p_invite_code: code });
    if (error || !data || data.length === 0) return null;
    return data[0];
  } catch {
    return null;
  }
}
