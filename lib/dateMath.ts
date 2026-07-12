// lib/dateMath.ts — small shared date-math helpers used by the yearly-recurrence code in
// lib/ics.ts, lib/timetreeEvents.ts, and the birthday widgets (app/(tabs)/index.tsx,
// components/BirthdayListModal.tsx), so the leap-day fix only has to live in one place.

const pad = (n: number) => String(n).padStart(2, '0');

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
