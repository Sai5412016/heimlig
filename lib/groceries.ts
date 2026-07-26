// lib/groceries.ts — curated German grocery catalog for autocomplete + auto-category

export interface GroceryEntry { name: string; category: string }

// Large curated list of common German grocery items mapped to Heimlig's shopping categories.
// Powers offline type-ahead suggestions and automatic category assignment (no network needed).
const CATALOG: Record<string, string[]> = {
  'Obst & Gemüse': [
    'Äpfel', 'Bananen', 'Birnen', 'Orangen', 'Mandarinen', 'Clementinen', 'Zitronen', 'Limetten', 'Grapefruit',
    'Weintrauben', 'Erdbeeren', 'Heidelbeeren', 'Himbeeren', 'Brombeeren', 'Johannisbeeren', 'Kirschen', 'Kiwi',
    'Ananas', 'Mango', 'Papaya', 'Pfirsiche', 'Nektarinen', 'Aprikosen', 'Pflaumen', 'Zwetschgen', 'Wassermelone',
    'Honigmelone', 'Granatapfel', 'Feigen', 'Datteln', 'Avocado', 'Kokosnuss', 'Sharon', 'Physalis', 'Rhabarber',
    'Tomaten', 'Cherrytomaten', 'Rispentomaten', 'Gurke', 'Salatgurke', 'Paprika', 'Spitzpaprika', 'Chili', 'Peperoni',
    'Zucchini', 'Aubergine', 'Karotten', 'Möhren', 'Pastinaken', 'Kartoffeln', 'Süßkartoffeln', 'Festkochende Kartoffeln',
    'Zwiebeln', 'Rote Zwiebeln', 'Frühlingszwiebeln', 'Schalotten', 'Knoblauch', 'Lauch', 'Porree', 'Sellerie',
    'Staudensellerie', 'Knollensellerie', 'Brokkoli', 'Blumenkohl', 'Romanesco', 'Spinat', 'Mangold', 'Grünkohl',
    'Kopfsalat', 'Eisbergsalat', 'Feldsalat', 'Rucola', 'Endiviensalat', 'Radicchio', 'Chicorée', 'Champignons',
    'Pilze', 'Kräuterseitlinge', 'Pfifferlinge', 'Kürbis', 'Hokkaido', 'Butternut', 'Ingwer', 'Kurkuma', 'Radieschen',
    'Rettich', 'Rote Bete', 'Kohlrabi', 'Weißkohl', 'Rotkohl', 'Wirsing', 'Spitzkohl', 'Chinakohl', 'Rosenkohl',
    'Fenchel', 'Spargel', 'grüner Spargel', 'Mais', 'Zuckerschoten', 'Erbsen', 'grüne Bohnen', 'Dicke Bohnen',
    'Petersilie', 'Basilikum', 'Schnittlauch', 'Koriander', 'Dill', 'Minze', 'Rosmarin', 'Thymian', 'Oregano', 'Salbei',
  ],
  'Fleisch & Fisch': [
    'Hähnchenbrust', 'Hähnchenschenkel', 'Hähnchenflügel', 'Ganzes Hähnchen', 'Hähnchen', 'Putenbrust', 'Putenschnitzel',
    'Hackfleisch', 'Rinderhack', 'Schweinehack', 'Gemischtes Hack', 'Rindersteak', 'Rinderfilet', 'Rinderbraten',
    'Gulasch', 'Schweineschnitzel', 'Schweinefilet', 'Schweinebraten', 'Kotelett', 'Nackensteak', 'Spareribs',
    'Lammkoteletts', 'Lammfilet', 'Speck', 'Bacon', 'Schinkenspeck', 'Salami', 'Schinken', 'Kochschinken',
    'Rohschinken', 'Serrano', 'Bratwurst', 'Würstchen', 'Wiener', 'Currywurst', 'Leberkäse', 'Frikadellen',
    'Mettwurst', 'Aufschnitt', 'Lachs', 'Räucherlachs', 'Thunfisch', 'Forelle', 'Kabeljau', 'Seelachs', 'Pangasius',
    'Garnelen', 'Shrimps', 'Scampi', 'Tintenfisch', 'Muscheln', 'Fischstäbchen', 'Backfisch', 'Matjes', 'Hering',
  ],
  'Backwaren': [
    'Brot', 'Vollkornbrot', 'Mischbrot', 'Roggenbrot', 'Dinkelbrot', 'Toastbrot', 'Vollkorntoast', 'Sandwichbrot',
    'Brötchen', 'Vollkornbrötchen', 'Laugenbrötchen', 'Baguette', 'Ciabatta', 'Croissant', 'Laugenbrezel', 'Brezel',
    'Kuchen', 'Käsekuchen', 'Donuts', 'Muffins', 'Kekse', 'Plätzchen', 'Knäckebrot', 'Zwieback', 'Hörnchen',
    'Franzbrötchen', 'Berliner', 'Waffeln', 'Pfannkuchen', 'Stollen', 'Brötchen zum Aufbacken',
  ],
  'Getränke': [
    'Wasser', 'Mineralwasser', 'Stilles Wasser', 'Sprudelwasser', 'Leitungswasser', 'Apfelsaft', 'Orangensaft',
    'Multivitaminsaft', 'Traubensaft', 'Tomatensaft', 'Apfelschorle', 'Saftschorle', 'Cola', 'Cola Zero', 'Fanta',
    'Sprite', 'Limonade', 'Eistee', 'Energydrink', 'Red Bull', 'Tonic Water', 'Spezi', 'Kaffee', 'Filterkaffee',
    'Kaffeebohnen', 'Espresso', 'Kaffeepads', 'Kaffeekapseln', 'Tee', 'Schwarztee', 'Grüntee', 'Früchtetee',
    'Kräutertee', 'Kakao', 'Trinkschokolade', 'Bier', 'Pils', 'Weizenbier', 'Radler', 'Alkoholfreies Bier',
    'Wein', 'Rotwein', 'Weißwein', 'Roséwein', 'Sekt', 'Prosecco', 'Aperol', 'Gin', 'Wodka', 'Rum', 'Whisky', 'Saft',
  ],
  'Tiefkühl': [
    'Tiefkühlpizza', 'Pizza', 'Pommes', 'Kroketten', 'Rösti', 'Eis', 'Speiseeis', 'Eiscreme', 'Magnum',
    'Tiefkühlgemüse', 'Erbsen (TK)', 'Spinat (TK)', 'Rahmspinat', 'Tiefkühlbeeren', 'Tiefkühl-Himbeeren',
    'Fischstäbchen', 'Backfisch', 'Tiefkühlkräuter', 'Blätterteig', 'Pizzateig (TK)', 'Frühlingsrollen', 'Wedges',
    'Tiefkühl-Lasagne', 'Tiefkühl-Brötchen', 'Eiswürfel',
  ],
  'Drogerie': [
    'Zahnpasta', 'Zahnbürste', 'Zahnseide', 'Mundwasser', 'Shampoo', 'Spülung', 'Conditioner', 'Duschgel', 'Seife',
    'Handseife', 'Flüssigseife', 'Deo', 'Deospray', 'Rasierer', 'Rasierklingen', 'Rasierschaum', 'Rasiergel',
    'Toilettenpapier', 'Küchenrolle', 'Taschentücher', 'Kosmetiktücher', 'Windeln', 'Feuchttücher', 'Waschmittel',
    'Colorwaschmittel', 'Vollwaschmittel', 'Weichspüler', 'Spülmittel', 'Spülmaschinentabs', 'Klarspüler', 'Salz (Spülm.)',
    'Allzweckreiniger', 'Glasreiniger', 'Badreiniger', 'WC-Reiniger', 'Backofenreiniger', 'Entkalker', 'Müllbeutel',
    'Gefrierbeutel', 'Frischhaltefolie', 'Alufolie', 'Backpapier', 'Wattepads', 'Wattestäbchen', 'Sonnencreme',
    'Bodylotion', 'Handcreme', 'Gesichtscreme', 'Lippenbalsam', 'Haargel', 'Haarspray', 'Pflaster', 'Desinfektionsmittel',
    'Damenbinden', 'Tampons', 'Schwämme', 'Spüllappen', 'Putztücher', 'Gummihandschuhe', 'Batterien', 'Taschentücher (Box)',
  ],
  'Lebensmittel': [
    'Milch', 'Vollmilch', 'Fettarme Milch', 'Laktosefreie Milch', 'Hafermilch', 'Mandelmilch', 'Sojamilch', 'Butter',
    'Halbfettbutter', 'Margarine', 'Eier', 'Bio-Eier', 'Joghurt', 'Naturjoghurt', 'Griechischer Joghurt', 'Fruchtjoghurt',
    'Skyr', 'Quark', 'Magerquark', 'Sahne', 'Schlagsahne', 'Saure Sahne', 'Schmand', 'Crème fraîche', 'Frischkäse',
    'Käse', 'Gouda', 'Emmentaler', 'Edamer', 'Mozzarella', 'Parmesan', 'Feta', 'Hirtenkäse', 'Camembert', 'Brie',
    'Reibekäse', 'Streukäse', 'Harzer', 'Hüttenkäse', 'Pudding', 'Mehl', 'Vollkornmehl', 'Dinkelmehl', 'Zucker',
    'Brauner Zucker', 'Puderzucker', 'Vanillezucker', 'Salz', 'Meersalz', 'Pfeffer', 'Öl', 'Olivenöl', 'Sonnenblumenöl',
    'Rapsöl', 'Kokosöl', 'Essig', 'Balsamico', 'Apfelessig', 'Senf', 'Ketchup', 'Mayonnaise', 'Remoulade', 'Sojasauce',
    'Sweet Chili Sauce', 'BBQ-Sauce', 'Nudeln', 'Spaghetti', 'Penne', 'Fusilli', 'Lasagneplatten', 'Tortellini',
    'Gnocchi', 'Reis', 'Basmatireis', 'Risottoreis', 'Milchreis', 'Couscous', 'Bulgur', 'Quinoa', 'Haferflocken',
    'Müsli', 'Granola', 'Cornflakes', 'Knuspermüsli', 'Marmelade', 'Honig', 'Nutella', 'Nuss-Nougat-Creme', 'Erdnussbutter',
    'Tomatensoße', 'Passierte Tomaten', 'Gehackte Tomaten', 'Tomatenmark', 'Pesto', 'Pesto Rosso', 'Brühe', 'Gemüsebrühe',
    'Hühnerbrühe', 'Fond', 'Kokosmilch', 'Linsen', 'Rote Linsen', 'Kichererbsen', 'Kidneybohnen', 'weiße Bohnen',
    'Mais (Dose)', 'Erbsen (Dose)', 'Thunfisch (Dose)', 'Sauerkraut', 'Gewürzgurken', 'Oliven', 'Antipasti', 'Backpulver',
    'Natron', 'Hefe', 'Trockenhefe', 'Speisestärke', 'Gelatine', 'Vanille', 'Zimt', 'Paprikapulver', 'Currypulver',
    'Curry', 'Chiliflocken', 'Muskat', 'Kreuzkümmel', 'Italienische Kräuter', 'Brühwürfel', 'Schokolade', 'Zartbitterschokolade',
    'Vollmilchschokolade', 'Kekse', 'Chips', 'Salzstangen', 'Cracker', 'Gummibärchen', 'Schokoriegel', 'Müsliriegel',
    'Nüsse', 'Mandeln', 'Walnüsse', 'Cashews', 'Haselnüsse', 'Rosinen', 'Trockenfrüchte', 'Popcorn', 'Tahin',
    'Kaffeesahne', 'Kondensmilch', 'Tofu', 'Räuchertofu', 'Hummus', 'Wraps', 'Tortillas', 'Tacoschalen', 'Pizzateig',
    'Currypaste', 'Kokosraspeln', 'Tortilla-Chips', 'Sojasauce',
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

// Levenshtein edit distance (iterative DP) — catalog entries are short (a few hundred, single
// words/short phrases), so a plain O(n*m) implementation per comparison is fast enough to run
// against the whole catalog on every keystroke.
function editDistance(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const row = new Array(n + 1);
  for (let j = 0; j <= n; j++) row[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = row[j];
      row[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, row[j], row[j - 1]);
      prev = tmp;
    }
  }
  return row[n];
}

// Finds the closest catalog entry for a misspelled item name, so a typo (e.g. "Fischstebchen"
// instead of "Fischstäbchen") still gets the right category instead of silently keeping
// whichever category chip was last selected. Only kicks in for near-misses, not free-text: the
// allowed edit distance scales with word length (never more than ~30% of the typed text), and
// short inputs (<4 chars) are skipped entirely since e.g. "Ei" vs "Eis" is 1 edit but a
// different item.
export function fuzzyMatchGrocery(name: string): GroceryEntry | undefined {
  const q = normalizeKey(name);
  if (q.length < 4) return undefined;
  if (BY_KEY[q]) return undefined; // exact match already handled by categoryForItem
  const maxDistance = Math.max(1, Math.floor(q.length * 0.3));
  let best: GroceryEntry | undefined;
  let bestDistance = maxDistance + 1;
  for (const entry of GROCERY_LIST) {
    const candidate = entry.name.toLowerCase();
    if (Math.abs(candidate.length - q.length) > maxDistance) continue; // cheap pre-filter
    const d = editDistance(q, candidate);
    if (d < bestDistance) { bestDistance = d; best = entry; }
  }
  return bestDistance <= maxDistance ? best : undefined;
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
  }
  return [...starts, ...contains].slice(0, limit);
}
