// supabase/functions/extract-receipt/index.ts
// Reads a purchase receipt photo (Kassenzettel) via Claude Vision and returns the fields
// needed to prefill a budget entry (amount/category/description/date) — same shape/auth/
// rate-limit pattern as extract-event/extract-recipe. The user still confirms/edits before
// anything is saved (see ReceiptScanModal), so this only has to get close, not be perfect.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

// Free households get this many AI actions per calendar month, counted across recipe import,
// receipt scan and event extraction TOGETHER — not this many each. Premium is unlimited.
// Keep in sync with FREE_MONTHLY_AI_ACTIONS in lib/premium.ts, which drives what the UI shows.
const FREE_MONTHLY_AI_ACTIONS = 5;
const AI_ACTION_TYPE = 'receipt_scan';


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

// Keep in sync with ALL_CATEGORIES in app/(tabs)/budget.tsx — the stored category value has
// to be one of these German keys for the app's category chips/breakdown to recognize it.
const CATEGORIES = [
  'Lebensmittel', 'Miete', 'Transport', 'Freizeit', 'Gesundheit', 'Kleidung',
  'Haushalt', 'Kinder', 'Haustiere', 'Sparen', 'Restaurant', 'Urlaub', 'Elektronik', 'Sport', 'Sonstiges',
];

function instruction(today: string): string {
  return `Extrahiere die Ausgaben-Informationen aus diesem Foto eines Kassenzettels/einer Quittung und gib sie als JSON zurück.

Heutiges Datum: ${today}

Regeln:
- Gib NUR valides JSON zurück, kein Text darum herum
- "amount": der bezahlte Gesamtbetrag (Summe/Total/Endbetrag) als Zahl mit Punkt als Dezimaltrennzeichen, z.B. 23.45. Falls kein Gesamtbetrag erkennbar ist, setze null.
- "description": Name des Geschäfts/Händlers, falls erkennbar, sonst null
- "date": Kaufdatum im Format YYYY-MM-DD, falls kein Jahr erkennbar ist nimm das aktuellste passende Datum nicht in der Zukunft. Falls gar kein Datum erkennbar ist, setze null.
- "category": ordne die Ausgabe genau EINER dieser Kategorien zu: ${CATEGORIES.join(', ')}. Ein Supermarkt-Kassenzettel ist praktisch immer "Lebensmittel". Wenn unklar, nimm "Sonstiges".

Format:
{"amount": 23.45 | null, "description": "..." | null, "date": "YYYY-MM-DD" | null, "category": "Lebensmittel"}`;
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

    const { data: allowed, error: rlError } = await authClient.rpc('rl_hit', { p_bucket: 'extract-receipt', p_limit: 30 });
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
      parsed = match ? JSON.parse(match[0]) : { amount: null, description: null, date: null, category: 'Sonstiges' };
    }

    const amount = typeof parsed.amount === 'number' && isFinite(parsed.amount) ? parsed.amount : null;
    const category = CATEGORIES.includes(parsed.category) ? parsed.category : 'Sonstiges';

    return new Response(JSON.stringify({
      amount,
      description: parsed.description || null,
      date: parsed.date || null,
      category,
    }), { headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('extract-receipt error:', e);
    return new Response(JSON.stringify({ error: 'Kassenzettel konnte nicht erkannt werden.' }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});
