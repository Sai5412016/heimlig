// supabase/functions/extract-event/index.ts
// Reads an event's details (title, date, time, location) out of a photo/screenshot of an
// invitation or flyer, via Claude Vision. Same shape/auth/rate-limit pattern as extract-recipe.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;
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

function instruction(today: string): string {
  return `Extrahiere die Termin-Informationen aus diesem Bild (Einladung, Flyer, Screenshot einer Nachricht) und gib sie als JSON zurück.

Heutiges Datum: ${today}

Regeln:
- Gib NUR valides JSON zurück, kein Text darum herum
- "date" im Format YYYY-MM-DD. Falls kein Jahr auf dem Bild steht, nimm das nächste passende Datum ab heute (nicht in der Vergangenheit)
- "time" im 24h-Format HH:MM, falls keine Uhrzeit erkennbar ist, lasse das Feld weg (null)
- "location": Ort/Adresse falls erkennbar, sonst null
- "description": eine kurze Notiz falls sinnvoll (z.B. Anlass, "Bitte Getränke mitbringen"), sonst null
- Wenn gar kein Datum erkennbar ist, setze "date" auf null

Format:
{"title": "...", "date": "YYYY-MM-DD" | null, "time": "HH:MM" | null, "location": "..." | null, "description": "..." | null}`;
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

    const { data: allowed, error: rlError } = await authClient.rpc('rl_hit', { p_bucket: 'extract-event', p_limit: 30 });
    if (!rlError && allowed === false) {
      return new Response(JSON.stringify({ error: 'Zu viele Anfragen, bitte später erneut versuchen.' }), { status: 429, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    const { imageBase64, imageMediaType } = await req.json();
    if (!imageBase64) {
      return new Response(JSON.stringify({ error: 'missing image' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    const today = new Date().toISOString().slice(0, 10);
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: imageMediaType || 'image/jpeg', data: imageBase64 } },
            { type: 'text', text: instruction(today) },
          ],
        }],
      }),
    });

    const data = await response.json();
    const content = data.content[0].text;

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      const match = content.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : { title: null, date: null, time: null, location: null, description: null };
    }

    return new Response(JSON.stringify({
      title: parsed.title || null,
      date: parsed.date || null,
      time: parsed.time || null,
      location: parsed.location || null,
      description: parsed.description || null,
    }), { headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('extract-event error:', e);
    return new Response(JSON.stringify({ error: 'Termin konnte nicht erkannt werden.' }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});
