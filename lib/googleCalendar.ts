// lib/googleCalendar.ts — minimal Google Calendar API helpers (given an OAuth access token).
const API = 'https://www.googleapis.com/calendar/v3';

export interface GCalEvent {
  id: string;
  summary?: string;
  description?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
}

// Upcoming events from the user's primary calendar (next `days` days).
export async function listUpcomingEvents(token: string, days = 30): Promise<GCalEvent[]> {
  const timeMin = new Date().toISOString();
  const timeMax = new Date(Date.now() + days * 86400000).toISOString();
  const url = `${API}/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime&maxResults=250`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`calendar list failed (${res.status})`);
  const json = await res.json();
  return (json.items || []) as GCalEvent[];
}

// Create an event on the primary calendar. All-day when no time, otherwise a 1h slot.
export async function createEvent(
  token: string,
  ev: { summary: string; description?: string; date: string; time?: string | null },
): Promise<GCalEvent> {
  const body: any = { summary: ev.summary, description: ev.description || undefined };
  if (ev.time) {
    const start = new Date(`${ev.date}T${ev.time}:00`);
    const end = new Date(start.getTime() + 60 * 60000);
    body.start = { dateTime: start.toISOString() };
    body.end = { dateTime: end.toISOString() };
  } else {
    const next = new Date(`${ev.date}T00:00:00`);
    next.setDate(next.getDate() + 1);
    body.start = { date: ev.date };
    body.end = { date: next.toISOString().slice(0, 10) };
  }
  const res = await fetch(`${API}/calendars/primary/events`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`create event failed (${res.status})`);
  return (await res.json()) as GCalEvent;
}
