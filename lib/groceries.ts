// lib/groceries.ts — curated German grocery catalog for autocomplete + auto-category

export interface GroceryEntry { name: string; category: string }

// Common German grocery items mapped to Heimlig's shopping categories.
// Used for type-ahead suggestions and automatic category assignment.
const CATALOG: Record<string, string[]> = {
  'Obst & Gemüse': [
    'Äpfel', 'Bananen', 'Birnen', 'Orangen', 'Mandarinen', 'Zitronen', 'Limetten', 'Trauben', 'Erdbeeren',
    'Heidelbeeren', 'Himbeeren', 'Kiwi', 'Ananas', 'Mango', 'Pfirsiche', 'Nektarinen', 'Pflaumen', 'Melone',
    'Avocado', 'Tomaten', 'Cherrytomaten', 'Gurke', 'Paprika', 'Zucchini', 'Aubergine', 'Karotten', 'Möhren',
    'Kartoffeln', 'Süßkartoffeln', 'Zwiebeln', 'Knoblauch', 'Lauch', 'Sellerie', 'Brokkoli', 'Blumenkohl',
    'Spinat', 'Salat', 'Eisbergsalat', 'Feldsalat', 'Rucola', 'Champignons', 'Pilze', 'Kürbis', 'Ingwer',
    'Radieschen', 'Rote Bete', 'Mais', 'Erbsen', 'Bohnen', 'Spargel', 'Kohlrabi', 'Weißkohl', 'Rotkohl', 'Petersilie', 'Basilikum', 'Schnittlauch',
  ],
  'Fleisch & Fisch': [
    'Hähnchenbrust', 'Hähnchenschenkel', 'Hackfleisch', 'Rinderhack', 'Gemischtes Hack', 'Rindersteak', 'Schweineschnitzel',
    'Schweinefilet', 'Putenbrust', 'Speck', 'Bacon', 'Salami', 'Schinken', 'Kochschinken', 'Würstchen', 'Bratwurst',
    'Wiener', 'Leberkäse', 'Lachs', 'Thunfisch', 'Forelle', 'Garnelen', 'Fischstäbchen', 'Hähnchen', 'Gulasch',
  ],
  'Backwaren': [
    'Brot', 'Vollkornbrot', 'Toastbrot', 'Brötchen', 'Baguette', 'Croissant', 'Laugenbrezel', 'Brezel', 'Kuchen',
    'Kekse', 'Knäckebrot', 'Zwieback', 'Hörnchen', 'Muffins', 'Donuts',
  ],
  'Getränke': [
    'Wasser', 'Mineralwasser', 'Sprudel', 'Apfelsaft', 'Orangensaft', 'Multivitaminsaft', 'Cola', 'Limonade', 'Eistee',
    'Kaffee', 'Espresso', 'Tee', 'Bier', 'Wein', 'Rotwein', 'Weißwein', 'Sekt', 'Energydrink', 'Saftschorle', 'Milchshake',
  ],
  'Tiefkühl': [
    'Pizza', 'Tiefkühlpizza', 'Pommes', 'Eis', 'Speiseeis', 'Tiefkühlgemüse', 'Tiefkühlbeeren', 'Spinat (TK)',
    'Fischstäbchen', 'Blätterteig', 'Backfisch', 'Tiefkühlkräuter',
  ],
  'Drogerie': [
    'Zahnpasta', 'Zahnbürste', 'Shampoo', 'Duschgel', 'Seife', 'Handseife', 'Deo', 'Rasierer', 'Rasierschaum',
    'Toilettenpapier', 'Küchenrolle', 'Taschentücher', 'Windeln', 'Feuchttücher', 'Waschmittel', 'Weichspüler',
    'Spülmittel', 'Spülmaschinentabs', 'Allzweckreiniger', 'Müllbeutel', 'Wattepads', 'Sonnencreme', 'Pflaster',
    'Haargel', 'Bodylotion', 'Damenhygiene', 'Klarspüler', 'Backofenreiniger', 'Glasreiniger',
  ],
  'Lebensmittel': [
    'Milch', 'Hafermilch', 'Butter', 'Margarine', 'Eier', 'Joghurt', 'Naturjoghurt', 'Quark', 'Sahne', 'Schmand',
    'Frischkäse', 'Käse', 'Gouda', 'Mozzarella', 'Parmesan', 'Feta', 'Reibekäse', 'Mehl', 'Zucker', 'Salz', 'Pfeffer',
    'Öl', 'Olivenöl', 'Sonnenblumenöl', 'Essig', 'Balsamico', 'Senf', 'Ketchup', 'Mayonnaise', 'Nudeln', 'Spaghetti',
    'Reis', 'Kartoffelpüree', 'Haferflocken', 'Müsli', 'Cornflakes', 'Marmelade', 'Honig', 'Nutella', 'Erdnussbutter',
    'Tomatensoße', 'Passierte Tomaten', 'Tomatenmark', 'Pesto', 'Brühe', 'Gemüsebrühe', 'Kokosmilch', 'Linsen',
    'Kichererbsen', 'Bohnen (Dose)', 'Mais (Dose)', 'Thunfisch (Dose)', 'Backpulver', 'Hefe', 'Vanillezucker',
    'Schokolade', 'Chips', 'Salzstangen', 'Gummibärchen', 'Riegel', 'Nüsse', 'Mandeln', 'Rosinen', 'Couscous',
    'Gnocchi', 'Tortellini', 'Pizzateig', 'Wraps', 'Tortillas', 'Streukäse', 'Sojasauce', 'Currypaste', 'Gewürze',
    'Paprikapulver', 'Curry', 'Zimt', 'Vanille', 'Puderzucker', 'Speisestärke', 'Tahin', 'Kaffeesahne', 'Kondensmilch',
  ],
};

// Flat list with categories
export const GROCERY_LIST: GroceryEntry[] = Object.entries(CATALOG)
  .flatMap(([category, names]) => names.map(name => ({ name, category })));

// Quick lookup by lowercased name → category
const BY_KEY: Record<string, string> = {};
GROCERY_LIST.forEach(e => { BY_KEY[e.name.toLowerCase()] = e.category; });

export function normalizeKey(name: string): string {
  return name.toLowerCase().trim();
}

// Return the known category for an exact item name, or undefined
export function categoryForItem(name: string): string | undefined {
  return BY_KEY[normalizeKey(name)];
}

// Search the curated catalog for items matching the query (prefix matches first)
export function searchGroceries(query: string, limit = 8): GroceryEntry[] {
  const q = normalizeKey(query);
  if (!q) return [];
  const starts: GroceryEntry[] = [];
  const contains: GroceryEntry[] = [];
  for (const e of GROCERY_LIST) {
    const n = e.name.toLowerCase();
    if (n.startsWith(q)) starts.push(e);
    else if (n.includes(q)) contains.push(e);
    if (starts.length >= limit) break;
  }
  return [...starts, ...contains].slice(0, limit);
}
