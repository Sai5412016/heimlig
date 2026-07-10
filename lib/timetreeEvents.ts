// lib/timetreeEvents.ts — maps raw TimeTree event JSON (fetched inside the login WebView,
// using the user's own browser session) into the same shape lib/ics.ts already produces,
// so both importers share the same dedup/insert code in app/(tabs)/tasks.tsx.
import type { IcsEvent } from './ics';

export interface RawTimeTreeEvent {
  title?: string;
  start_at?: number; // unix ms
  all_day?: boolean;
  recurrences?: string[]; // raw RFC5545 strings, e.g. "RRULE:FREQ=YEARLY"
  location?: string;
  note?: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

function tsToDateTime(ms: number, allDay: boolean): { date: string; time?: string } {
  const d = new Date(ms);
  const date = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  if (allDay) return { date };
  return { date, time: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}` };
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
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  let cand = new Date(Date.UTC(today.getUTCFullYear(), m - 1, d));
  if (cand < today) cand = new Date(Date.UTC(today.getUTCFullYear() + 1, m - 1, d));
  return `${cand.getUTCFullYear()}-${pad(cand.getUTCMonth() + 1)}-${pad(cand.getUTCDate())}`;
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
