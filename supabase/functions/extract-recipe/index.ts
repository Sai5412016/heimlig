import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const BASICS = ['salz', 'pfeffer', 'wasser', 'öl', 'olivenöl', 'zucker', 'mehl', 'butter', 'backpulver', 'natron', 'hefe', 'essig', 'senf'];

// Decode common HTML entities (fractions, nbsp, etc.) so quantities arrive cleanly
function decodeEntities(s: string): string {
  if (!s) return s;
  const map: Record<string, string> = {
    '&frac12;': '½', '&frac14;': '¼', '&frac34;': '¾',
    '&frac13;': '⅓', '&frac23;': '⅔',
    '&nbsp;': ' ', '&amp;': '&', '&deg;': '°',
    '&Auml;': 'Ä', '&Ouml;': 'Ö', '&Uuml;': 'Ü',
    '&auml;': 'ä', '&ouml;': 'ö', '&uuml;': 'ü', '&szlig;': 'ß',
  };
  return s
    .replace(/&frac12;|&frac14;|&frac34;|&frac13;|&frac23;|&nbsp;|&amp;|&deg;|&Auml;|&Ouml;|&Uuml;|&auml;|&ouml;|&uuml;|&szlig;/g, m => map[m] || m)
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

// ─── CORS: allowlist, not a wildcard ───────────────────────────
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

// ─── SSRF guard for the "import by URL" path ───────────────────
// Blocks the common, cheap attack: pointing the fetcher at loopback/private/link-local
// addresses (incl. the cloud metadata IP) or literal internal hostnames. This is defense
// against the easy exploitation path (direct IP + redirect chains), not a full DNS-rebinding
// proof — that would need per-connection IP pinning, which isn't practical with plain fetch().
const BLOCKED_HOST_PATTERNS = [
  /^127\./, /^10\./, /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./, // link-local + cloud metadata (169.254.169.254)
  /^0\.0\.0\.0$/, /^0\./,
  /^::1$/, /^fc00:/i, /^fe80:/i, /^fd[0-9a-f]{2}:/i,
];
const BLOCKED_HOSTNAMES = new Set(['localhost', 'metadata', 'metadata.google.internal']);

function assertSafeUrl(rawUrl: string): URL {
  const u = new URL(rawUrl);
  if (!['http:', 'https:'].includes(u.protocol)) throw new Error('unsupported protocol');
  let host = u.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(host) || host.endsWith('.local')) throw new Error('blocked host');

  // IPv4-mapped IPv6 (e.g. "::ffff:127.0.0.1") embeds a real IPv4 address after the
  // "::ffff:" prefix — unwrap it so the IPv4 blocklist patterns below still catch it,
  // instead of only matching the plain-IPv6 patterns.
  const mapped = host.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (mapped) host = mapped[1];

  if (BLOCKED_HOST_PATTERNS.some(rx => rx.test(host))) throw new Error('blocked host');
  return u;
}

const MAX_BODY_BYTES = 2_000_000; // 2 MB cap regardless of what Content-Length claims

async function safeFetchText(rawUrl: string): Promise<string> {
  assertSafeUrl(rawUrl);
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 8000);
  try {
    const res = await fetch(rawUrl, {
      redirect: 'error', // don't silently follow a redirect into a blocked target
      signal: ac.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'de,en;q=0.5',
      },
    });
    if (!res.ok || !res.body) throw new Error(`upstream ${res.status}`);

    // Read with a hard byte cap so a malicious/huge response can't exhaust memory.
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BODY_BYTES) { reader.cancel(); throw new Error('response too large'); }
      chunks.push(value);
    }
    const buf = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) { buf.set(c, offset); offset += c.byteLength; }
    return new TextDecoder().decode(buf);
  } finally {
    clearTimeout(timer);
  }
}

