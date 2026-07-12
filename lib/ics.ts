// lib/ics.ts — minimal iCalendar (.ics) parser for importing events into Heimlig
import { nextYearlyOccurrence, formatDateKey } from './dateMath';

export interface IcsEvent {
  title: string;
  date: string;        // yyyy-MM-dd
  time?: string;       // HH:MM (local)
  description?: string;
  location?: string;
  recurrence?: 'daily' | 'weekly' | 'monthly' | 'yearly';
}

// Unfold folded lines (RFC 5545: continuation lines start with a space or tab)
function unfold(raw: string): string[] {
  const lines = raw.split(/\r?\n/);
  const out: string[] = [];
  for (const line of lines) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && out.length) {
      out[out.length - 1] += line.slice(1);
    } else {
      out.push(line);
    }
  }
  return out;
}

function unescape(v: string): string {
  return v.replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');
}

const pad = (n: number) => String(n).padStart(2, '0');

// Parse a DTSTART line into a local date (+ optional time)
function parseDateProp(line: string): { date: string; time?: string } | null {
  const idx = line.indexOf(':');
  if (idx < 0) return null;
  const val = line.slice(idx + 1).trim();

  const dateOnly = val.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (dateOnly) return { date: `${dateOnly[1]}-${dateOnly[2]}-${dateOnly[3]}` };

  const dt = val.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/);
  if (dt) {
    const [, y, mo, d, h, mi, s, z] = dt;
    if (z) {
      // UTC → device local time
      const date = new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s));
      return {
        date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
        time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
      };
    }
    return { date: `${y}-${mo}-${d}`, time: `${h}:${mi}` };
  }
  return null;
}

// For yearly events (birthdays), roll the date forward to the next upcoming occurrence
function nextOccurrence(date: string, freq?: string): string {
  if (freq !== 'yearly') return date;
  const [, m, d] = date.split('-').map(Number);
  return formatDateKey(nextYearlyOccurrence(m - 1, d));
}

export function parseICS(content: string): IcsEvent[] {
  const lines = unfold(content);
  const events: IcsEvent[] = [];
  let cur: any = null;

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { cur = {}; continue; }
    if (line === 'END:VEVENT') {
      if (cur && cur._date && cur.summary && !cur._skip) {
        events.push({
          title: cur.summary,
          date: nextOccurrence(cur._date.date, cur._freq),
          time: cur._date.time,
          description: cur.description,
          location: cur.location,
          recurrence: cur._freq,
        });
      }
      cur = null; continue;
    }
    if (!cur) continue; // ignore VTIMEZONE etc.

    if (line.startsWith('DTSTART')) cur._date = parseDateProp(line);
    else if (line.startsWith('SUMMARY')) cur.summary = unescape(line.slice(line.indexOf(':') + 1)).trim();
    else if (line.startsWith('DESCRIPTION')) cur.description = unescape(line.slice(line.indexOf(':') + 1)).trim();
    else if (line.startsWith('LOCATION')) cur.location = unescape(line.slice(line.indexOf(':') + 1)).trim();
    else if (line.startsWith('RECURRENCE-ID')) cur._skip = true; // skip single-instance overrides (avoids duplicates)
    else if (line.startsWith('RRULE')) {
      const f = line.match(/FREQ=(\w+)/i);
      const freq = f?.[1]?.toLowerCase();
      if (freq === 'yearly' || freq === 'monthly' || freq === 'weekly' || freq === 'daily') cur._freq = freq;
    }
  }
  return events;
}
