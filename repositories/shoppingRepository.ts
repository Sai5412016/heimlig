// repositories/shoppingRepository.ts — thin data-access layer for the shopping domain.
// Store/UI code calls these functions instead of talking to Supabase directly, so a
// future swap (caching, offline queue, etc.) only touches this file.
import { supabase } from '../lib/supabase';
import type { ShoppingList, ShoppingItem } from '../lib/supabase';

export async function fetchShoppingLists(householdId: string): Promise<ShoppingList[]> {
  const { data } = await supabase.from('shopping_lists').select('*').eq('household_id', householdId);
  return data || [];
}

export async function createShoppingList(householdId: string, memberId: string, name: string, emoji: string): Promise<ShoppingList | null> {
  const { data } = await supabase
    .from('shopping_lists')
    .insert({ household_id: householdId, name, emoji, created_by: memberId })
    .select().single();
  return data ?? null;
}

export async function deleteShoppingList(id: string): Promise<void> {
  await supabase.from('shopping_items').delete().eq('list_id', id);
  await supabase.from('shopping_lists').delete().eq('id', id);
}

// Ordered by checked-state then manual sort order — used wherever items are displayed.
export async function fetchShoppingItems(listId: string): Promise<ShoppingItem[]> {
  const { data } = await supabase
    .from('shopping_items').select('*').eq('list_id', listId)
    .order('checked', { ascending: true }).order('sort_order', { ascending: true });
  return data || [];
}

// Unordered — used only by the household bootstrap, where order doesn't matter yet.
export async function fetchShoppingItemsUnordered(listId: string): Promise<ShoppingItem[]> {
  const { data } = await supabase.from('shopping_items').select('*').eq('list_id', listId);
  return data || [];
}

export async function toggleShoppingItem(id: string, checked: boolean): Promise<void> {
  await supabase
    .from('shopping_items')
    .update({ checked, checked_at: checked ? new Date().toISOString() : null })
    .eq('id', id);
}

export async function updateShoppingItemQuantity(id: string, quantity: string | null): Promise<void> {
  await supabase.from('shopping_items').update({ quantity }).eq('id', id);
}

export interface NewShoppingItem {
  list_id: string;
  name: string;
  quantity?: string;
  category: string;
  brand?: string | null;
  added_by?: string;
  meal_plan_id?: string;
  recipe_id?: string;
}

export async function insertShoppingItem(item: NewShoppingItem): Promise<ShoppingItem | null> {
  const { data } = await supabase.from('shopping_items').insert(item).select().single();
  return data ?? null;
}

export async function deleteShoppingItem(id: string): Promise<void> {
  await supabase.from('shopping_items').delete().eq('id', id);
}

// Remove all not-yet-bought items that were added because of a given recipe — used when
// the user decides not to cook it after all and wants those ingredients out of the cart.
export async function deleteUncheckedItemsByRecipe(recipeId: string): Promise<void> {
  await supabase.from('shopping_items').delete().eq('recipe_id', recipeId).eq('checked', false);
}

// Realtime subscription for a list's items. Returns an unsubscribe function.
export function subscribeToShoppingItems(listId: string, onChange: () => void): () => void {
  const channel = supabase
    .channel(`shopping_items:${listId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'shopping_items',
      filter: `list_id=eq.${listId}`,
    }, onChange)
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}
