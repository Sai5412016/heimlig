// lib/productScore.ts — barcode product lookup (Open Food Facts) + Yuka-style health score.
//
// We fetch product data from the free Open Food Facts database and derive a 0–100 health
// score in the spirit of Yuka: ~60% nutritional quality (Nutri-Score), ~30% additives,
// ~10% organic bonus. The score comes with a rating label and a positive/negative breakdown
// so the user understands *why* a product scores the way it does.
//
// Note: the exact Yuka algorithm is proprietary; this is an independent approximation built
// on open data. It is informational, not medical advice.

const OFF_ENDPOINT = 'https://world.openfoodfacts.org/api/v2/product';
const OFF_FIELDS = [
  'code', 'product_name', 'product_name_de', 'brands',
  'image_front_small_url', 'image_url',
  'nutriscore_grade', 'nova_group', 'additives_tags', 'additives_n',
  'nutrient_levels', 'nutriments', 'labels_tags',
  'ingredients_text_de', 'ingredients_text',
].join(',');

export interface ProductInfo {
  barcode: string;
  name: string;
  brand?: string;
  imageUrl?: string;
  nutriScore?: string;      // 'a'..'e'
  novaGroup?: number;       // 1..4
  additives: string[];      // display E-numbers, e.g. ['E330', 'E951']
  organic: boolean;
  ingredients?: string;
}

export interface HealthRating {
  score: number;            // 0..100
  label: string;            // 'Schlecht' | 'Mittelmäßig' | 'Gut' | 'Ausgezeichnet'
  color: string;            // hex for the gauge
  positives: string[];
  negatives: string[];
  limited: boolean;         // true when data was too sparse for a confident score
}

export interface ScanResult {
  found: boolean;
  info?: ProductInfo;
  rating?: HealthRating;
}

// A persisted scan, as stored in the household's scan_history table.
export interface ScanHistoryEntry {
  id: string;
  barcode: string;
  name: string;
  brand?: string | null;
  score?: number | null;
  rating_label?: string | null;
  nutri_score?: string | null;
  nova_group?: number | null;
  image_url?: string | null;
  created_at: string;
}

// Additive risk classification (curated subset of the most discussed E-numbers).
// Lowercased E-number keys without the 'e' prefix-tag formatting.
const HIGH_RISK = new Set([
  'e102', 'e104', 'e110', 'e122', 'e124', 'e129',   // azo / synthetic colours
  'e131', 'e132', 'e133', 'e142', 'e151',           // synthetic colours
  'e171',                                            // titanium dioxide (banned EU)
  'e249', 'e250', 'e251', 'e252',                   // nitrites / nitrates
  'e320', 'e321',                                    // BHA / BHT
  'e951', 'e950', 'e952', 'e954',                   // controversial sweeteners
]);
const MODERATE_RISK = new Set([
  'e150c', 'e150d',                                  // caramel colours (ammonia)
  'e220', 'e221', 'e222', 'e223', 'e224',           // sulphites
  'e338', 'e339', 'e340', 'e341', 'e450', 'e451', 'e452', // phosphates
  'e621',                                            // MSG
  'e407',                                            // carrageenan
  'e211', 'e212',                                    // benzoates
]);

function additiveRisk(eNum: string): 'high' | 'moderate' | 'low' {
  const k = eNum.toLowerCase();
  if (HIGH_RISK.has(k)) return 'high';
  if (MODERATE_RISK.has(k)) return 'moderate';
  return 'low';
}

// 'en:e330' -> 'E330'
function tagToENumber(tag: string): string {
  const raw = tag.replace(/^en:/, '').toUpperCase();
  return raw;
}

const NUTRI_POINTS: Record<string, number> = { a: 60, b: 48, c: 33, d: 18, e: 6 };

