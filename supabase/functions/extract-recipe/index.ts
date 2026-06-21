import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;

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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { url, text } = await req.json();

    let recipeContent = text || '';

    if (url && !text) {
      try {
        // Be forgiving: users often paste a whole share text ("Schau dir … https://…").
        // Extract the first http(s) URL from whatever was pasted.
        const urlMatch = String(url).match(/https?:\/\/[^\s]+/);
        const cleanUrl = urlMatch ? urlMatch[0] : url;
        const res = await fetch(cleanUrl, {
          headers: {
            // Use a real desktop browser UA — some sites (e.g. Cookidoo) serve an empty
            // JS shell to bots like Googlebot but full HTML (incl. JSON-LD) to browsers.
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'de,en;q=0.5',
          }
        });
        const html = await res.text();

        // Try JSON-LD structured data first (Schema.org Recipe - used by Chefkoch etc.)
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
        messages: [{
          role: 'user',
          content: `Extrahiere die Zutaten aus diesem Rezept und gib sie als JSON zurück.

Rezept:
${recipeContent}

Regeln:
- Gib NUR valides JSON zurück, kein Text darum herum
- Filtere Standard-Basics heraus (Salz, Pfeffer, Wasser, Öl, Zucker, Mehl in kleinen Mengen, Backpulver, Hefe, Essig, Senf, Natron)
- Mappe jede Zutat auf eine dieser Kategorien: Lebensmittel, Obst & Gemüse, Tiefkühl, Fleisch & Fisch, Drogerie, Backwaren, Getränke, Sonstiges
- Quantity auf Deutsch

Format:
{
  "name": "Rezeptname",
  "ingredients": [
    {"name": "Zutat", "quantity": "200g", "category": "Lebensmittel", "isBasic": false}
  ]
}`
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
      parsed = match ? JSON.parse(match[0]) : { name: 'Rezept', ingredients: [] };
    }

    // Mark basics as include: false
    const ingredients = (parsed.ingredients || []).map((ing: any) => ({
      name: ing.name,
      quantity: ing.quantity,
      category: ing.category || 'Sonstiges',
      include: !ing.isBasic && !BASICS.some(b => ing.name.toLowerCase().includes(b)),
    }));

    return new Response(JSON.stringify({ name: parsed.name, ingredients }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
