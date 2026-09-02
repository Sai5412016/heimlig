// lib/aiUsage.ts — client side of the shared monthly AI quota.
//
// The quota itself is enforced server-side in the three edge functions (extract-recipe,
// extract-receipt, extract-event) against public.ai_usage_events — never here. Everything in
// this file is display only: it answers "how many do I have left" so the user can see it BEFORE
// hitting the wall, and it reads the server's rejection when they do hit it.
import { supabase } from './supabase';
import { FREE_MONTHLY_AI_ACTIONS } from './premium';

// Start of the current calendar month in UTC — must match the monthStart the edge functions
// compute, or the number shown here and the number enforced there would drift apart.
function monthStartIso(): string {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

// How many AI actions this household has spent this calendar month, across all three features.
// Returns null if it can't be determined (offline, RLS, table not migrated yet) — callers treat
// null as "don't show a counter" rather than guessing a number and being wrong.
export async function fetchAiActionsUsed(householdId: string | null | undefined): Promise<number | null> {
  if (!householdId) return null;
  try {
    const { count, error } = await supabase
      .from('ai_usage_events')
      .select('id', { count: 'exact', head: true })
      .eq('household_id', householdId)
      .gte('created_at', monthStartIso());
    if (error) return null;
    return count ?? 0;
  } catch {
    return null;
  }
}

export const AI_ACTION_LIMIT = FREE_MONTHLY_AI_ACTIONS;

// The instant the quota window rolls over: 00:00 UTC on the first of next month. The other edge
// of the same window monthStartIso() opens, so the two must stay in step — a user told the wrong
// reset date is worse off than one told nothing.
export function nextQuotaReset(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1, 0, 0, 0, 0));
}

// Whole days until that moment, never less than 1: a reset a few hours away still reads as
// "tomorrow" rather than "in 0 days".
export function daysUntilQuotaReset(now: Date = new Date()): number {
  return Math.max(1, Math.ceil((nextQuotaReset().getTime() - now.getTime()) / 86_400_000));
}

// The edge functions answer a spent quota with 403 and { error: 'ai_limit_reached', used, limit }.
// supabase-js doesn't parse the body of a non-2xx function response automatically, so the raw
// Response has to be read off the thrown error (FunctionsHttpError.context). Shared by all three
// call sites so that quirk lives in exactly one place.
export async function readAiLimitError(e: any): Promise<{ used: number; limit: number } | null> {
  try {
    const body = await e?.context?.json();
    if (body?.error !== 'ai_limit_reached') return null;
    return {
      used: typeof body.used === 'number' ? body.used : FREE_MONTHLY_AI_ACTIONS,
      limit: typeof body.limit === 'number' ? body.limit : FREE_MONTHLY_AI_ACTIONS,
    };
  } catch {
    return null;
  }
}
