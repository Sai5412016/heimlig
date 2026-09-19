// lib/dateMath.ts — small shared date-math helpers used by the yearly-recurrence code in
// lib/ics.ts, lib/timetreeEvents.ts, and the birthday widgets (app/(tabs)/index.tsx,
// components/BirthdayListModal.tsx), so the leap-day fix only has to live in one place.
import { addDays, addWeeks, addMonths, addYears, parseISO, format as formatFns } from 'date-fns';

const pad = (n: number) => String(n).padStart(2, '0');

export type RecurrenceUnit = 'daily' | 'weekly' | 'monthly' | 'yearly';

// Advance a fixed `anchor` date (yyyy-MM-dd) forward by `steps * 1 unit`, always computed
// fresh from that same anchor — never chained from a previously-advanced date. Chaining is
// what causes monthly/yearly recurrence to drift permanently once a short month clamps it
// (addMonths(Jan 31, 1) = Feb 28; chaining from Feb 28 can never get back to 31), because
// re-deriving from the fixed Jan 31 anchor for every step avoids ever losing the original day.
export function advanceFromAnchor(anchor: string, unit: RecurrenceUnit, steps: number): string {
  const base = parseISO(anchor);
  const next = unit === 'daily' ? addDays(base, steps)
    : unit === 'weekly' ? addWeeks(base, steps)
    : unit === 'yearly' ? addYears(base, steps)
    : addMonths(base, steps);
  return formatFns(next, 'yyyy-MM-dd');
}

// Best-effort count of how many `unit` steps separate two dates — used to seed a step
// counter from an already-existing (possibly slightly drifted) "next occurrence" value
// without replaying the whole history from the anchor.
export function stepsBetween(anchor: string, target: string, unit: RecurrenceUnit): number {
  const a = parseISO(anchor), t = parseISO(target);
  const msPerDay = 86400000;
  if (unit === 'daily') return Math.round((t.getTime() - a.getTime()) / msPerDay);
  if (unit === 'weekly') return Math.round((t.getTime() - a.getTime()) / (msPerDay * 7));
  if (unit === 'yearly') return (t.getFullYear() - a.getFullYear());
  return (t.getFullYear() - a.getFullYear()) * 12 + (t.getMonth() - a.getMonth());
}

// Advance `base` by `months` calendar months while preserving `anchorDay` (the day-of-month
// the recurring series was originally created on), clamped to whatever the target month's
// real length is. Unlike addMonths(base, months), this never compounds a clamp: advancing
// from a February 28th occurrence with anchorDay=31 correctly lands back on the 31st the
// next time a 31-day month comes around, instead of staying stuck at 28 forever.
export function advanceMonthlyPreservingDay(base: Date, months: number, anchorDay: number): Date {
  const monthStart = new Date(base.getFullYear(), base.getMonth(), 1);
  const target = new Date(monthStart.getFullYear(), monthStart.getMonth() + months, 1);
  const daysInTargetMonth = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(anchorDay, daysInTargetMonth));
  return target;
}

// Same idea as advanceMonthlyPreservingDay but for yearly recurrence (the Feb-29 case):
// clamps to anchorDay instead of letting `new Date(year, month, 29)` silently overflow into
// March in a non-leap year.
export function advanceYearlyPreservingDay(base: Date, years: number, anchorDay: number): Date {
  const targetYear = base.getFullYear() + years;
  const daysInTargetMonth = new Date(targetYear, base.getMonth() + 1, 0).getDate();
  return new Date(targetYear, base.getMonth(), Math.min(anchorDay, daysInTargetMonth));
}

// Next occurrence (today or later) of a given month/day, in local time. Feb 29 birthdays/
// anniversaries are shown on Feb 28 in non-leap years instead of silently overflowing into
// March 1st (the default behavior of `new Date(year, 1, 29)`), matching the convention most
// calendar apps use.
export function nextYearlyOccurrence(monthIndex: number, day: number, from: Date = new Date()): Date {
  const today = new Date(from); today.setHours(0, 0, 0, 0);
  const clampedDay = (m: number, y: number) => Math.min(day, new Date(y, m + 1, 0).getDate());
  let year = today.getFullYear();
  let cand = new Date(year, monthIndex, clampedDay(monthIndex, year));
  if (cand < today) {
    year += 1;
    cand = new Date(year, monthIndex, clampedDay(monthIndex, year));
  }
  return cand;
}

export function formatDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Whole calendar days between two local dates, using each date's Y/M/D components projected
// onto Date.UTC() as a neutral, DST-free millisecond axis — NOT a reinterpretation of either
// date as UTC (that's the new Date('yyyy-MM-dd') bug this whole file exists to avoid). Plain
// `(a.getTime() - b.getTime()) / 86400000` can be off by one around a DST transition, because a
// local calendar day isn't always exactly 24h; this can't be, since Date.UTC never has DST.
function toNeutralDayNumber(d: Date): number {
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000;
}
export function calendarDaysBetween(from: Date, to: Date): number {
  return toNeutralDayNumber(to) - toNeutralDayNumber(from);
}

export interface YearlyOccurrence<T> { item: T; days: number; date: Date }

// Maps each item to its next yearly month/day occurrence (the item's own stored year, if any,
// never matters — see nextYearlyOccurrence), counted in whole calendar days from `from` (0 =
// today), ascending. Ties keep their relative input order. Shared by the birthday banner
// (app/(tabs)/index.tsx) and the full birthday list (components/BirthdayListModal.tsx) so the
// leap-day/DST/"next vs. first" handling only has to be right in one place.
export function sortedYearlyOccurrences<T>(
  items: T[],
  getDueDate: (item: T) => string | null | undefined,
  from: Date = new Date(),
): YearlyOccurrence<T>[] {
  const today = new Date(from); today.setHours(0, 0, 0, 0);
  return items
    .map(item => {
      const raw = getDueDate(item);
      if (!raw) return null;
      const d = parseISO(raw);
      const next = nextYearlyOccurrence(d.getMonth(), d.getDate(), today);
      return { item, days: calendarDaysBetween(today, next), date: next };
    })
    .filter((x): x is YearlyOccurrence<T> => x !== null)
    .sort((a, b) => a.days - b.days);
}
