// lib/paywallEvents.ts — records whether the paywall is ever seen and ever acted on.
//
// Deliberately writes to public.paywall_events, NOT to ai_usage_events: the free quota is
// enforced by counting rows in ai_usage_events for the month, so a row written there would eat
// into the user's own allowance — and it would do so exactly when they have already run out. See
// supabase/manual_migrations/2026-09-02_paywall_events.sql.
//
// TWO DEPTHS OF THE SAME FUNNEL live in this table, and mixing them up when reading it gives a
// wrong answer:
//   - components/AiQuotaWallModal.tsx logs with the FEATURE that ran out
//     ('recipe_import' | 'receipt_scan' | 'event_photo').
//   - components/PremiumModal.tsx logs with the ENTRY it was opened from
//     ('csv_export' | 'plan_row' | 'quota_wall_button').
// A 'quota_wall_button' row is always preceded by one of the three feature rows — it is the same
// person one step further in, not a second person.
//
// Fire-and-forget, but NOT silent. supabase-js returns { error } on a rejected insert rather
// than throwing, so a try/catch alone catches nothing; the error is checked and logged, same
// contract as lib/inviteFunnel.ts and lib/reviewEvents.ts. This matters right now: the new
// source values are rejected by paywall_events_source_check until sql/paywall_source_widen.sql
// has been applied, and without this check that rejection would look exactly like success.
import { supabase } from './supabase';

export type PaywallEvent = 'wall_shown' | 'upgrade_clicked';

export type PaywallSource =
  // Which AI feature hit the monthly quota — emitted by AiQuotaWallModal.
  | 'recipe_import'
  | 'receipt_scan'
  | 'event_photo'
  // Which door into PremiumModal was used — emitted by PremiumModal itself.
  | 'csv_export'
  | 'plan_row'
  | 'quota_wall_button'
  // Reserved, nothing emits it today. See sql/paywall_source_widen.sql.
  | 'ai_quota';

export function logPaywallEvent(event: PaywallEvent, source: PaywallSource, householdId: string | null | undefined): void {
  if (!householdId) return;
  (async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase.from('paywall_events').insert({
        household_id: householdId,
        user_id: user.id,
        event,
        source,
      });
      if (error) console.warn(`[paywallEvents] ${event}/${source} was not recorded —`, error.code, error.message);
    } catch (e: any) {
      console.warn(`[paywallEvents] ${event}/${source} threw before reaching the server —`, e?.message ?? e);
    }
  })();
}