const INSTRUCTION = `Extrahiere die Zutaten aus diesem Rezept und gib sie als JSON zurück.

Regeln:
- Gib NUR valides JSON zurück, kein Text darum herum
- Trenne bei jeder Zutat die Menge (Zahl + Einheit, z.B. "200 g", "2 Stück", "1 EL") in das Feld quantity und den reinen Zutatennamen in name. Wenn keine Menge angegeben ist, lasse quantity leer.
- Behalte ALLE Zutaten, auch Basics wie Salz und Pfeffer, aber setze bei diesen isBasic auf true
- Mappe jede Zutat auf eine dieser Kategorien: Lebensmittel, Obst & Gemüse, Tiefkühl, Fleisch & Fisch, Drogerie, Backwaren, Getränke, Sonstiges
- quantity auf Deutsch

Format:
{
  "name": "Rezeptname",
  "ingredients": [
    {"name": "Zutat", "quantity": "200 g", "category": "Lebensmittel", "isBasic": false}
  ]
}`;

serve(async (req) => {
  const cors = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    // ── Auth: verify_jwt should already gate this at the platform level (keep it on when
    // deploying — see CONTEXT.md), but check explicitly here too as defense in depth. ──
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } });

    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authError } = await authClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    // ── Rate limit: max 30 calls/hour per user, atomic increment via rl_hit() RPC ──
    const { data: allowed, error: rlError } = await authClient.rpc('rl_hit', { p_bucket: 'extract-recipe', p_limit: 30 });
    if (!rlError && allowed === false) {
      return new Response(JSON.stringify({ error: 'Zu viele Anfragen, bitte später erneut versuchen.' }), { status: 429, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    const { url, text, imageBase64, imageMediaType } = await req.json();

    let recipeContent = text || '';

    if (url && !text && !imageBase64) {
      try {
        // Be forgiving: users often paste a whole share text ("Schau dir … https://…").
        // Extract the first http(s) URL from whatever was pasted.
        const urlMatch = String(url).match(/https?:\/\/[^\s]+/);
        const cleanUrl = urlMatch ? urlMatch[0] : url;
        const html = await safeFetchText(cleanUrl);

        // Try JSON-LD structured data first (Schema.org Recipe - used by Chefkoch, Cookidoo etc.)
        const jsonLdMatches = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
        let jsonLdContent = '';
        for (const match of jsonLdMatches) {
          try {
            const parsed = JSON.parse(match[1]);
            const items = Array.isArray(parsed) ? parsed : [parsed];
            for (const item of items) {
              const recipe = item['@type'] === 'Recipe' ? item :
                (item['@graph'] || []).find((g: any) => g['@type'] === 'Recipe');
              if (recipe) {
                const ingredients = (recipe.recipeIngredient || []).map(decodeEntities).join('\n');
                jsonLdContent = `Rezeptname: ${decodeEntities(recipe.name || 'Rezept')}\nZutaten:\n${ingredients}`;
                break;
              }
            }
          } catch { /* continue */ }
          if (jsonLdContent) break;
        }

        recipeContent = jsonLdContent || html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').substring(0, 8000);
      } catch {
        recipeContent = `Rezept von: ${url}`;
      }
    }

    // Build the user message: an image (screenshot/photo) or plain recipe text
    const userContent = imageBase64
      ? [
          { type: 'image', source: { type: 'base64', media_type: imageMediaType || 'image/jpeg', data: imageBase64 } },
          { type: 'text', text: `Dies ist ein Screenshot oder Foto eines Rezepts. Lies den Text und ${INSTRUCTION[0].toLowerCase()}${INSTRUCTION.slice(1)}` },
        ]
      : `${INSTRUCTION}\n\nRezept:\n${recipeContent}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{ role: 'user', content: userContent }],
      }),
    });

    const data = await response.json();
    const content = data.content[0].text;

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      const match = content.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : { name: 'Rezept', ingredients: [] };
    }

    // Mark basics as include: false (the app pre-selects all anyway, but keep the hint)
    const ingredients = (parsed.ingredients || []).map((ing: any) => ({
      name: ing.name,
      quantity: ing.quantity,
      category: ing.category || 'Sonstiges',
      include: !ing.isBasic && !BASICS.some(b => ing.name.toLowerCase().includes(b)),
    }));

    return new Response(JSON.stringify({ name: parsed.name, ingredients }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('extract-recipe error:', e);
    return new Response(JSON.stringify({ error: 'Rezept konnte nicht verarbeitet werden.' }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});
