// lib/premium.ts — single source of truth for "does this household have unlimited/Premium
// access", combining a real purchase (plan_tier) with grandfathered pre-existing households
// (see the households.grandfathered migration) so callers never need to check both fields
// themselves and risk getting the OR backwards.
import type { Household } from './supabase';

export function hasPremiumAccess(household: Pick<Household, 'plan_tier' | 'grandfathered'> | null | undefined): boolean {
  if (!household) return false;
  return household.plan_tier !== 'free' || household.grandfathered === true;
}
