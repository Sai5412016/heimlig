// supabase/functions/extract-event/index.ts
// Reads an event's details (title, date, time, location) out of a photo/screenshot of an
// invitation or flyer, via Claude Vision. Same shape/auth/rate-limit pattern as extract-recipe.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

// Free households get this many AI actions per calendar month, counted across recipe import,
// receipt scan and event extraction TOGETHER — not this many each. Premium is unlimited.
// Keep in sync with FREE_MONTHLY_AI_ACTIONS in lib/premium.ts, which drives what the UI shows.
const FREE_MONTHLY_AI_ACTIONS = 5;
const AI_ACTION_TYPE = 'event_extract';


const ALLOWED_ORIGINS = new Set([
  'https://heimlig.app',
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

    const { imageBase64, imageMediaType, householdId } = await req.json();
    if (!imageBase64) {
      return new Response(JSON.stringify({ error: 'missing image' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    // ── Missing householdId: fail OPEN, on purpose ────────────────────────────────
    // App builds from before this shipped don't send a householdId. Rejecting them would break
    // the feature outright for users on older builds; letting those calls run unmetered is the
    // cheaper mistake. Without a householdId the call proceeds, NEITHER counted NOR limit-checked.
    if (householdId) {
      // Confirm the caller actually belongs to the household whose quota is about to be spent.
      const { data: membership } = await authClient
        .from('members').select('id').eq('user_id', user.id).eq('household_id', householdId).maybeSingle();
      if (!membership) {
        return new Response(JSON.stringify({ error: 'not a member of this household' }), { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } });
      }

      // plan_tier ONLY — households.grandfathered deliberately does not lift this. That flag
      // existed for the old member limit, which no longer exists (see lib/premium.ts and
      // sql/member_cap.sql), so a grandfathered household gets the same free allowance as any other.
      const { data: household } = await authClient
        .from('households').select('plan_tier').eq('id', householdId).single();
      const unlimited = household?.plan_tier !== 'free';

      if (!unlimited) {
        // UTC month start — must match monthStartIso() in lib/aiUsage.ts, or the number the app
        // shows and the number enforced here would drift apart.
        const monthStart = new Date();
        monthStart.setUTCDate(1);
        monthStart.setUTCHours(0, 0, 0, 0);
        const { count } = await authClient
          .from('ai_usage_events')
          .select('id', { count: 'exact', head: true })
          .eq('household_id', householdId)
          .gte('created_at', monthStart.toISOString());

        const used = count ?? 0;
        if (used >= FREE_MONTHLY_AI_ACTIONS) {
          // `used` and `limit` go back so the app can say "5 of 5 used" instead of a bare refusal.
          return new Response(JSON.stringify({ error: 'ai_limit_reached', used, limit: FREE_MONTHLY_AI_ACTIONS }), {
            status: 403, headers: { ...cors, 'Content-Type': 'application/json' },
          });
        }
        await authClient.from('ai_usage_events').insert({ household_id: householdId, user_id: user.id, action_type: AI_ACTION_TYPE });
      }
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
