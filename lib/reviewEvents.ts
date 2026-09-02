// lib/reviewEvents.ts — records that somebody wanted to rate the app, and which way they were
// sent. See supabase/manual_migrations/2026-09-02_review_events.sql.
//
// Writes to public.review_events, deliberately NOT to paywall_events: that table's CHECKs are
// scoped to the three AI features and to wall_shown/upgrade_clicked, and analytics.
// v_paywall_conversion divides by them. Rating rows in there would corrupt a number used for
// monetisation decisions.
//
// INTENT, NEVER OUTCOME. Google's In-App Review API reports nothing back — not whether the sheet
// appeared, not whether a rating was left, and a quota can swallow the request without a trace.
// Once the store listing opens, the user is outside anything we can observe. The tap is all we
// have; do not build a "conversion rate" on top of this.
//
// Fire-and-forget, but not silent — same contract as lib/inviteFunnel.ts: a rejected insert
// returns an { error } rather than throwing, so it is checked and logged. An empty table proves
// nothing was written, never that nothing happened.
import { supabase } from './supabase';

export type ReviewEvent = 'review_tapped' | 'review_route';
export type ReviewRoute = 'in_app' | 'store';

export function logReviewEvent(event: ReviewEvent, householdId: string | null | undefined, route?: ReviewRoute): void {
  if (!householdId) return;
  (async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase.from('review_events').insert({
        household_id: householdId,
        user_id: user.id,
        event,
        route: event === 'review_route' ? route ?? null : null,
      });
      if (error) console.warn(`[reviewEvents] ${event} was not recorded —`, error.code, error.message);
    } catch (e: any) {
      console.warn(`[reviewEvents] ${event} threw before reaching the server —`, e?.message ?? e);
    }
  })();
}
