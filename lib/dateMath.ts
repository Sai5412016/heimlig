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
