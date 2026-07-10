// supabase/functions/timetree-import/index.ts
// Gated (households.timetree_import_enabled) TimeTree calendar import. TimeTree has no
// official export/sync API, so this talks to their unofficial, reverse-engineered web API
// (same approach as the open-source `timetree-exporter` CLI) using the user's own TimeTree
// credentials. The password is used once to obtain a session cookie and is never stored,
// logged, or returned.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const ALLOWED_ORIGINS = new Set([
  'https://heimlig.vercel.app',
  'http://localhost:8081',
  'http://localhost:19006',
]);
function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') || '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.has(origin) ? origin : 'https://heimlig.vercel.app',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  };
}

const TT_BASE = 'https://timetreeapp.com/api/v1';
const TT_UA = 'web/2.1.0/en';

interface TimeTreeEvent {
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

function recurrenceFreq(recurrences?: string[]): 'daily' | 'weekly' | 'monthly' | 'yearly' | undefined {
  if (!recurrences?.length) return undefined;
  const m = recurrences[0].match(/FREQ=(\w+)/i);
  const freq = m?.[1]?.toLowerCase();
  if (freq === 'daily' || freq === 'weekly' || freq === 'monthly' || freq === 'yearly') return freq as any;
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

serve(async (req) => {
  const cors = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } });

    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authError } = await authClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    const { household_id, email, password } = await req.json();
    if (!household_id || !email || !password) {
      return new Response(JSON.stringify({ error: 'missing fields' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    const { data: isMember } = await authClient.rpc('is_household_member', { hid: household_id });
    if (!isMember) {
      return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    const { data: hh } = await authClient.from('households').select('timetree_import_enabled').eq('id', household_id).single();
    if (!hh?.timetree_import_enabled) {
      return new Response(JSON.stringify({ error: 'TimeTree-Import ist für diesen Haushalt nicht freigeschaltet.' }), { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    // 1. Sign in to TimeTree's unofficial web API to obtain a session cookie.
    const uuid = crypto.randomUUID().replace(/-/g, '');
    const loginRes = await fetch(`${TT_BASE}/auth/email/signin`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Timetreea': TT_UA },
      body: JSON.stringify({ uid: email, password, uuid }),
    });

    if (!loginRes.ok) {
      let message = 'TimeTree-Login fehlgeschlagen.';
      try {
        const body = await loginRes.json();
        const code = body?.error?.code ?? body?.code;
        if (code === -702) message = 'Falsche E-Mail-Adresse oder falsches Passwort.';
        else if (code === -495) message = 'Zu viele Versuche bei TimeTree — bitte später erneut versuchen.';
      } catch { /* non-JSON error body, keep generic message */ }
      return new Response(JSON.stringify({ error: message }), { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    const setCookie = loginRes.headers.get('set-cookie') || '';
    const sessionMatch = setCookie.match(/_session_id=([^;]+)/);
    if (!sessionMatch) {
      return new Response(JSON.stringify({ error: 'TimeTree-Login fehlgeschlagen (keine Session erhalten).' }), { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } });
    }
    const ttHeaders = { 'Content-Type': 'application/json', 'X-Timetreea': TT_UA, 'Cookie': `_session_id=${sessionMatch[1]}` };

    // 2. List calendars, skip deactivated ones.
    const calRes = await fetch(`${TT_BASE}/calendars?since=0`, { headers: ttHeaders });
    if (!calRes.ok) {
      return new Response(JSON.stringify({ error: 'TimeTree-Kalenderliste konnte nicht geladen werden.' }), { status: 502, headers: { ...cors, 'Content-Type': 'application/json' } });
    }
    const calBody = await calRes.json();
    const calendars = (calBody?.calendars || []).filter((c: any) => c.deactivated_at == null);

    // 3. Fetch events per calendar. The sync endpoint paginates via a chunk flag + since cursor.
    const rawEvents: TimeTreeEvent[] = [];
    for (const cal of calendars) {
      let since = 0;
      for (let page = 0; page < 50; page++) {
        const evRes = await fetch(`${TT_BASE}/calendar/${cal.id}/events/sync?since=${since}`, { headers: ttHeaders });
        if (!evRes.ok) break;
        const evBody = await evRes.json();
        rawEvents.push(...(evBody?.events || []));
        if (!evBody?.chunk) break;
        since = evBody?.since ?? since;
      }
    }

    // 4. Map to the same shape the .ics importer already produces client-side.
    const events = rawEvents
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

    return new Response(JSON.stringify({ events }), { headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});
