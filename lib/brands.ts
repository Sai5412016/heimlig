// lib/brands.ts — crowdsourced, household-shared brand catalog per supermarket (Yuka-style).
// When a shopping list is named after a known German supermarket, items can carry a brand
// that the whole community has entered before. Brands are global (table public.product_brands)
// so the catalog grows for everyone, ranked by how often a brand is picked.

import { supabase } from './supabase';

// Canonical supermarket names. The shopping screen owns the emojis; we only own the names here
// so the "is this list a supermarket?" check can't drift from the chip list.
export const SUPERMARKET_NAMES = ['Rewe', 'Aldi', 'Edeka', 'Lidl', 'Penny', 'Netto', 'dm', 'Rossmann'];

const SUPERMARKET_SET = new Set(SUPERMARKET_NAMES.map(s => s.toLowerCase()));

// Returns the normalized supermarket key for a list name, or null if it isn't a known supermarket.
export function supermarketKey(listName?: string | null): string | null {
  if (!listName) return null;
  const k = listName.toLowerCase().trim();
  return SUPERMARKET_SET.has(k) ? k : null;
}

export interface BrandEntry { brand: string; count: number }

// Fetch the most popular brands the community has entered for this product at this supermarket.
export async function searchBrands(smKey: string, itemName: string): Promise<BrandEntry[]> {
  const item = itemName.toLowerCase().trim();
  if (!smKey || !item) return [];
  const { data } = await supabase
    .from('product_brands')
    .select('brand, count')
    .eq('supermarket', smKey)
    .eq('item_key', item)
    .order('count', { ascending: false })
    .limit(8);
  return (data as BrandEntry[]) ?? [];
}

// Record a brand pick so it surfaces for the next person (fire-and-forget).
export function bumpBrand(smKey: string, itemName: string, brand: string) {
  const item = itemName.trim();
  if (!smKey || !item || !brand.trim()) return;
  supabase
    .rpc('bump_product_brand', { p_supermarket: smKey, p_item: item, p_brand: brand.trim() })
    .then(() => {}, () => {});
}
