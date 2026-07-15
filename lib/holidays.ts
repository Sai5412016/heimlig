// lib/holidays.ts — nationwide public holidays per country, computed offline.
// Only nationwide/federal holidays are included, never state/province/canton-specific ones —
// we don't know which subdivision a household is in, same reasoning that originally limited
// this to Germany-only. Country is a household setting (households.country, default 'DE').

export interface Holiday { date: string; name: string } // date: yyyy-MM-dd

const pad = (n: number) => String(n).padStart(2, '0');
const toDateStr = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

// Anonymous Gregorian algorithm (Meeus/Jones/Butcher) for the date of Easter Sunday.
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}

function dateStr(d: Date): string {
  return toDateStr(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

// weekday: 0 = Sunday .. 6 = Saturday. nth is 1-based (1st, 2nd, 3rd, 4th occurrence).
function nthWeekdayOfMonth(year: number, month: number, weekday: number, nth: number): Date {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const offset = (weekday - first.getUTCDay() + 7) % 7;
  return new Date(Date.UTC(year, month - 1, 1 + offset + (nth - 1) * 7));
}

function lastWeekdayOfMonth(year: number, month: number, weekday: number): Date {
  const lastDay = new Date(Date.UTC(year, month, 0)); // day 0 of next month = last day of this one
  const diff = (lastDay.getUTCDay() - weekday + 7) % 7;
  return addDays(lastDay, -diff);
}

type HolidayRule =
  | { type: 'fixed'; month: number; day: number; name: string }
  | { type: 'easter'; offset: number; name: string } // days relative to Easter Sunday
  | { type: 'nth'; month: number; weekday: number; nth: number; name: string }
  | { type: 'last'; month: number; weekday: number; name: string };

function resolveRules(rules: HolidayRule[], year: number, easter: Date): Holiday[] {
  return rules.map(r => {
    if (r.type === 'fixed') return { date: toDateStr(year, r.month, r.day), name: r.name };
    if (r.type === 'easter') return { date: dateStr(addDays(easter, r.offset)), name: r.name };
    if (r.type === 'nth') return { date: dateStr(nthWeekdayOfMonth(year, r.month, r.weekday, r.nth)), name: r.name };
    return { date: dateStr(lastWeekdayOfMonth(year, r.month, r.weekday)), name: r.name };
  });
}

// Curated set of common markets — same "good enough for the vast majority, documented gap for
// the rest" tradeoff as the currency/timezone pickers. Unsupported country codes fall back to
// Germany's holidays (the pre-existing default), not to an empty list.
const COUNTRY_RULES: Record<string, HolidayRule[]> = {
  DE: [
    { type: 'fixed', month: 1, day: 1, name: 'Neujahr' },
    { type: 'easter', offset: -2, name: 'Karfreitag' },
    { type: 'easter', offset: 1, name: 'Ostermontag' },
    { type: 'fixed', month: 5, day: 1, name: 'Tag der Arbeit' },
    { type: 'easter', offset: 39, name: 'Christi Himmelfahrt' },
    { type: 'easter', offset: 50, name: 'Pfingstmontag' },
    { type: 'fixed', month: 10, day: 3, name: 'Tag der Deutschen Einheit' },
    { type: 'fixed', month: 12, day: 25, name: '1. Weihnachtstag' },
    { type: 'fixed', month: 12, day: 26, name: '2. Weihnachtstag' },
  ],
  AT: [
    { type: 'fixed', month: 1, day: 1, name: 'Neujahr' },
    { type: 'fixed', month: 1, day: 6, name: 'Heilige Drei Könige' },
    { type: 'easter', offset: 1, name: 'Ostermontag' },
    { type: 'fixed', month: 5, day: 1, name: 'Staatsfeiertag' },
    { type: 'easter', offset: 39, name: 'Christi Himmelfahrt' },
    { type: 'easter', offset: 50, name: 'Pfingstmontag' },
    { type: 'easter', offset: 60, name: 'Fronleichnam' },
    { type: 'fixed', month: 8, day: 15, name: 'Mariä Himmelfahrt' },
    { type: 'fixed', month: 10, day: 26, name: 'Nationalfeiertag' },
    { type: 'fixed', month: 11, day: 1, name: 'Allerheiligen' },
    { type: 'fixed', month: 12, day: 8, name: 'Mariä Empfängnis' },
    { type: 'fixed', month: 12, day: 25, name: 'Christtag' },
    { type: 'fixed', month: 12, day: 26, name: 'Stefanitag' },
  ],
  CH: [
    { type: 'fixed', month: 1, day: 1, name: 'Neujahr' },
    { type: 'easter', offset: -2, name: 'Karfreitag' },
    { type: 'easter', offset: 1, name: 'Ostermontag' },
    { type: 'easter', offset: 39, name: 'Auffahrt' },
    { type: 'easter', offset: 50, name: 'Pfingstmontag' },
    { type: 'fixed', month: 8, day: 1, name: 'Nationalfeiertag' },
    { type: 'fixed', month: 12, day: 25, name: 'Weihnachten' },
    { type: 'fixed', month: 12, day: 26, name: 'Stephanstag' },
  ],
  US: [
    { type: 'fixed', month: 1, day: 1, name: "New Year's Day" },
    { type: 'last', month: 5, weekday: 1, name: 'Memorial Day' },
    { type: 'fixed', month: 6, day: 19, name: 'Juneteenth' },
    { type: 'fixed', month: 7, day: 4, name: 'Independence Day' },
    { type: 'nth', month: 9, weekday: 1, nth: 1, name: 'Labor Day' },
    { type: 'nth', month: 11, weekday: 4, nth: 4, name: 'Thanksgiving' },
    { type: 'fixed', month: 12, day: 25, name: 'Christmas Day' },
  ],
  GB: [
    { type: 'fixed', month: 1, day: 1, name: "New Year's Day" },
    { type: 'easter', offset: -2, name: 'Good Friday' },
    { type: 'easter', offset: 1, name: 'Easter Monday' },
    { type: 'nth', month: 5, weekday: 1, nth: 1, name: 'Early May Bank Holiday' },
    { type: 'last', month: 5, weekday: 1, name: 'Spring Bank Holiday' },
    { type: 'last', month: 8, weekday: 1, name: 'Summer Bank Holiday' },
    { type: 'fixed', month: 12, day: 25, name: 'Christmas Day' },
    { type: 'fixed', month: 12, day: 26, name: 'Boxing Day' },
  ],
  FR: [
    { type: 'fixed', month: 1, day: 1, name: "Jour de l'An" },
    { type: 'easter', offset: 1, name: 'Lundi de Pâques' },
    { type: 'fixed', month: 5, day: 1, name: 'Fête du Travail' },
    { type: 'fixed', month: 5, day: 8, name: 'Victoire 1945' },
    { type: 'easter', offset: 39, name: 'Ascension' },
    { type: 'easter', offset: 50, name: 'Lundi de Pentecôte' },
    { type: 'fixed', month: 7, day: 14, name: 'Fête nationale' },
    { type: 'fixed', month: 8, day: 15, name: 'Assomption' },
    { type: 'fixed', month: 11, day: 1, name: 'Toussaint' },
    { type: 'fixed', month: 11, day: 11, name: 'Armistice' },
    { type: 'fixed', month: 12, day: 25, name: 'Noël' },
  ],
  ES: [
    { type: 'fixed', month: 1, day: 1, name: 'Año Nuevo' },
    { type: 'fixed', month: 1, day: 6, name: 'Epifanía del Señor' },
    { type: 'easter', offset: -2, name: 'Viernes Santo' },
    { type: 'fixed', month: 5, day: 1, name: 'Fiesta del Trabajo' },
    { type: 'fixed', month: 8, day: 15, name: 'Asunción de la Virgen' },
    { type: 'fixed', month: 10, day: 12, name: 'Fiesta Nacional de España' },
    { type: 'fixed', month: 11, day: 1, name: 'Todos los Santos' },
    { type: 'fixed', month: 12, day: 6, name: 'Día de la Constitución' },
    { type: 'fixed', month: 12, day: 8, name: 'Inmaculada Concepción' },
    { type: 'fixed', month: 12, day: 25, name: 'Navidad' },
  ],
  IT: [
    { type: 'fixed', month: 1, day: 1, name: 'Capodanno' },
    { type: 'fixed', month: 1, day: 6, name: 'Epifania' },
    { type: 'easter', offset: 1, name: "Lunedì dell'Angelo" },
    { type: 'fixed', month: 4, day: 25, name: 'Festa della Liberazione' },
    { type: 'fixed', month: 5, day: 1, name: 'Festa del Lavoro' },
    { type: 'fixed', month: 6, day: 2, name: 'Festa della Repubblica' },
    { type: 'fixed', month: 8, day: 15, name: 'Ferragosto' },
    { type: 'fixed', month: 11, day: 1, name: 'Tutti i Santi' },
    { type: 'fixed', month: 12, day: 8, name: 'Immacolata Concezione' },
    { type: 'fixed', month: 12, day: 25, name: 'Natale' },
    { type: 'fixed', month: 12, day: 26, name: 'Santo Stefano' },
  ],
  NL: [
    { type: 'fixed', month: 1, day: 1, name: 'Nieuwjaarsdag' },
    { type: 'easter', offset: 1, name: 'Tweede Paasdag' },
    { type: 'fixed', month: 4, day: 27, name: 'Koningsdag' },
    { type: 'easter', offset: 39, name: 'Hemelvaartsdag' },
    { type: 'easter', offset: 50, name: 'Tweede Pinksterdag' },
    { type: 'fixed', month: 12, day: 25, name: 'Eerste Kerstdag' },
    { type: 'fixed', month: 12, day: 26, name: 'Tweede Kerstdag' },
  ],
  PL: [
    { type: 'fixed', month: 1, day: 1, name: 'Nowy Rok' },
    { type: 'fixed', month: 1, day: 6, name: 'Trzech Króli' },
    { type: 'easter', offset: 1, name: 'Poniedziałek Wielkanocny' },
    { type: 'fixed', month: 5, day: 1, name: 'Święto Pracy' },
    { type: 'fixed', month: 5, day: 3, name: 'Święto Konstytucji 3 Maja' },
    { type: 'easter', offset: 60, name: 'Boże Ciało' },
    { type: 'fixed', month: 8, day: 15, name: 'Wniebowzięcie NMP' },
    { type: 'fixed', month: 11, day: 1, name: 'Wszystkich Świętych' },
    { type: 'fixed', month: 11, day: 11, name: 'Święto Niepodległości' },
    { type: 'fixed', month: 12, day: 25, name: 'Boże Narodzenie' },
    { type: 'fixed', month: 12, day: 26, name: 'Drugi dzień Bożego Narodzenia' },
  ],
  PT: [
    { type: 'fixed', month: 1, day: 1, name: 'Ano Novo' },
    { type: 'easter', offset: -2, name: 'Sexta-feira Santa' },
    { type: 'fixed', month: 4, day: 25, name: 'Dia da Liberdade' },
    { type: 'fixed', month: 5, day: 1, name: 'Dia do Trabalhador' },
    { type: 'fixed', month: 6, day: 10, name: 'Dia de Portugal' },
    { type: 'fixed', month: 8, day: 15, name: 'Assunção de Nossa Senhora' },
    { type: 'fixed', month: 10, day: 5, name: 'Implantação da República' },
    { type: 'fixed', month: 11, day: 1, name: 'Todos os Santos' },
    { type: 'fixed', month: 12, day: 1, name: 'Restauração da Independência' },
    { type: 'fixed', month: 12, day: 8, name: 'Imaculada Conceição' },
    { type: 'fixed', month: 12, day: 25, name: 'Natal' },
  ],
  IE: [
    { type: 'fixed', month: 1, day: 1, name: "New Year's Day" },
    { type: 'fixed', month: 3, day: 17, name: "St. Patrick's Day" },
    { type: 'easter', offset: 1, name: 'Easter Monday' },
    { type: 'fixed', month: 12, day: 25, name: 'Christmas Day' },
    { type: 'fixed', month: 12, day: 26, name: "St. Stephen's Day" },
  ],
  CA: [
    { type: 'fixed', month: 1, day: 1, name: "New Year's Day" },
    { type: 'fixed', month: 7, day: 1, name: 'Canada Day' },
    { type: 'nth', month: 9, weekday: 1, nth: 1, name: 'Labour Day' },
    { type: 'fixed', month: 12, day: 25, name: 'Christmas Day' },
    { type: 'fixed', month: 12, day: 26, name: 'Boxing Day' },
  ],
  AU: [
    { type: 'fixed', month: 1, day: 1, name: "New Year's Day" },
    { type: 'fixed', month: 1, day: 26, name: 'Australia Day' },
    { type: 'easter', offset: -2, name: 'Good Friday' },
    { type: 'easter', offset: 1, name: 'Easter Monday' },
    { type: 'fixed', month: 4, day: 25, name: 'Anzac Day' },
    { type: 'fixed', month: 12, day: 25, name: 'Christmas Day' },
    { type: 'fixed', month: 12, day: 26, name: 'Boxing Day' },
  ],
  NZ: [
    { type: 'fixed', month: 1, day: 1, name: "New Year's Day" },
    { type: 'fixed', month: 2, day: 6, name: 'Waitangi Day' },
    { type: 'easter', offset: -2, name: 'Good Friday' },
    { type: 'easter', offset: 1, name: 'Easter Monday' },
    { type: 'fixed', month: 4, day: 25, name: 'Anzac Day' },
    { type: 'fixed', month: 12, day: 25, name: 'Christmas Day' },
    { type: 'fixed', month: 12, day: 26, name: 'Boxing Day' },
  ],
};

// For the household settings picker — code + flag emoji.
export const SUPPORTED_COUNTRIES: { code: string; flag: string }[] = [
  { code: 'DE', flag: '🇩🇪' },
  { code: 'AT', flag: '🇦🇹' },
  { code: 'CH', flag: '🇨🇭' },
  { code: 'US', flag: '🇺🇸' },
  { code: 'GB', flag: '🇬🇧' },
  { code: 'FR', flag: '🇫🇷' },
  { code: 'ES', flag: '🇪🇸' },
  { code: 'IT', flag: '🇮🇹' },
  { code: 'NL', flag: '🇳🇱' },
  { code: 'PL', flag: '🇵🇱' },
  { code: 'PT', flag: '🇵🇹' },
  { code: 'IE', flag: '🇮🇪' },
  { code: 'CA', flag: '🇨🇦' },
  { code: 'AU', flag: '🇦🇺' },
  { code: 'NZ', flag: '🇳🇿' },
];

const DEFAULT_COUNTRY = 'DE';

const cache = new Map<string, Holiday[]>();

export function getHolidays(year: number, country: string = DEFAULT_COUNTRY): Holiday[] {
  const rules = COUNTRY_RULES[country] || COUNTRY_RULES[DEFAULT_COUNTRY];
  const cacheKey = `${country}_${year}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const easter = easterSunday(year);
  const holidays = resolveRules(rules, year, easter);
  cache.set(cacheKey, holidays);
  return holidays;
}

const BY_DATE = new Map<string, string>();
function ensureYearIndexed(year: number, country: string) {
  const flag = `__indexed_${country}_${year}`;
  if (BY_DATE.has(flag)) return;
  getHolidays(year, country).forEach(h => BY_DATE.set(`${country}|${h.date}`, h.name));
  BY_DATE.set(flag, '1');
}

// Returns the holiday name for a given date (yyyy-MM-dd) in the given country, or undefined.
export function holidayName(dateKey: string, country: string = DEFAULT_COUNTRY): string | undefined {
  const year = Number(dateKey.slice(0, 4));
  if (!year) return undefined;
  ensureYearIndexed(year, country);
  return BY_DATE.get(`${country}|${dateKey}`);
}
