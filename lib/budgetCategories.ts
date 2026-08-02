// lib/budgetCategories.ts — the closed, stable set of German category keys used for budget
// transactions. Shared between app/(tabs)/budget.tsx and components that need to offer the
// same categories (e.g. ReceiptScanModal) so the list can't drift between the two.
export const CAT_EMOJIS: Record<string, string> = {
  'Lebensmittel': '🛒', 'Miete': '🏠', 'Transport': '🚗',
  'Freizeit': '🎮', 'Gesundheit': '💊', 'Kleidung': '👕',
  'Haushalt': '🔧', 'Kinder': '👶', 'Haustiere': '🐾',
  'Sparen': '💰', 'Restaurant': '🍽️', 'Urlaub': '✈️',
  'Elektronik': '💻', 'Sport': '🏃', 'Sonstiges': '📦',
};

export const ALL_CATEGORIES = Object.keys(CAT_EMOJIS);

export const CAT_COLORS: Record<string, string> = {
  'Lebensmittel': '#10B981', 'Miete': '#3B82F6', 'Transport': '#F59E0B',
  'Freizeit': '#8B5CF6', 'Gesundheit': '#EF4444', 'Kleidung': '#EC4899',
  'Haushalt': '#6B7280', 'Kinder': '#F97316', 'Haustiere': '#84CC16',
  'Sparen': '#14B8A6', 'Restaurant': '#F59E0B', 'Urlaub': '#06B6D4',
  'Elektronik': '#6366F1', 'Sport': '#22C55E', 'Sonstiges': '#9CA3AF',
};

// Category values are a closed, stable set of German keys (matches stored transaction data) —
// this only translates the label actually shown to the user, same pattern as shopping.tsx's
// categoryLabel(). Unknown/custom categories fall back to the raw key instead of disappearing.
export const categoryLabel = (t: (key: string, opts?: Record<string, unknown>) => string, cat: string): string =>
  t(`budget.categories.${cat}`, { defaultValue: cat });
