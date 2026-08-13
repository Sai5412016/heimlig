// lib/premium.ts — single source of truth for "does this household have unlimited/Premium
// access", combining a real purchase (plan_tier) with grandfathered pre-existing households
// (see the households.grandfathered migration) so callers never need to check both fields
// themselves and risk getting the OR backwards.
import type { Household } from './supabase';

export function hasPremiumAccess(household: Pick<Household, 'plan_tier' | 'grandfathered'> | null | undefined): boolean {
  if (!household) return false;
  return household.plan_tier !== 'free' || household.grandfathered === true;
}

// Members allowed per household. Enforced server-side by the trg_enforce_member_limit trigger
// on `members` — these constants only drive what the UI *shows*, so they have to match the
// numbers in that trigger.
export const MEMBER_LIMIT_FREE = 3;
export const MEMBER_LIMIT_PREMIUM = 6;

export function memberLimit(household: Pick<Household, 'plan_tier' | 'grandfathered'> | null | undefined): number {
  return hasPremiumAccess(household) ? MEMBER_LIMIT_PREMIUM : MEMBER_LIMIT_FREE;
}

// The trigger raises a bare `member_limit_reached` exception; Supabase surfaces that as the
// error message. Detected here rather than at each of the three join call sites so the
// magic string lives in exactly one place.
export function isMemberLimitError(error: { message?: string } | null | undefined): boolean {
  return !!error?.message?.includes('member_limit_reached');
}
