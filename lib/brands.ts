// lib/brands.ts — crowdsourced, household-shared brand catalog per supermarket (Yuka-style).
// When a shopping list is named after a known supermarket, items can carry a brand that the
// whole community has entered before. Brands are global (table public.product_brands) so the
// catalog grows for everyone, ranked by how often a brand is picked — shared across countries
// on purpose for chains that operate in several of them (Aldi, Lidl), same retailer either way.

import { supabase } from './supabase';

export interface SupermarketOption { name: string; emoji: string }

// Real chains per household country — same 15 countries as lib/holidays.ts. Only well-known,
// nationwide chains, same "we can't guess more precisely than this" reasoning as the holidays
// rule engine. Households whose country isn't listed get GENERIC_STORE_TYPES instead of a
// guessed (and likely wrong) set of foreign supermarket names.
export const COUNTRY_SUPERMARKETS: Record<string, SupermarketOption[]> = {
  DE: [
    { name: 'Rewe', emoji: '🛍️' }, { name: 'Aldi', emoji: '🛒' }, { name: 'Edeka', emoji: '🏪' },
    { name: 'Lidl', emoji: '💛' }, { name: 'Penny', emoji: '🟡' }, { name: 'Netto', emoji: '💰' },
    { name: 'dm', emoji: '💊' }, { name: 'Rossmann', emoji: '🌸' },
  ],
  AT: [
    { name: 'Billa', emoji: '🛍️' }, { name: 'Spar', emoji: '🟢' }, { name: 'Hofer', emoji: '🛒' },
    { name: 'Merkur', emoji: '🏪' }, { name: 'dm', emoji: '💊' }, { name: 'Bipa', emoji: '🌸' },
  ],
  CH: [
    { name: 'Migros', emoji: '🛍️' }, { name: 'Coop', emoji: '🟠' }, { name: 'Denner', emoji: '🛒' },
    { name: 'Aldi', emoji: '🅰️' }, { name: 'Lidl', emoji: '💛' },
  ],
  US: [
    { name: 'Walmart', emoji: '🏬' }, { name: 'Target', emoji: '🎯' }, { name: 'Kroger', emoji: '🛒' },
    { name: 'Costco', emoji: '📦' }, { name: "Trader Joe's", emoji: '🌺' }, { name: 'Whole Foods', emoji: '🥑' },
    { name: 'Safeway', emoji: '🏪' }, { name: 'CVS', emoji: '💊' },
  ],
  GB: [
    { name: 'Tesco', emoji: '🛍️' }, { name: "Sainsbury's", emoji: '🍊' }, { name: 'Asda', emoji: '🟢' },
    { name: 'Morrisons', emoji: '🏪' }, { name: 'Aldi', emoji: '🛒' }, { name: 'Lidl', emoji: '💛' },
    { name: 'Waitrose', emoji: '🌿' }, { name: 'Boots', emoji: '💊' },
  ],
  FR: [
    { name: 'Carrefour', emoji: '🔵' }, { name: 'Leclerc', emoji: '🟢' }, { name: 'Auchan', emoji: '🔴' },
    { name: 'Intermarché', emoji: '🏪' }, { name: 'Lidl', emoji: '💛' }, { name: 'Monoprix', emoji: '🟣' },
  ],
  ES: [
    { name: 'Mercadona', emoji: '🍊' }, { name: 'Carrefour', emoji: '🔵' }, { name: 'Lidl', emoji: '💛' },
    { name: 'Dia', emoji: '🔴' }, { name: 'Eroski', emoji: '🟢' },
  ],
  IT: [
    { name: 'Coop', emoji: '🟠' }, { name: 'Conad', emoji: '🔴' }, { name: 'Esselunga', emoji: '🟡' },
    { name: 'Carrefour', emoji: '🔵' }, { name: 'Lidl', emoji: '💛' },
  ],
  NL: [
    { name: 'Albert Heijn', emoji: '🔵' }, { name: 'Jumbo', emoji: '🟡' }, { name: 'Lidl', emoji: '💛' },
    { name: 'Aldi', emoji: '🛒' }, { name: 'Plus', emoji: '🟢' },
  ],
  PL: [
    { name: 'Biedronka', emoji: '🐞' }, { name: 'Lidl', emoji: '💛' }, { name: 'Żabka', emoji: '🐸' },
    { name: 'Carrefour', emoji: '🔵' }, { name: 'Auchan', emoji: '🔴' },
  ],
  PT: [
    { name: 'Continente', emoji: '🔵' }, { name: 'Pingo Doce', emoji: '🟡' }, { name: 'Lidl', emoji: '💛' },
    { name: 'Auchan', emoji: '🔴' },
  ],
  IE: [
    { name: 'Tesco', emoji: '🛍️' }, { name: 'Dunnes Stores', emoji: '🟢' }, { name: 'SuperValu', emoji: '🔵' },
    { name: 'Lidl', emoji: '💛' }, { name: 'Aldi', emoji: '🛒' },
  ],
  CA: [
    { name: 'Loblaws', emoji: '🍁' }, { name: 'Walmart', emoji: '🏬' }, { name: 'Costco', emoji: '📦' },
    { name: 'Sobeys', emoji: '🟢' }, { name: 'No Frills', emoji: '🟡' },
  ],
  AU: [
    { name: 'Woolworths', emoji: '🟢' }, { name: 'Coles', emoji: '🔴' }, { name: 'Aldi', emoji: '🛒' },
    { name: 'IGA', emoji: '🏪' },
  ],
  NZ: [
    { name: 'Countdown', emoji: '🟡' }, { name: 'New World', emoji: '🔵' }, { name: "Pak'nSave", emoji: '🟠' },
  ],
};

// Generic, non-branded fallback for households whose country isn't in COUNTRY_SUPERMARKETS —
// nameKey is resolved via t() by the caller (shopping.tsx has the i18n context), unlike the
// literal brand names above which are proper nouns and intentionally never translated.
export const GENERIC_STORE_TYPES: { nameKey: string; emoji: string }[] = [
  { nameKey: 'shopping.lists.genericSupermarket', emoji: '🛒' },
  { nameKey: 'shopping.lists.genericPharmacy', emoji: '💊' },
  { nameKey: 'shopping.lists.genericOrganicStore', emoji: '🌿' },
  { nameKey: 'shopping.lists.genericConvenienceStore', emoji: '🏪' },
];

export function supermarketsForCountry(country?: string | null): SupermarketOption[] | null {
  if (!country) return null;
  return COUNTRY_SUPERMARKETS[country] ?? null;
}

// Every supermarket across every supported country, deduped by exact name — for looking up a
// name/emoji regardless of the household's own country (e.g. item_catalog.preferred_supermarket
// was set while shopping at a chain from a different country's chip list, or before this
// household's country was known).
export const ALL_SUPERMARKETS: SupermarketOption[] = Array.from(
  new Map(Object.values(COUNTRY_SUPERMARKETS).flat().map(s => [s.name, s])).values()
);

// Canonical supermarket names across every supported country — the "is this list a supermarket?"
// check for the brand catalog, independent of which country's chip list a household sees (a
// chain like Aldi or Lidl shares one catalog everywhere).
export const SUPERMARKET_NAMES = ALL_SUPERMARKETS.map(s => s.name);

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
