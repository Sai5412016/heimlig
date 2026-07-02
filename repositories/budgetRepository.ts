// repositories/budgetRepository.ts — thin data-access layer for the budget/transactions domain.
// Screens call these functions instead of talking to Supabase directly.
import { supabase } from '../lib/supabase';
import type { Transaction } from '../lib/supabase';

// Returns null (not []) on a failed fetch so callers can choose to keep stale data instead
// of wiping the screen on a transient network error.
export async function fetchTransactions(householdId: string): Promise<Transaction[] | null> {
  const { data } = await supabase
    .from('transactions').select('*')
    .eq('household_id', householdId)
    .order('transaction_date', { ascending: false });
  return data;
}

// Used by the Home dashboard preview — same table, capped + no recurring-template filter.
// Returns null (not []) on a failed fetch so callers can choose to keep stale data instead
// of wiping the dashboard on a transient network error.
export async function fetchRecentTransactions(householdId: string, limit: number): Promise<Transaction[] | null> {
  const { data } = await supabase
    .from('transactions').select('*')
    .eq('household_id', householdId)
    .order('transaction_date', { ascending: false })
    .limit(limit);
  return data;
}

export async function fetchDueRecurringTemplates(householdId: string, today: string): Promise<Transaction[]> {
  const { data } = await supabase
    .from('transactions').select('*')
    .eq('household_id', householdId)
    .not('recurrence', 'is', null)
    .lte('recurrence_next', today);
  return data || [];
}

export async function insertTransactions(rows: Partial<Transaction>[]): Promise<Transaction[]> {
  if (rows.length === 0) return [];
  const { data } = await supabase.from('transactions').insert(rows).select();
  return data || [];
}

// Same bulk insert, but surfaces the error message for flows that show it to the user (CSV import).
export async function insertTransactionsChecked(rows: Partial<Transaction>[]): Promise<{ data: Transaction[]; error: string | null }> {
  const { data, error } = await supabase.from('transactions').insert(rows).select();
  return { data: data || [], error: error?.message ?? null };
}

export async function updateRecurrenceNext(id: string, next: string | null): Promise<void> {
  await supabase.from('transactions').update({ recurrence_next: next }).eq('id', id);
}

export async function insertTransaction(tx: Partial<Transaction>): Promise<Transaction | null> {
  const { data } = await supabase.from('transactions').insert(tx).select().single();
  return data ?? null;
}

export async function deleteTransaction(id: string): Promise<void> {
  await supabase.from('transactions').delete().eq('id', id);
}
