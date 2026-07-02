// lib/pricing.ts — rough cost estimate for the shopping cart, based on average German
// supermarket prices (Rewe/Edeka/Aldi mid-range, 2026). This is a ballpark figure, not a
// real price lookup — there's no free, reliable live-price API for German supermarkets.

export type PriceUnit = 'g' | 'ml' | 'stück';
export interface PriceEntry { price: number; per: number; unit: PriceUnit }

// price = EUR for `per` amount of `unit`. Keys matched the same way as the shopping icons:
// exact match first, then longest keyword contained in the item name.
const AVG_PRICES: Record<string, PriceEntry> = {
  // Obst & Gemüse
  'äpfel': { price: 0.35, per: 1, unit: 'stück' }, 'apfel': { price: 0.35, per: 1, unit: 'stück' },
  'bananen': { price: 0.30, per: 1, unit: 'stück' }, 'banane': { price: 0.30, per: 1, unit: 'stück' },
  'birnen': { price: 0.45, per: 1, unit: 'stück' }, 'birne': { price: 0.45, per: 1, unit: 'stück' },
  'orangen': { price: 0.40, per: 1, unit: 'stück' }, 'orange': { price: 0.40, per: 1, unit: 'stück' },
  'zitronen': { price: 0.45, per: 1, unit: 'stück' }, 'zitrone': { price: 0.45, per: 1, unit: 'stück' },
  'limetten': { price: 0.40, per: 1, unit: 'stück' },
  'mandarinen': { price: 0.25, per: 1, unit: 'stück' }, 'clementinen': { price: 0.25, per: 1, unit: 'stück' },
  'weintrauben': { price: 0.35, per: 100, unit: 'g' }, 'trauben': { price: 0.35, per: 100, unit: 'g' },
  'erdbeeren': { price: 0.55, per: 100, unit: 'g' }, 'erdbeere': { price: 0.55, per: 100, unit: 'g' },
  'himbeeren': { price: 0.90, per: 100, unit: 'g' }, 'blaubeeren': { price: 0.80, per: 100, unit: 'g' },
  'kiwi': { price: 0.40, per: 1, unit: 'stück' }, 'mango': { price: 1.29, per: 1, unit: 'stück' },
  'ananas': { price: 2.29, per: 1, unit: 'stück' }, 'avocado': { price: 0.90, per: 1, unit: 'stück' },
  'wassermelone': { price: 0.35, per: 100, unit: 'g' }, 'melone': { price: 0.35, per: 100, unit: 'g' },
  'kirschen': { price: 0.90, per: 100, unit: 'g' }, 'pflaumen': { price: 0.35, per: 100, unit: 'g' },
  'tomaten': { price: 0.30, per: 100, unit: 'g' }, 'tomate': { price: 0.30, per: 100, unit: 'g' },
  'rispentomaten': { price: 0.35, per: 100, unit: 'g' },
  'cherrytomaten': { price: 0.45, per: 100, unit: 'g' }, 'cherry-tomaten': { price: 0.45, per: 100, unit: 'g' },
  'gurke': { price: 0.79, per: 1, unit: 'stück' }, 'salatgurke': { price: 0.79, per: 1, unit: 'stück' },
  'zucchini': { price: 0.69, per: 1, unit: 'stück' },
  'paprika': { price: 0.69, per: 1, unit: 'stück' }, 'spitzpaprika': { price: 0.69, per: 1, unit: 'stück' },
  'rote paprika': { price: 0.79, per: 1, unit: 'stück' },
  'chili': { price: 0.30, per: 1, unit: 'stück' }, 'peperoni': { price: 0.30, per: 1, unit: 'stück' },
  'aubergine': { price: 0.99, per: 1, unit: 'stück' },
  'karotten': { price: 0.25, per: 100, unit: 'g' }, 'möhren': { price: 0.25, per: 100, unit: 'g' }, 'karotte': { price: 0.25, per: 100, unit: 'g' },
  'kartoffeln': { price: 0.25, per: 100, unit: 'g' }, 'kartoffel': { price: 0.25, per: 100, unit: 'g' },
  'süßkartoffeln': { price: 0.40, per: 100, unit: 'g' },
  'zwiebeln': { price: 0.15, per: 1, unit: 'stück' }, 'zwiebel': { price: 0.15, per: 1, unit: 'stück' },
  'knoblauch': { price: 0.10, per: 1, unit: 'stück' },
  'brokkoli': { price: 1.49, per: 1, unit: 'stück' }, 'blumenkohl': { price: 1.49, per: 1, unit: 'stück' },
  'spinat': { price: 0.90, per: 1, unit: 'stück' }, 'feldsalat': { price: 1.49, per: 1, unit: 'stück' },
  'kopfsalat': { price: 0.99, per: 1, unit: 'stück' }, 'eisbergsalat': { price: 0.99, per: 1, unit: 'stück' }, 'rucola': { price: 1.29, per: 1, unit: 'stück' },
  'champignons': { price: 0.35, per: 100, unit: 'g' }, 'pilze': { price: 0.40, per: 100, unit: 'g' },
  'kürbis': { price: 0.30, per: 100, unit: 'g' },
  'radieschen': { price: 0.99, per: 1, unit: 'stück' }, 'rote beete': { price: 0.99, per: 1, unit: 'stück' },

  // Milch & Kühlung
  'milch': { price: 1.19, per: 1, unit: 'stück' }, 'hafermilch': { price: 1.79, per: 1, unit: 'stück' },
  'sahne': { price: 1.29, per: 1, unit: 'stück' },
  'eier': { price: 0.35, per: 1, unit: 'stück' }, 'ei': { price: 0.35, per: 1, unit: 'stück' },
  'butter': { price: 2.19, per: 1, unit: 'stück' },
  'käse': { price: 1.80, per: 100, unit: 'g' }, 'parmesan': { price: 2.20, per: 100, unit: 'g' },
  'mozzarella': { price: 0.99, per: 1, unit: 'stück' }, 'feta': { price: 1.79, per: 1, unit: 'stück' },
  'joghurt': { price: 0.89, per: 1, unit: 'stück' }, 'quark': { price: 0.99, per: 1, unit: 'stück' },
  'frischkäse': { price: 1.29, per: 1, unit: 'stück' },

  // Backwaren
  'brot': { price: 2.49, per: 1, unit: 'stück' }, 'toastbrot': { price: 1.69, per: 1, unit: 'stück' },
  'brötchen': { price: 0.40, per: 1, unit: 'stück' }, 'baguette': { price: 1.29, per: 1, unit: 'stück' },
  'croissant': { price: 0.79, per: 1, unit: 'stück' },

  // Getränke
  'wasser': { price: 0.65, per: 1, unit: 'stück' }, 'mineralwasser': { price: 0.65, per: 1, unit: 'stück' },
  'saft': { price: 1.99, per: 1, unit: 'stück' }, 'orangensaft': { price: 1.99, per: 1, unit: 'stück' }, 'apfelsaft': { price: 1.79, per: 1, unit: 'stück' },
  'cola': { price: 1.49, per: 1, unit: 'stück' }, 'limonade': { price: 1.29, per: 1, unit: 'stück' },
  'bier': { price: 0.85, per: 1, unit: 'stück' }, 'wein': { price: 4.99, per: 1, unit: 'stück' },
  'kaffee': { price: 5.99, per: 1, unit: 'stück' }, 'tee': { price: 2.49, per: 1, unit: 'stück' },

  // Fleisch & Fisch
  'hähnchenbrust': { price: 1.30, per: 100, unit: 'g' }, 'hähnchen': { price: 1.10, per: 100, unit: 'g' },
  'hackfleisch': { price: 1.00, per: 100, unit: 'g' },
  'rindersteak': { price: 3.50, per: 100, unit: 'g' }, 'schweinefilet': { price: 1.80, per: 100, unit: 'g' },
  'schinken': { price: 1.50, per: 100, unit: 'g' }, 'salami': { price: 1.60, per: 100, unit: 'g' }, 'speck': { price: 1.40, per: 100, unit: 'g' },
  'lachs': { price: 2.50, per: 100, unit: 'g' }, 'lachsfilet': { price: 2.50, per: 100, unit: 'g' },
  'thunfisch': { price: 1.20, per: 1, unit: 'stück' }, 'garnelen': { price: 2.20, per: 100, unit: 'g' },
  'bratwurst': { price: 0.70, per: 1, unit: 'stück' }, 'würstchen': { price: 0.50, per: 1, unit: 'stück' },

  // Lebensmittel / Grundzutaten
  'nudeln': { price: 1.19, per: 1, unit: 'stück' }, 'spaghetti': { price: 1.19, per: 1, unit: 'stück' },
  'reis': { price: 1.99, per: 1, unit: 'stück' }, 'couscous': { price: 1.79, per: 1, unit: 'stück' },
  'mehl': { price: 0.89, per: 1, unit: 'stück' }, 'zucker': { price: 0.99, per: 1, unit: 'stück' },
  'salz': { price: 0.45, per: 1, unit: 'stück' }, 'pfeffer': { price: 1.99, per: 1, unit: 'stück' },
  'olivenöl': { price: 4.99, per: 1, unit: 'stück' }, 'öl': { price: 2.49, per: 1, unit: 'stück' },
  'essig': { price: 1.29, per: 1, unit: 'stück' }, 'balsamico': { price: 2.49, per: 1, unit: 'stück' },
  'tomatenmark': { price: 0.69, per: 1, unit: 'stück' }, 'ketchup': { price: 1.49, per: 1, unit: 'stück' },
  'senf': { price: 0.99, per: 1, unit: 'stück' }, 'mayonnaise': { price: 1.69, per: 1, unit: 'stück' },
  'honig': { price: 3.49, per: 1, unit: 'stück' }, 'nutella': { price: 3.99, per: 1, unit: 'stück' },
  'schokolade': { price: 1.29, per: 1, unit: 'stück' },
  'kichererbsen': { price: 0.79, per: 1, unit: 'stück' }, 'kidneybohnen': { price: 0.99, per: 1, unit: 'stück' },
  'linsen': { price: 1.49, per: 1, unit: 'stück' }, 'kokosmilch': { price: 1.29, per: 1, unit: 'stück' },
  'tofu': { price: 1.99, per: 1, unit: 'stück' },

  // Tiefkühl
  'pizza': { price: 2.49, per: 1, unit: 'stück' }, 'tiefkühlpizza': { price: 2.49, per: 1, unit: 'stück' },
  'eis': { price: 3.49, per: 1, unit: 'stück' }, 'pommes': { price: 2.29, per: 1, unit: 'stück' },
  'tiefkühlgemüse': { price: 1.79, per: 1, unit: 'stück' },

  // Drogerie
  'toilettenpapier': { price: 5.99, per: 1, unit: 'stück' }, 'küchenrolle': { price: 3.49, per: 1, unit: 'stück' },
  'waschmittel': { price: 6.99, per: 1, unit: 'stück' }, 'spülmittel': { price: 1.99, per: 1, unit: 'stück' },
  'zahnpasta': { price: 2.49, per: 1, unit: 'stück' }, 'duschgel': { price: 2.29, per: 1, unit: 'stück' },
  'shampoo': { price: 2.99, per: 1, unit: 'stück' }, 'deo': { price: 2.49, per: 1, unit: 'stück' },
};

