import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;

const BASICS = ['salz', 'pfeffer', 'wasser', 'öl', 'olivenöl', 'zucker', 'mehl', 'butter', 'backpulver', 'natron', 'hefe', 'essig', 'senf'];

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
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const html = await res.text();
        // Strip HTML tags
        recipeContent = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').substring(0, 8000);
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
