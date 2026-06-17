// lib/supabase.ts
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
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
  barcode?: string;
  checked: boolean;
  checked_by?: string;
  checked_at?: string;
  added_by?: string;
  sort_order: number;
  created_at: string;
}

export interface Task {
  id: string;
  household_id: string;
  title: string;
  description?: string;
  assigned_to?: string;
  created_by?: string;
  due_date?: string;
  completed_at?: string;
  completed_by?: string;
  category: string;
  priority: TaskPriority;
  recurrence?: Recurrence;
  recurrence_day?: number;
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
  created_at: string;
}

export interface BudgetLimit {
  id: string;
  household_id: string;
  category: string;
  monthly_limit: number;
}
