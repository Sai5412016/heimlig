// lib/supabase.ts
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: Platform.OS === 'web' ? localStorage : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  realtime: {
    params: { eventsPerSecond: 10 }
  }
});

// ─── TYPES ───────────────────────────────────────────────────
export type PlanTier = 'free' | 'premium' | 'premium_plus' | 'family';
export type MemberRole = 'admin' | 'member';
export type TaskPriority = 'low' | 'normal' | 'high';
export type TransactionType = 'expense' | 'income';
export type Recurrence = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface Household {
  id: string;
  name: string;
  invite_code: string;
  plan_tier: PlanTier;
  gamification_enabled?: boolean;
  timetree_import_enabled?: boolean;
  digest_enabled?: boolean;
  currency?: string;
  timezone?: string;
  country?: string;
  // Bestandsschutz: true for every household that already existed when premium gating shipped
  // (see the premium_gating_grandfather_and_import_limit migration) — grants the same
  // unlimited access as plan_tier === 'premium' without actually changing plan_tier, so it
  // can't be confused with (or accidentally overwritten by) a real purchase.
  grandfathered?: boolean;
  // Asked at onboarding but not yet persisted anywhere server-side — see sql/household_type.sql
  // (not applied). Optional here on purpose: stays undefined until that migration lands, and
  // select('*') simply omits the key from the response until the column exists.
  household_type?: 'couple' | 'wg' | 'family' | 'solo';
  created_at: string;
}

export interface Member {
  id: string;
  // Null on an anonymised row — see `deleted_at`.
  user_id: string | null;
  household_id: string;
  display_name: string;
  avatar_color: string;
  role: MemberRole;
  joined_at: string;
  // Set when the person deleted their account while household content still referenced them.
  // The row survives only as an anchor for that content: no auth user, no name, role reset to
  // 'member'. Every query that loads members filters these out (`.is('deleted_at', null)`), so a
  // Member reaching the UI always represents a real person — content still pointing at the row
  // falls back to common.formerMember via lib/memberNames.ts.
  deleted_at?: string | null;
}

export interface ShoppingList {
  id: string;
  household_id: string;
  name: string;
  emoji: string;
  created_by: string;
  created_at: string;
}

export interface ShoppingItem {
  id: string;
  list_id: string;
  name: string;
  quantity?: string;
  category: string;
  brand?: string;
  barcode?: string;
  checked: boolean;
  checked_by?: string;
  checked_at?: string;
  added_by?: string;
  meal_plan_id?: string;
  recipe_id?: string;
  sort_order: number;
  created_at: string;
}

export interface Task {
  id: string;
  household_id: string;
  title: string;
  description?: string;
  assigned_to?: string;
  rotation?: string[];
  created_by?: string;
  due_date?: string;
  // null, not just undefined: an open task comes back from Postgres with completed_at = null,
  // and completeTask writes null to clear it again. Typing these as string | undefined was a
  // lie about what the row actually holds.
  completed_at?: string | null;
  completed_by?: string | null;
  category: string;
  priority: TaskPriority;
  recurrence?: Recurrence;
  recurrence_day?: number;
  recurrence_interval?: number;
  due_time?: string;
  google_event_id?: string;
  points: number;
  created_at: string;
  attachment_path?: string;
  attachment_name?: string;
  location_url?: string;
  remind_time?: string;
  pinned?: boolean;
}

export interface Transaction {
  id: string;
  household_id: string;
  member_id?: string;
  amount: number;
  type: TransactionType;
  category: string;
  description?: string;
  receipt_url?: string;
  transaction_date: string;
  recurrence?: string;
  recurrence_interval?: number;
  recurrence_next?: string;
  created_at: string;
}

export interface BudgetLimit {
  id: string;
  household_id: string;
  category: string;
  monthly_limit: number;
}

export interface RecipeIngredient {
  name: string;
  quantity?: string;
  category: string;
  include: boolean;
}

export interface Recipe {
  id: string;
  household_id: string;
  name: string;
  source_url?: string;
  source_text?: string;
  source_image_path?: string;
  ingredients: RecipeIngredient[];
  instructions?: string[];
  is_favorite?: boolean;
  category?: string;
  created_by?: string;
  created_at: string;
}

export interface Reward {
  id: string;
  household_id: string;
  title: string;
  emoji?: string;
  cost: number;
  created_by?: string;
  created_at: string;
}

export interface RewardRedemption {
  id: string;
  household_id: string;
  reward_id?: string;
  member_id: string;
  title: string;
  emoji?: string;
  cost: number;
  created_at: string;
}

export interface MemberLocation {
  member_id: string;
  household_id: string;
  lat: number;
  lng: number;
  accuracy?: number;
  updated_at: string;
}

export interface HouseholdMessage {
  id: string;
  household_id: string;
  member_id?: string;
  text: string;
  created_at: string;
}

export interface Settlement {
  id: string;
  household_id: string;
  from_member: string;
  to_member: string;
  amount: number;
  created_by?: string;
  created_at: string;
}

export interface HouseholdNote {
  id: string;
  household_id: string;
  title: string;
  content?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface PantryItem {
  id: string;
  household_id: string;
  name: string;
  emoji?: string;
  quantity?: string;
  expiry_date?: string;
  barcode?: string;
  added_by?: string;
  created_at: string;
}

// In-app feedback. Rows are only ever written by the submit-feedback edge function (service
// role) — `feedback` has no client-writable RLS policy, so the client can read its own rows
// but never create one. Text only, never audio (voice input goes through the keyboard's own
// microphone key, which transcribes before the app sees anything).
export type FeedbackStatus = 'delivered' | 'rejected';

export interface Feedback {
  id: string;
  user_id: string;
  household_id?: string | null;
  message: string;
  contact_email?: string | null;
  status: FeedbackStatus;
  reject_reason?: string | null;
  app_version?: string | null;
  platform?: string | null;
  created_at: string;
}

export type MealType = 'fruehstueck' | 'mittag' | 'abendessen';

export interface MealPlan {
  id: string;
  household_id: string;
  recipe_id?: string;
  recipe_name: string;
  planned_date: string;
  meal_type: MealType;
  created_by?: string;
  created_at: string;
}
