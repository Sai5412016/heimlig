// lib/paywallEvents.ts — records whether the AI-quota wall is ever seen and ever acted on.
//
// Deliberately writes to public.paywall_events, NOT to ai_usage_events: the free quota is
// enforced by counting rows in ai_usage_events for the month, so a row written there would eat
// into the user's own allowance — and it would do so exactly when they have already run out. See
// supabase/manual_migrations/2026-09-02_paywall_events.sql.
//
// Fire-and-forget, same contract as lib/inviteFunnel.ts: analytics must never break, delay or
// surface anything in the flow it observes. Until that migration is applied the insert simply
// fails and is swallowed.
import { supabase } from './supabase';

export type PaywallEvent = 'wall_shown' | 'upgrade_clicked';
export type PaywallSource = 'recipe_import' | 'receipt_scan' | 'event_photo';

export function logPaywallEvent(event: PaywallEvent, source: PaywallSource, householdId: string | null | undefined): void {
  if (!householdId) return;
  (async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('paywall_events').insert({
        household_id: householdId,
        user_id: user.id,
        event,
        source,
      });
    } catch {
      // analytics only, never surfaced to the user
    }
  })();
}