const UNIT_ALIASES: Record<string, PriceUnit> = {
  g: 'g', gramm: 'g', kg: 'g', kilo: 'g',
  ml: 'ml', l: 'ml', liter: 'ml',
  stück: 'stück', stk: 'stück', st: 'stück', dose: 'stück', päckchen: 'stück',
  bund: 'stück', zehe: 'stück', scheibe: 'stück', stange: 'stück', packung: 'stück',
};

// Parse "200 g" / "1,5 kg" / "2 Stück" into a normalized { num, unit } (g/ml/stück base units).
function parseQuantity(q: string): { num: number; unit: PriceUnit } | null {
  const m = q.trim().toLowerCase().match(/^([\d.,]+)\s*([a-zäöüß]*)/);
  if (!m) return null;
  let num = parseFloat(m[1].replace(',', '.'));
  if (isNaN(num)) return null;
  const rawUnit = m[2];
  if (rawUnit === 'kg') num *= 1000;
  if (rawUnit === 'l' || rawUnit === 'liter') num *= 1000;
  const unit = UNIT_ALIASES[rawUnit];
  if (!unit) return null;
  return { num, unit };
}

function findPriceEntry(name: string): PriceEntry | undefined {
  const n = name.toLowerCase().trim();
  if (n in AVG_PRICES) return AVG_PRICES[n];
  let bestKey: string | undefined;
  for (const key of Object.keys(AVG_PRICES)) {
    if (n.includes(key) && (!bestKey || key.length > bestKey.length)) bestKey = key;
  }
  return bestKey !== undefined ? AVG_PRICES[bestKey] : undefined;
}

// Estimate the cost of one shopping item. Returns null if we have no price for it.
export function estimateItemPrice(name: string, quantity?: string): number | null {
  const entry = findPriceEntry(name);
  if (!entry) return null;

  const parsed = quantity ? parseQuantity(quantity) : null;
  if (!parsed || parsed.unit !== entry.unit) {
    // No usable quantity, or a unit we can't relate to this item's price basis
    // (e.g. "2 EL Öl") — fall back to "one reference unit" as a rough guess.
    return entry.price;
  }
  return (parsed.num / entry.per) * entry.price;
}

export interface CartEstimate { total: number; pricedCount: number; totalCount: number }

export function estimateCartTotal(items: { name: string; quantity?: string }[]): CartEstimate {
  let total = 0;
  let pricedCount = 0;
  for (const item of items) {
    const price = estimateItemPrice(item.name, item.quantity);
    if (price !== null) { total += price; pricedCount++; }
  }
  return { total, pricedCount, totalCount: items.length };
}
