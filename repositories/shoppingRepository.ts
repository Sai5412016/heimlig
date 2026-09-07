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

// Moves an item to a different list — as an INSERT into the target list followed by a DELETE
// from the source list, NOT a plain `update({ list_id })`.
//
// Why not the obvious update: Supabase Realtime's postgres_changes filter is evaluated against
// the row AFTER the change. An UPDATE that changes list_id from A to B only matches a channel
// filtered on `list_id=eq.B` (the new value) — a channel filtered on `list_id=eq.A` (the old
// list, subscribeToShoppingItems in shopping.tsx) never sees it, so on a second device that still
// has list A open the item would silently stay on screen until the next manual reload.
// INSERT is filtered on the new row, DELETE on the old row, so splitting the move into those two
// operations makes both affected channels fire reliably: the item vanishes from A and appears in
// B on every device watching either list, not just the one that made the change.
//
// Not atomic (two round-trips) — acceptable here since this is a shopping list, not money. If the
// delete fails after a successful insert, the just-inserted row is rolled back rather than left
// behind as a duplicate.
export async function moveShoppingItem(item: ShoppingItem, targetListId: string): Promise<ShoppingItem | null> {
  const { data, error: insertError } = await supabase.from('shopping_items').insert({
    list_id: targetListId,
    name: item.name,
    quantity: item.quantity,
    category: item.category,
    brand: item.brand,
    barcode: item.barcode,
    checked: item.checked,
    checked_by: item.checked_by,
    checked_at: item.checked_at,
    added_by: item.added_by,
    meal_plan_id: item.meal_plan_id,
    recipe_id: item.recipe_id,
  }).select().single();
  if (insertError || !data) return null;

  const { error: deleteError } = await supabase.from('shopping_items').delete().eq('id', item.id);
  if (deleteError) {
    // Couldn't remove the source row — undo the insert so the item doesn't end up duplicated
    // across both lists.
    await supabase.from('shopping_items').delete().eq('id', data.id);
    return null;
  }
  return data;
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
