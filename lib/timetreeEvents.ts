// lib/timetreeEvents.ts — maps raw TimeTree event JSON (fetched inside the login WebView,
// using the user's own browser session) into the same shape lib/ics.ts already produces,
// so both importers share the same dedup/insert code in app/(tabs)/tasks.tsx.
import type { IcsEvent } from './ics';
import { nextYearlyOccurrence, formatDateKey } from './dateMath';

export interface RawTimeTreeEvent {
  title?: string;
  start_at?: number; // unix ms
  all_day?: boolean;
  recurrences?: string[]; // raw RFC5545 strings, e.g. "RRULE:FREQ=YEARLY"
  location?: string;
  note?: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

// start_at is a unix-ms instant; read it in the device's local time (matching lib/ics.ts'
// UTC->local conversion for timed events), not UTC — otherwise every timed event lands
// 1-2 hours off for German users, and events near midnight can land on the wrong day.
function tsToDateTime(ms: number, allDay: boolean): { date: string; time?: string } {
  const d = new Date(ms);
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  if (allDay) return { date };
  return { date, time: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
}

function recurrenceFreq(recurrences?: string[]): IcsEvent['recurrence'] {
  if (!recurrences?.length) return undefined;
  const m = recurrences[0].match(/FREQ=(\w+)/i);
  const freq = m?.[1]?.toLowerCase();
  if (freq === 'daily' || freq === 'weekly' || freq === 'monthly' || freq === 'yearly') return freq;
  return undefined;
}

// Mirrors lib/ics.ts: a yearly event's stored date is its next upcoming occurrence, not
// whenever it was first created in TimeTree (which could be years ago).
function nextOccurrence(dateStr: string, freq?: string): string {
  if (freq !== 'yearly') return dateStr;
  const [, m, d] = dateStr.split('-').map(Number);
  return formatDateKey(nextYearlyOccurrence(m - 1, d));
}

export function mapTimeTreeEvents(raw: RawTimeTreeEvent[]): IcsEvent[] {
  return raw
    .filter(e => e.title && e.start_at)
    .map(e => {
      const { date, time } = tsToDateTime(e.start_at!, !!e.all_day);
      const recurrence = recurrenceFreq(e.recurrences);
      return {
        title: e.title!.trim(),
        date: nextOccurrence(date, recurrence),
        time,
        location: e.location || undefined,
        description: e.note || undefined,
        recurrence,
      };
    });
}
