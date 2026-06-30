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
  created_at: string;
}

export interface Member {
  id: string;
  user_id: string;
  household_id: string;
  display_name: string;
  avatar_color: string;
  role: MemberRole;
  joined_at: string;
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
  completed_at?: string;
  completed_by?: string;
  category: string;
  priority: TaskPriority;
  recurrence?: Recurrence;
  recurrence_day?: number;
  recurrence_interval?: number;
  due_time?: string;
  points: number;
  created_at: string;
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
  ingredients: RecipeIngredient[];
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