export function scoreProduct(p: any): HealthRating {
  const positives: string[] = [];
  const negatives: string[] = [];

  const grade = typeof p?.nutriscore_grade === 'string' ? p.nutriscore_grade.toLowerCase() : undefined;
  const hasNutri = grade != null && NUTRI_POINTS[grade] != null;

  // ── Nutrition (0–60), from Nutri-Score grade ──
  const nutrition = hasNutri ? NUTRI_POINTS[grade] : 30; // neutral if unknown

  // ── Additives (0–30) ──
  const additiveTags: string[] = Array.isArray(p?.additives_tags) ? p.additives_tags : [];
  let additivePts = 30;
  let highCount = 0;
  for (const tag of additiveTags) {
    const e = tagToENumber(tag).toLowerCase();
    const risk = additiveRisk(e);
    if (risk === 'high') { additivePts -= 10; highCount++; }
    else if (risk === 'moderate') additivePts -= 5;
    else additivePts -= 2;
  }
  additivePts = Math.max(0, additivePts);

  // ── Organic bonus (0–10) ──
  const labels: string[] = Array.isArray(p?.labels_tags) ? p.labels_tags : [];
  const organic = labels.some(l => l.includes('organic') || l.includes('bio'));
  const organicPts = organic ? 10 : 0;

  let score = Math.round(nutrition + additivePts + organicPts);
  score = Math.max(0, Math.min(100, score));

  // ── Breakdown via nutrient levels (low/moderate/high) ──
  const lv = p?.nutrient_levels || {};
  const n = p?.nutriments || {};
  if (lv.sugars === 'high') negatives.push('Zu viel Zucker');
  else if (lv.sugars === 'low') positives.push('Wenig Zucker');
  if (lv.salt === 'high') negatives.push('Zu viel Salz');
  else if (lv.salt === 'low') positives.push('Wenig Salz');
  if (lv['saturated-fat'] === 'high') negatives.push('Viele gesättigte Fettsäuren');
  else if (lv['saturated-fat'] === 'low') positives.push('Wenig gesättigte Fettsäuren');

  const fiber = Number(n.fiber_100g);
  if (!isNaN(fiber) && fiber >= 3) positives.push('Ballaststoffreich');
  const protein = Number(n.proteins_100g);
  if (!isNaN(protein) && protein >= 8) positives.push('Proteinreich');

  const nova = Number(p?.nova_group);
  if (nova === 4) negatives.push('Hochverarbeitetes Produkt');
  else if (nova === 1) positives.push('Unverarbeitet');

  if (additiveTags.length === 0) positives.push('Keine Zusatzstoffe');
  else if (highCount > 0) negatives.push(`Enthält ${highCount} bedenkliche${highCount === 1 ? 'n' : ''} Zusatzstoff${highCount === 1 ? '' : 'e'}`);

  if (organic) positives.push('Bio-zertifiziert');

  // ── Label + colour band ──
  let label: string, color: string;
  if (score >= 75) { label = 'Ausgezeichnet'; color = '#2D9E57'; }
  else if (score >= 50) { label = 'Gut'; color = '#8BC34A'; }
  else if (score >= 25) { label = 'Mittelmäßig'; color = '#F5A623'; }
  else { label = 'Schlecht'; color = '#E5573F'; }

  const limited = !hasNutri && additiveTags.length === 0 && Object.keys(lv).length === 0;

  return { score, label, color, positives, negatives, limited };
}

function parseInfo(p: any, barcode: string): ProductInfo {
  const additives: string[] = Array.isArray(p?.additives_tags)
    ? p.additives_tags.map(tagToENumber)
    : [];
  const labels: string[] = Array.isArray(p?.labels_tags) ? p.labels_tags : [];
  const name = (p?.product_name_de || p?.product_name || '').trim() || 'Unbekanntes Produkt';
  const brand = (typeof p?.brands === 'string' ? p.brands.split(',')[0].trim() : '') || undefined;
  return {
    barcode,
    name,
    brand,
    imageUrl: p?.image_front_small_url || p?.image_url || undefined,
    nutriScore: typeof p?.nutriscore_grade === 'string' && /^[a-e]$/i.test(p.nutriscore_grade)
      ? p.nutriscore_grade.toLowerCase() : undefined,
    novaGroup: p?.nova_group != null ? Number(p.nova_group) : undefined,
    additives,
    organic: labels.some(l => l.includes('organic') || l.includes('bio')),
    ingredients: (p?.ingredients_text_de || p?.ingredients_text || '').trim() || undefined,
  };
}

// Look up a barcode in Open Food Facts and compute its health rating.
export async function fetchAndScore(barcode: string): Promise<ScanResult> {
  const code = barcode.trim();
  if (!code) return { found: false };
  try {
    const res = await fetch(`${OFF_ENDPOINT}/${encodeURIComponent(code)}.json?fields=${OFF_FIELDS}`, {
      headers: { 'User-Agent': 'Heimlig/1.0 (Gut Feeling Labs; haushalts-app)' },
    });
    if (!res.ok) return { found: false };
    const json = await res.json();
    if (json?.status !== 1 || !json?.product) return { found: false };
    const info = parseInfo(json.product, code);
    const rating = scoreProduct(json.product);
    return { found: true, info, rating };
  } catch {
    return { found: false };
  }
}
