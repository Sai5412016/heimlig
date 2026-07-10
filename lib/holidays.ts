// lib/holidays.ts — nationwide (bundesweite) German public holidays, computed offline.
// State-specific holidays (Fronleichnam, Reformationstag, etc.) are deliberately left out —
// they only apply in some Bundesländer and we don't know which one a household is in.

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

const cache = new Map<number, Holiday[]>();

export function getGermanHolidays(year: number): Holiday[] {
  const cached = cache.get(year);
  if (cached) return cached;

  const easter = easterSunday(year);
  const holidays: Holiday[] = [
    { date: toDateStr(year, 1, 1), name: 'Neujahr' },
    { date: dateStr(addDays(easter, -2)), name: 'Karfreitag' },
    { date: dateStr(addDays(easter, 1)), name: 'Ostermontag' },
    { date: toDateStr(year, 5, 1), name: 'Tag der Arbeit' },
    { date: dateStr(addDays(easter, 39)), name: 'Christi Himmelfahrt' },
    { date: dateStr(addDays(easter, 50)), name: 'Pfingstmontag' },
    { date: toDateStr(year, 10, 3), name: 'Tag der Deutschen Einheit' },
    { date: toDateStr(year, 12, 25), name: '1. Weihnachtstag' },
    { date: toDateStr(year, 12, 26), name: '2. Weihnachtstag' },
  ];
  cache.set(year, holidays);
  return holidays;
}

const BY_DATE = new Map<string, string>();
function ensureYearIndexed(year: number) {
  if (BY_DATE.has(`__indexed_${year}`)) return;
  getGermanHolidays(year).forEach(h => BY_DATE.set(h.date, h.name));
  BY_DATE.set(`__indexed_${year}`, '1');
}

// Returns the holiday name for a given date (yyyy-MM-dd), or undefined.
export function holidayName(dateKey: string): string | undefined {
  const year = Number(dateKey.slice(0, 4));
  if (!year) return undefined;
  ensureYearIndexed(year);
  return BY_DATE.get(dateKey);
}
