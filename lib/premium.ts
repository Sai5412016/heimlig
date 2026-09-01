// lib/premium.ts — what Premium actually buys, in one place.
//
// Premium sells taken-over work, not a barrier: what it lifts is the monthly AI quota (plus the
// CSV export). Household size is NOT a paid feature any more — every tier gets the same cap.
import type { Household } from './supabase';

type HouseholdPlanFields = Pick<Household, 'plan_tier' | 'grandfathered'> | null | undefined;

// True Premium access: a real, paid plan. This is the ONLY thing that lifts the AI quota or
// unlocks the CSV export.
//
// Deliberately no longer ORs in `grandfathered` — see isGrandfathered() below for why.
export function hasPremiumAccess(household: HouseholdPlanFields): boolean {
  if (!household) return false;
  return household.plan_tier !== 'free';
}

// households.grandfathered existed to spare pre-existing households the old 3-member free
// limit. That limit is gone (sql/member_cap.sql: one cap of 20 for everyone), so the flag now
// grants nothing — it does NOT lift the AI quota, and a grandfathered household gets the same
// FREE_MONTHLY_AI_ACTIONS as any other free one.
//
// Kept as a named function rather than deleted so the column still has a defined meaning if it
// ever needs reading again (reporting, a future migration). Currently has no caller.
export function isGrandfathered(household: HouseholdPlanFields): boolean {
  return household?.grandfathered === true;
}

// Hard cap on members per household — identical for every tier. Not monetisation: an abuse
// guard so nobody inflates a household to thousands of rows. Enforced server-side by the
// trg_enforce_member_limit trigger on `members`; this constant only drives what the UI shows,
// so it has to match the number in sql/member_cap.sql.
export const HOUSEHOLD_MEMBER_CAP = 20;

// AI actions a free household may spend per calendar month, counted across recipe import,
// receipt scan and event-photo extraction TOGETHER (not 5 each). Premium is unlimited.
// Enforced server-side in all three edge functions against ai_usage_events — this constant only
// drives what the UI shows, so it has to match FREE_MONTHLY_AI_ACTIONS in those functions.
export const FREE_MONTHLY_AI_ACTIONS = 5;

// The trigger raises a bare `member_limit_reached` exception; Supabase surfaces that as the
// error message. Detected here rather than at each of the three join call sites so the
// magic string lives in exactly one place.
export function isMemberLimitError(error: { message?: string } | null | undefined): boolean {
  return !!error?.message?.includes('member_limit_reached');
}
