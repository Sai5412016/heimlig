// app/(tabs)/shopping.tsx
import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { Dimensions } from 'react-native';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Animated, Platform, KeyboardAvoidingView, Alert, RefreshControl,
  Pressable, Modal, ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
const hapticImpact = (style: Haptics.ImpactFeedbackStyle) => { if (Platform.OS !== 'web') Haptics.impactAsync(style); };
const hapticNotification = (type: Haptics.NotificationFeedbackType) => { if (Platform.OS !== 'web') Haptics.notificationAsync(type); };
import { colors, spacing, radius, typography, shadow, SHOPPING_CATEGORIES, CATEGORY_COLORS, type ColorPalette } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { supabase, ShoppingItem, RecipeIngredient } from '../../lib/supabase';
import { useStore } from '../../store/useStore';
import RecipeImportModal, { RecipeAddOpts } from '../../components/RecipeImportModal';
import ProductScanner from '../../components/ProductScanner';
import { searchGroceries, categoryForItem, normalizeKey } from '../../lib/groceries';
import { searchBrands, bumpBrand, supermarketKey, type BrandEntry } from '../../lib/brands';

// ─── ADD ITEM MODAL ───────────────────────────────────────────
const AddItemModal = ({ visible, onClose, onAdd, supermarket }: {
  visible: boolean;
  onClose: () => void;
  onAdd: (name: string, quantity: string, category: string, brand?: string) => void;
  supermarket: string | null;
}) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [category, setCategory] = useState('Lebensmittel');
  const [brand, setBrand] = useState('');
  const [brandOptions, setBrandOptions] = useState<BrandEntry[]>([]);
  const inputRef = useRef<TextInput>(null);
  const itemCatalog = useStore(s => s.itemCatalog);
  const smKey = supermarketKey(supermarket);

  useEffect(() => {
    if (visible) {
      setTimeout(() => inputRef.current?.focus(), 300);
    } else {
      setName(''); setQuantity(''); setCategory('Lebensmittel'); setBrand(''); setBrandOptions([]);
    }
  }, [visible]);

  // Crowdsourced brand suggestions for this product at this supermarket (debounced).
  useEffect(() => {
    if (!smKey || !name.trim()) { setBrandOptions([]); return; }
    const q = name;
    let active = true;
    const t = setTimeout(async () => {
      const res = await searchBrands(smKey, q);
      if (active) setBrandOptions(res);
    }, 300);
    return () => { active = false; clearTimeout(t); };
  }, [name, smKey]);

  // Merge the household's learned items (ranked by frequency) with the curated catalog
  const suggestions = useMemo(() => {
    const q = normalizeKey(name);
    if (!q) return [];
    const seen = new Set<string>();
    const out: { name: string; category: string }[] = [];
    // Personalized first
    for (const c of itemCatalog) {
      if (c.name_key.includes(q) && !seen.has(c.name_key)) {
        seen.add(c.name_key); out.push({ name: c.name, category: c.category });
      }
      if (out.length >= 6) break;
    }
    // Then the curated dictionary
    for (const g of searchGroceries(name, 8)) {
      const k = normalizeKey(g.name);
      if (!seen.has(k)) { seen.add(k); out.push(g); }
      if (out.length >= 6) break;
    }
    // Hide a single exact match (nothing to suggest)
    return out.filter(o => normalizeKey(o.name) !== q).slice(0, 6);
  }, [name, itemCatalog]);

  // Most frequently bought items, shown as quick-add chips when the field is empty
  const frequent = useMemo(() => itemCatalog.slice(0, 8), [itemCatalog]);

  // Auto-assign category when the typed name matches a known item
  const applyName = (text: string) => {
    setName(text);
    setBrand('');
    const known = categoryForItem(text) || itemCatalog.find(c => c.name_key === normalizeKey(text))?.category;
    if (known) setCategory(known);
  };

  const pickSuggestion = (s: { name: string; category: string }) => {
    setName(s.name);
    setBrand('');
    setCategory(s.category);
  };

  const handleAdd = () => {
    if (!name.trim()) return;
    const b = brand.trim();
    onAdd(name.trim(), quantity.trim(), category, b || undefined);
    if (smKey && b) bumpBrand(smKey, name.trim(), b);
    setName(''); setQuantity(''); setBrand(''); setBrandOptions([]);
  };

  const quickAdd = (s: { name: string; category: string }) => {
    onAdd(s.name, '', s.category);
    hapticImpact(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={styles.modalOverlay} onPress={onClose}>
          <Pressable style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Artikel hinzufügen</Text>

            <View style={styles.inputRow}>
              <TextInput
                ref={inputRef}
                style={[styles.input, styles.inputFlex]}
                placeholder="Was brauchst du?"
                placeholderTextColor={colors.textMuted}
                value={name}
                onChangeText={applyName}
                returnKeyType="done"
                onSubmitEditing={handleAdd}
              />
              <TextInput
                style={[styles.input, styles.inputQty]}
                placeholder="Menge"
                placeholderTextColor={colors.textMuted}
                value={quantity}
                onChangeText={setQuantity}
              />
            </View>

            {/* Type-ahead suggestions */}
            {suggestions.length > 0 && (
              <View style={styles.suggestBox}>
                {suggestions.map(s => (
                  <TouchableOpacity key={s.name} style={styles.suggestRow} onPress={() => pickSuggestion(s)}>
                    <Text style={styles.suggestName}>{s.name}</Text>
                    <Text style={styles.suggestCat}>{s.category}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Frequently bought — quick add */}
            {!name.trim() && frequent.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>HÄUFIG GEKAUFT</Text>
                <View style={styles.freqWrap}>
                  {frequent.map(f => (
                    <TouchableOpacity key={f.name_key} style={styles.freqChip} onPress={() => quickAdd({ name: f.name, category: f.category })}>
                      <Text style={styles.freqChipText}>+ {f.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {/* Crowdsourced brand picker — only inside a supermarket list */}
            {smKey && name.trim().length > 0 && (
              <>
                <Text style={styles.sectionLabel}>MARKE BEI {(supermarket ?? '').toUpperCase()} (OPTIONAL)</Text>
                {brandOptions.length > 0 && (
                  <View style={styles.freqWrap}>
                    {brandOptions.map(b => {
                      const active = brand.trim().toLowerCase() === b.brand.toLowerCase();
                      return (
                        <TouchableOpacity
                          key={b.brand}
                          style={[styles.brandChip, active && styles.brandChipActive]}
                          onPress={() => setBrand(active ? '' : b.brand)}
                        >
                          <Text style={[styles.brandChipText, active && styles.brandChipTextActive]}>{b.brand}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
                <TextInput
                  style={[styles.input, { marginTop: spacing.sm }]}
                  placeholder="Eigene Marke eingeben…"
                  placeholderTextColor={colors.textMuted}
                  value={brand}
                  onChangeText={setBrand}
                />
              </>
            )}

            <Text style={styles.sectionLabel}>KATEGORIE</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
              {SHOPPING_CATEGORIES.map(cat => {
                const isActive = cat === category;
                const catColor = CATEGORY_COLORS[cat] || colors.sonstiges;
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.categoryChip, isActive && { backgroundColor: catColor, borderColor: catColor }]}
                    onPress={() => setCategory(cat)}
                  >
                    <Text style={[styles.categoryChipText, isActive && { color: colors.textInverse }]}>{cat}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              style={[styles.addBtn, !name.trim() && styles.addBtnDisabled]}
              onPress={handleAdd}
              disabled={!name.trim()}
            >
              <Text style={styles.addBtnText}>Hinzufügen</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
};


const LIST_EMOJIS = ['🛒', '🛍️', '🏪', '💊', '🥦', '🥩', '🐾', '🏠', '📦', '👗'];
const SUPERMARKETS = [
  { name: 'Rewe', emoji: '🛍️' },
  { name: 'Aldi', emoji: '🛒' },
  { name: 'Edeka', emoji: '🏪' },
  { name: 'Lidl', emoji: '💛' },
  { name: 'Penny', emoji: '🟡' },
  { name: 'Netto', emoji: '💰' },
  { name: 'dm', emoji: '💊' },
  { name: 'Rossmann', emoji: '🌸' },
];

const CATEGORY_EMOJIS: Record<string, string> = {
  'Lebensmittel': '🥫', 'Obst & Gemüse': '🥬', 'Tiefkühl': '❄️',
  'Fleisch & Fisch': '🥩', 'Drogerie': '💊', 'Backwaren': '🥖',
  'Getränke': '🥤', 'Sonstiges': '🛒',
};

const ITEM_EMOJIS: Record<string, string> = {
  'gurke': '🥒', 'salatgurke': '🥒',
  'brokkoli': '🥦', 'blumenkohl': '🥦',
  'tomaten': '🍅', 'tomate': '🍅', 'cherrytomaten': '🍅', 'rispentomaten': '🍅',
  'äpfel': '🍎', 'apfel': '🍎',
  'bananen': '🍌', 'banane': '🍌',
  'karotten': '🥕', 'möhren': '🥕', 'karotte': '🥕', 'pastinaken': '🥕',
  'kartoffeln': '🥔', 'kartoffel': '🥔', 'süßkartoffeln': '🥔',
  'paprika': '🫑', 'spitzpaprika': '🫑',
  'zitronen': '🍋', 'zitrone': '🍋', 'limetten': '🍋',
  'orangen': '🍊', 'orange': '🍊', 'mandarinen': '🍊', 'clementinen': '🍊',
  'erdbeeren': '🍓', 'erdbeere': '🍓',
  'weintrauben': '🍇', 'trauben': '🍇',
  'avocado': '🥑',
  'mais': '🌽',
  'chili': '🌶️', 'peperoni': '🌶️',
  'pilze': '🍄', 'champignons': '🍄', 'kräuterseitlinge': '🍄',
  'zwiebeln': '🧅', 'zwiebel': '🧅', 'rote zwiebeln': '🧅',
  'knoblauch': '🧄',
  'kürbis': '🎃', 'hokkaido': '🎃', 'butternut': '🎃',
  'milch': '🥛', 'sahne': '🥛', 'hafermilch': '🥛',
  'eier': '🥚', 'ei': '🥚',
  'butter': '🧈',
  'käse': '🧀',
  'joghurt': '🫙',
  'brot': '🍞', 'toastbrot': '🍞', 'vollkornbrot': '🍞',
  'brötchen': '🥐', 'baguette': '🥖', 'croissant': '🥐',
  'bier': '🍺', 'pils': '🍺', 'weizenbier': '🍺',
  'wein': '🍷', 'rotwein': '🍷', 'weißwein': '🍷', 'roséwein': '🍷',
  'kaffee': '☕', 'kaffeebohnen': '☕', 'espresso': '☕',
  'tee': '🍵',
  'lachs': '🐟', 'räucherlachs': '🐟', 'thunfisch': '🐟',
  'hähnchen': '🍗', 'hähnchenbrust': '🍗', 'hähnchenschenkel': '🍗',
  'hackfleisch': '🥩', 'rindersteak': '🥩', 'schinken': '🥩',
  'pizza': '🍕',
  'nudeln': '🍝', 'pasta': '🍝', 'spaghetti': '🍝',
  'reis': '🍚',
  'wasser': '💧', 'mineralwasser': '💧', 'stilles wasser': '💧',
  'saft': '🧃', 'orangensaft': '🧃', 'apfelsaft': '🧃', 'apfelschorle': '🧃',
  'cola': '🥤', 'limonade': '🥤', 'fanta': '🥤',
  'mehl': '🌾',
  'zucker': '🍬',
  'olivenöl': '🫒', 'öl': '🫒',
  'salz': '🧂',
  'honig': '🍯',
  'schokolade': '🍫',
  'erdnussbutter': '🥜', 'nüsse': '🥜',
  'chips': '🍟', 'snacks': '🫙',
  // Fleisch & Wurst
  'bratwurst': '🌭', 'wurst': '🌭', 'würstchen': '🌭', 'wiener': '🌭', 'frankfurter': '🌭',
  'aufschnitt': '🥩', 'salami': '🥩', 'speck': '🥓', 'bacon': '🥓',
  'steak': '🥩', 'schweinefleisch': '🥩', 'rindfleisch': '🥩',
  'grillfleisch': '🍖', 'grillwurst': '🌭', 'grillgut': '🍖',
  'fischstäbchen': '🐟', 'garnelen': '🦐',
  // Salate & Fertiggerichte
  'kartoffelsalat': '🥔', 'nudelsalat': '🍝', 'krautsalat': '🥗',
  'salat': '🥗', 'feldsalat': '🥗', 'rucola': '🥗', 'eisbergsalat': '🥗',
  'coleslaw': '🥗',
  // Gemüse ergänzend
  'spinat': '🥬', 'mangold': '🥬', 'grünkohl': '🥬', 'wirsing': '🥬',
  'rotkohl': '🥬', 'weißkohl': '🥬', 'sauerkraut': '🥬',
  'lauch': '🧅', 'porree': '🧅', 'frühlingszwiebeln': '🧅',
  'radieschen': '🫑', 'rote beete': '🟣', 'zucchini': '🥒', 'aubergine': '🍆',
  'erbsen': '🫛', 'bohnen': '🫛', 'linsen': '🫛', 'kichererbsen': '🫛',
  // Obst ergänzend
  'mango': '🥭', 'ananas': '🍍', 'melone': '🍈', 'wassermelone': '🍉',
  'kiwi': '🥝', 'birnen': '🍐', 'birne': '🍐', 'pflaumen': '🍑',
  'kirschen': '🍒', 'blaubeeren': '🫐', 'himbeeren': '🍓',
  // Saucen & Gewürze
  'ketchup': '🍅', 'senf': '🌿', 'mayonnaise': '🥚', 'mayo': '🥚',
  'soße': '🫙', 'tomatensoße': '🍅', 'pestosoße': '🌿', 'pesto': '🌿',
  'essig': '🫙', 'balsamico': '🫙',
  // Tiefkühl
  'tiefkühlpizza': '🍕', 'tiefkühlfisch': '🐟',
  'eis': '🍦', 'eiscreme': '🍦',
  // Haushalt
  'waschmittel': '🧺', 'spülmittel': '🧴', 'toilettenpapier': '🧻',
  'küchenrolle': '🧻', 'müllbeutel': '🗑️',
};

// Exact match first; otherwise fall back to the longest known keyword contained in the
// name (handles real-world names like "Cherry-Tomaten" or "Joghurt, 1,5% Fett").
function matchByName<T>(name: string, dict: Record<string, T>): T | undefined {
  const n = name.toLowerCase().trim();
  if (n in dict) return dict[n];
  let bestKey: string | undefined;
  for (const key of Object.keys(dict)) {
    if (n.includes(key) && (!bestKey || key.length > bestKey.length)) bestKey = key;
  }
  return bestKey !== undefined ? dict[bestKey] : undefined;
}

function getItemEmoji(name: string, category: string): string {
  return matchByName(name, ITEM_EMOJIS) || CATEGORY_EMOJIS[category] || '🛒';
}

const ITEM_COLORS: Record<string, string> = {
  // Obst & Gemüse
  'bananen': '#FFD93D', 'banane': '#FFD93D',
  'tomaten': '#FF4444', 'tomate': '#FF4444', 'cherrytomaten': '#FF4444', 'rispentomaten': '#FF4444',
  'brokkoli': '#51CF66', 'blumenkohl': '#94A3B8',
  'gurke': '#74C69D', 'salatgurke': '#74C69D',
  'paprika': '#FF6B35', 'spitzpaprika': '#FF6B35',
  'karotten': '#FF922B', 'möhren': '#FF922B', 'karotte': '#FF922B', 'pastinaken': '#FF922B',
  'kartoffeln': '#C49A6C', 'kartoffel': '#C49A6C', 'süßkartoffeln': '#E27D3E',
  'äpfel': '#FF4B4B', 'apfel': '#FF4B4B',
  'zitronen': '#FFD93D', 'zitrone': '#FFD93D', 'limetten': '#51CF66',
  'orangen': '#FF9F1C', 'orange': '#FF9F1C', 'mandarinen': '#FF9F1C', 'clementinen': '#FF9F1C',
  'erdbeeren': '#FF4B6E', 'erdbeere': '#FF4B6E',
  'weintrauben': '#9B59B6', 'trauben': '#9B59B6',
  'avocado': '#6BAD6A',
  'mais': '#FFD93D',
  'chili': '#EF4444', 'peperoni': '#EF4444',
  'pilze': '#A0856C', 'champignons': '#A0856C', 'kräuterseitlinge': '#A0856C',
  'zwiebeln': '#C084FC', 'zwiebel': '#C084FC', 'rote zwiebeln': '#C084FC',
  'knoblauch': '#DDD5C8',
  'kürbis': '#FF7F00', 'hokkaido': '#FF7F00', 'butternut': '#FF7F00',
  // Milch & Kühlung
  'milch': '#7CB9E8', 'sahne': '#7CB9E8', 'hafermilch': '#A8D5A2',
  'eier': '#F5D293', 'ei': '#F5D293',
  'butter': '#FFD166',
  'käse': '#FFC107',
  'joghurt': '#81ECEC',
  // Backwaren
  'brot': '#C49A6C', 'toastbrot': '#C49A6C', 'vollkornbrot': '#8B6343',
  'brötchen': '#F5D293', 'baguette': '#C49A6C', 'croissant': '#F5D293',
  // Getränke
  'bier': '#FBBF24', 'pils': '#FBBF24', 'weizenbier': '#FBBF24',
  'wein': '#9B2335', 'rotwein': '#9B2335', 'weißwein': '#D4B896', 'roséwein': '#E8B4B8',
  'kaffee': '#7C5C3E', 'kaffeebohnen': '#7C5C3E', 'espresso': '#7C5C3E',
  'tee': '#A8CF74',
  'wasser': '#90CAF9', 'mineralwasser': '#90CAF9', 'stilles wasser': '#90CAF9',
  'saft': '#FF9F1C', 'orangensaft': '#FF9F1C', 'apfelsaft': '#FFBE57', 'apfelschorle': '#FFBE57',
  'cola': '#C41E3A', 'limonade': '#FFD93D', 'fanta': '#FF8C00',
  // Fleisch & Fisch
  'lachs': '#FF9E7D', 'räucherlachs': '#FF9E7D', 'thunfisch': '#7EB4D5',
  'hähnchen': '#F5D293', 'hähnchenbrust': '#F5D293', 'hähnchenschenkel': '#F5D293',
  'hackfleisch': '#C0544D', 'rindersteak': '#C0544D', 'schinken': '#E87A7A',
  // Tiefkühl & Sonstiges
  'pizza': '#FF7038',
  'nudeln': '#F5D293', 'pasta': '#F5D293', 'spaghetti': '#F5D293',
  'reis': '#E8E0D0',
  'mehl': '#DDD5C8',
  'zucker': '#FFD93D',
  'olivenöl': '#A8CF74', 'öl': '#A8CF74',
  'salz': '#B0C4DE',
  'honig': '#FFB830',
  'schokolade': '#7C4D33',
  'erdnussbutter': '#C49A6C', 'nüsse': '#C49A6C',
  'chips': '#FFD93D', 'snacks': '#FF7038',
  // Fleisch & Wurst (ergänzend)
  'bratwurst': '#D4603A', 'wurst': '#D4603A', 'würstchen': '#D4603A', 'wiener': '#D4603A', 'frankfurter': '#D4603A',
  'aufschnitt': '#C0544D', 'salami': '#C0544D',
  'speck': '#E87A7A', 'bacon': '#E87A7A',
  'steak': '#C0544D', 'schweinefleisch': '#C0544D', 'rindfleisch': '#C0544D',
  'grillfleisch': '#B94040', 'grillwurst': '#D4603A', 'grillgut': '#B94040',
  'fischstäbchen': '#7EB4D5', 'garnelen': '#FF9E7D',
  // Salate & Fertiggerichte
  'kartoffelsalat': '#C49A6C', 'nudelsalat': '#F5D293', 'krautsalat': '#74C69D',
  'salat': '#51CF66', 'feldsalat': '#51CF66', 'rucola': '#51CF66', 'eisbergsalat': '#74C69D',
  'coleslaw': '#74C69D',
  // Gemüse (ergänzend)
  'spinat': '#2D9E57', 'mangold': '#51CF66', 'grünkohl': '#2D9E57', 'wirsing': '#74C69D',
  'rotkohl': '#9B59B6', 'weißkohl': '#DDD5C8', 'sauerkraut': '#A8CF74',
  'lauch': '#74C69D', 'porree': '#74C69D', 'frühlingszwiebeln': '#74C69D',
  'radieschen': '#FF4B6E', 'rote beete': '#9B2335', 'zucchini': '#74C69D', 'aubergine': '#6C3483',
  'erbsen': '#51CF66', 'bohnen': '#2D9E57', 'linsen': '#C49A6C', 'kichererbsen': '#D4A847',
  // Obst (ergänzend)
  'mango': '#FF9F1C', 'ananas': '#FFD93D', 'melone': '#A8CF74', 'wassermelone': '#FF4B6E',
  'kiwi': '#6BAD6A', 'birnen': '#A8CF74', 'birne': '#A8CF74', 'pflaumen': '#9B59B6',
  'kirschen': '#C0392B', 'blaubeeren': '#4A6FA5', 'himbeeren': '#E91E8C',
  // Saucen & Gewürze
  'ketchup': '#FF4444', 'senf': '#FFD93D', 'mayonnaise': '#F5D293', 'mayo': '#F5D293',
  'soße': '#C49A6C', 'tomatensoße': '#FF4444', 'pestosoße': '#2D9E57', 'pesto': '#2D9E57',
  'essig': '#DDD5C8', 'balsamico': '#7C4D33',
  // Tiefkühl
  'tiefkühlpizza': '#FF7038', 'tiefkühlfisch': '#7EB4D5',
  'eis': '#81ECEC', 'eiscreme': '#81ECEC',
  // Haushalt
  'waschmittel': '#74C5F5', 'spülmittel': '#74C5F5', 'toilettenpapier': '#DDD5C8',
  'küchenrolle': '#DDD5C8', 'müllbeutel': '#7F8C8D',
};

function getItemColor(name: string, category: string): string {
  return matchByName(name, ITEM_COLORS) || CATEGORY_COLORS[category] || colors.sonstiges;
}

const TILE_SIZE = (Dimensions.get('window').width - spacing.lg * 2 - spacing.sm * 2) / 3;

// ─── TILE ITEM ────────────────────────────────────────────────
const TileItem = React.memo(({ item, onToggle, onDelete }: {
  item: ShoppingItem; onToggle: (id: string) => void; onDelete: (id: string) => void;
}) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const itemColor = getItemColor(item.name, item.category);
  const emoji = getItemEmoji(item.name, item.category);
  return (
    <TouchableOpacity
      style={[styles.tile, { width: TILE_SIZE, backgroundColor: item.checked ? itemColor + '40' : itemColor + '18', borderColor: itemColor + '60' }]}
      onPress={() => onToggle(item.id)}
      onLongPress={() => onDelete(item.id)}
      activeOpacity={0.7}
    >
      {item.checked && (
        <View style={[styles.tileCheckBadge, { backgroundColor: itemColor }]}>
          <Text style={styles.tileCheckMark}>✓</Text>
        </View>
      )}
      <Text style={styles.tileEmoji}>{emoji}</Text>
      <Text style={[styles.tileName, item.checked && styles.tileNameChecked]} numberOfLines={2}>{item.name}</Text>
      {item.brand ? <Text style={styles.tileBrand} numberOfLines={1}>{item.brand}</Text> : null}
      {item.quantity ? <Text style={styles.tileQty}>{item.quantity}</Text> : null}
    </TouchableOpacity>
  );
});

// ─── LIST PICKER MODAL ────────────────────────────────────────
const ListPickerModal = ({ visible, onClose }: { visible: boolean; onClose: () => void }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { shoppingLists, activeListId, switchList, createShoppingList, deleteShoppingList } = useStore();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmoji, setNewEmoji] = useState('🛒');
  const nameRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!visible) { setCreating(false); setNewName(''); setNewEmoji('🛒'); }
  }, [visible]);

  useEffect(() => {
    if (creating) setTimeout(() => nameRef.current?.focus(), 200);
  }, [creating]);

  const handleSwitch = async (id: string) => {
    await switchList(id);
    onClose();
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await createShoppingList(newName.trim(), newEmoji);
    onClose();
  };

  const handleDelete = (id: string, name: string) => {
    if (shoppingLists.length <= 1) {
      Alert.alert('Nicht möglich', 'Du brauchst mindestens eine Einkaufsliste.');
      return;
    }
    Alert.alert(`"${name}" löschen?`, 'Alle Artikel in dieser Liste werden ebenfalls gelöscht.', [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Löschen', style: 'destructive', onPress: () => deleteShoppingList(id) },
    ]);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Einkaufslisten</Text>

          {shoppingLists.map(list => (
            <TouchableOpacity
              key={list.id}
              style={[styles.listRow, list.id === activeListId && styles.listRowActive]}
              onPress={() => handleSwitch(list.id)}
              activeOpacity={0.7}
            >
              <Text style={styles.listRowEmoji}>{list.emoji ?? '🛒'}</Text>
              <Text style={[styles.listRowName, list.id === activeListId && styles.listRowNameActive]}>
                {list.name}
              </Text>
              {list.id === activeListId && <Text style={styles.listRowCheck}>✓</Text>}
              {list.id !== activeListId && (
                <TouchableOpacity
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  onPress={() => handleDelete(list.id, list.name)}
                >
                  <Text style={styles.listRowDelete}>🗑</Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          ))}

          <View style={styles.supermarketSection}>
            <Text style={styles.supermarketLabel}>Schnell erstellen</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.xs }}>
                {SUPERMARKETS.map(sm => {
                  const existing = shoppingLists.find(l => l.name.toLowerCase() === sm.name.toLowerCase());
                  const isActive = existing?.id === activeListId;
                  return (
                    <TouchableOpacity
                      key={sm.name}
                      style={[styles.supermarketChip, isActive && styles.supermarketChipActive]}
                      onPress={async () => {
                        if (existing) {
                          await switchList(existing.id);
                          onClose();
                        } else {
                          await createShoppingList(sm.name, sm.emoji);
                          onClose();
                        }
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.supermarketChipEmoji}>{sm.emoji}</Text>
                      <Text style={[styles.supermarketChipName, isActive && styles.supermarketChipNameActive]}>{sm.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>

          {creating ? (
            <View style={styles.createBox}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.sm }}>
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  {LIST_EMOJIS.map(e => (
                    <TouchableOpacity
                      key={e}
                      style={[styles.emojiChip, newEmoji === e && styles.emojiChipActive]}
                      onPress={() => setNewEmoji(e)}
                    >
                      <Text style={styles.emojiChipText}>{e}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
              <View style={styles.inputRow}>
                <TextInput
                  ref={nameRef}
                  style={[styles.input, styles.inputFlex]}
                  placeholder="Name der Liste"
                  placeholderTextColor={colors.textMuted}
                  value={newName}
                  onChangeText={setNewName}
                  returnKeyType="done"
                  onSubmitEditing={handleCreate}
                />
              </View>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <TouchableOpacity style={[styles.addBtn, { flex: 1, backgroundColor: colors.border }]} onPress={() => setCreating(false)}>
                  <Text style={[styles.addBtnText, { color: colors.text }]}>Abbrechen</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.addBtn, { flex: 1 }, !newName.trim() && styles.addBtnDisabled]}
                  onPress={handleCreate}
                  disabled={!newName.trim()}
                >
                  <Text style={styles.addBtnText}>Erstellen</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={styles.newListBtn} onPress={() => setCreating(true)}>
              <Text style={styles.newListBtnText}>+ Neue Liste</Text>
            </TouchableOpacity>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
};

// ─── MAIN SCREEN ──────────────────────────────────────────────
export default function ShoppingScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { household, currentMember, activeListId, items, setItems, toggleItem, addItem, deleteItem, shoppingLists, saveRecipe, loadItemCatalog } = useStore();
  const [showModal, setShowModal] = useState(false);
  const [showRecipeModal, setShowRecipeModal] = useState(false);
  const [showListPicker, setShowListPicker] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showChecked, setShowChecked] = useState(true);
  const isPremium = household?.plan_tier !== 'free';

  useEffect(() => { loadItemCatalog(); }, [household?.id]);

  const activeList = shoppingLists.find(l => l.id === activeListId);
  const unchecked = useMemo(() => items.filter(i => !i.checked), [items]);
  const checked = useMemo(() => items.filter(i => i.checked), [items]);
  const progress = items.length > 0 ? checked.length / items.length : 0;

  const groupedItems = useMemo(() => {
    const groups: Record<string, ShoppingItem[]> = {};
    unchecked.forEach(item => {
      const cat = item.category || 'Sonstiges';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    });
    return SHOPPING_CATEGORIES
      .filter(cat => groups[cat]?.length > 0)
      .map(cat => ({ category: cat, items: groups[cat] }));
  }, [unchecked]);

  const loadItems = useCallback(async () => {
    if (!activeListId) return;
    const { data } = await supabase
      .from('shopping_items')
      .select('*')
      .eq('list_id', activeListId)
      .order('checked', { ascending: true })
      .order('sort_order', { ascending: true });
    if (data) setItems(data);
  }, [activeListId]);

  useEffect(() => {
    loadItems();

    // Realtime subscription
    if (!activeListId) return;
    const channel = supabase
      .channel(`shopping_items:${activeListId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'shopping_items',
        filter: `list_id=eq.${activeListId}`,
      }, () => loadItems())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeListId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadItems();
    setRefreshing(false);
  };

  const handleAdd = async (name: string, quantity: string, category: string, brand?: string) => {
    if (!activeListId) return;
    await addItem(activeListId, name, quantity || undefined, category, undefined, brand);
    setShowModal(false);
    hapticNotification(Haptics.NotificationFeedbackType.Success);
  };

  const handleScanAdd = async (name: string, brand?: string) => {
    if (!activeListId) return;
    const cat = categoryForItem(name) || 'Lebensmittel';
    await addItem(activeListId, name, undefined, cat, undefined, brand);
    hapticNotification(Haptics.NotificationFeedbackType.Success);
  };

  const handleRecipeAdd = async (ingredients: RecipeIngredient[], recipeName: string, opts: RecipeAddOpts) => {
    const { added, planned } = await saveRecipe(ingredients, recipeName, opts);
    hapticNotification(Haptics.NotificationFeedbackType.Success);
    const parts = [];
    if (added > 0) parts.push(`${added} Zutaten im Einkauf`);
    if (planned) parts.push('im Kalender eingetragen');
    Alert.alert('✓ Fertig', `"${recipeName}" – ${parts.join(' & ') || 'gespeichert'}.`);
  };

  const handleClearChecked = () => {
    Alert.alert('Erledigte löschen', `${checked.length} abgehakte Artikel entfernen?`, [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Löschen', style: 'destructive', onPress: () => checked.forEach(i => deleteItem(i.id)) }
    ]);
  };

  // Progress bar animation
  const progressAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(progressAnim, { toValue: progress, duration: 400, useNativeDriver: false }).start();
  }, [progress]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>{activeList?.emoji ?? '🛒'} {activeList?.name ?? 'Einkaufsliste'}</Text>
          <Text style={styles.headerSub}>
            {household?.name ?? 'Mein Haushalt'}
          </Text>
        </View>
        <TouchableOpacity style={styles.listSwitchBtn} onPress={() => setShowListPicker(true)}>
          <Text style={styles.listSwitchText}>Listen ▾</Text>
        </TouchableOpacity>
      </View>

      {/* Tile Grid */}
      <ScrollView
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Progress */}
        {items.length > 0 && (
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <Animated.View style={[styles.progressFill, {
                width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] })
              }]} />
            </View>
            <Text style={styles.progressText}>{checked.length} von {items.length} erledigt</Text>
          </View>
        )}

        {/* Category groups */}
        {groupedItems.map(({ category, items: catItems }) => (
          <View key={category}>
            <View style={styles.catHeader}>
              <Text style={styles.catHeaderEmoji}>{CATEGORY_EMOJIS[category] || '🛒'}</Text>
              <Text style={styles.catHeaderText}>{category.toUpperCase()}</Text>
              <Text style={styles.catHeaderCount}>{catItems.length}</Text>
            </View>
            <View style={styles.tileGrid}>
              {catItems.map(item => (
                <TileItem key={item.id} item={item} onToggle={toggleItem} onDelete={deleteItem} />
              ))}
            </View>
          </View>
        ))}

        {/* Empty state */}
        {items.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🛒</Text>
            <Text style={styles.emptyTitle}>Liste ist leer</Text>
            <Text style={styles.emptyBody}>Füge deinen ersten Artikel hinzu.</Text>
          </View>
        )}

        {/* Checked items */}
        {checked.length > 0 && (
          <View style={styles.checkedSection}>
            <View style={styles.checkedHeader}>
              <TouchableOpacity onPress={() => setShowChecked(v => !v)} style={styles.checkedToggle}>
                <Text style={styles.checkedHeaderText}>✓ Erledigt ({checked.length})</Text>
                <Text style={styles.checkedToggleIcon}>{showChecked ? '▲' : '▼'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleClearChecked}>
                <Text style={styles.clearCheckedText}>Löschen</Text>
              </TouchableOpacity>
            </View>
            {showChecked && (
              <View style={styles.tileGrid}>
                {checked.map(item => (
                  <TileItem key={item.id} item={item} onToggle={toggleItem} onDelete={deleteItem} />
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* FABs */}
      <View style={styles.fabGroup}>
        <TouchableOpacity style={styles.fabScan} onPress={() => setShowScanner(true)} activeOpacity={0.85}>
          <Text style={styles.fabScanIcon}>📷</Text>
        </TouchableOpacity>
        {isPremium && (
          <TouchableOpacity style={styles.fabRecipe} onPress={() => setShowRecipeModal(true)} activeOpacity={0.85}>
            <Text style={styles.fabRecipeIcon}>🍳</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.fab} onPress={() => setShowModal(true)} activeOpacity={0.85}>
          <Text style={styles.fabIcon}>+</Text>
        </TouchableOpacity>
      </View>

      <AddItemModal visible={showModal} onClose={() => setShowModal(false)} onAdd={handleAdd} supermarket={supermarketKey(activeList?.name) ? (activeList?.name ?? null) : null} />
      <RecipeImportModal visible={showRecipeModal} onClose={() => setShowRecipeModal(false)} onAdd={handleRecipeAdd} />
      <ListPickerModal visible={showListPicker} onClose={() => setShowListPicker(false)} />
      <ProductScanner visible={showScanner} onClose={() => setShowScanner(false)} onAddToList={handleScanAdd} />
    </SafeAreaView>
  );
}

function makeStyles(colors: ColorPalette) { return StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerTitle: { ...typography.h2, color: colors.text },
  headerSub: { ...typography.sm, color: colors.textSecondary, marginTop: 2 },
  listSwitchBtn: {
    backgroundColor: colors.brandPale, paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm, borderRadius: radius.full,
  },
  listSwitchText: { ...typography.sm, color: colors.brand, fontWeight: '600' },

  progressContainer: {
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
  },
  progressBar: {
    height: 6, backgroundColor: colors.border, borderRadius: radius.full, overflow: 'hidden',
  },
  progressFill: {
    height: '100%', backgroundColor: colors.brand, borderRadius: radius.full,
  },
  progressText: {
    ...typography.xs, color: colors.textSecondary, marginTop: spacing.xs, textAlign: 'right',
  },

  listContent: { paddingBottom: 100, paddingHorizontal: spacing.md },

  sectionLabel: {
    ...typography.label, color: colors.textMuted,
    marginHorizontal: spacing.sm, marginTop: spacing.md, marginBottom: spacing.sm,
  },

  itemCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: radius.md,
    marginBottom: spacing.sm, padding: spacing.md,
    ...shadow.sm,
  },
  itemCheckbox: { marginRight: spacing.md },
  checkbox: {
    width: 26, height: 26, borderRadius: radius.full,
    borderWidth: 2, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: colors.brand, borderColor: colors.brand },
  checkmark: { color: colors.textInverse, fontSize: 14, fontWeight: '700' },
  itemContent: { flex: 1 },
  itemName: { ...typography.body, color: colors.text, fontWeight: '500' },
  itemNameChecked: { textDecorationLine: 'line-through', color: colors.textMuted },
  itemMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  itemQuantity: { ...typography.xs, color: colors.textSecondary, marginRight: spacing.sm },
  itemBrand: { ...typography.xs, color: colors.brand, fontWeight: '700', marginRight: spacing.sm },
  categoryDot: { width: 6, height: 6, borderRadius: 3, marginRight: 4 },
  itemCategory: { ...typography.xs, fontWeight: '500' },
  deleteBtn: { padding: spacing.sm },
  deleteBtnText: { fontSize: 22, color: colors.textMuted, lineHeight: 22 },

  checkedHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginHorizontal: spacing.sm, marginTop: spacing.md, marginBottom: spacing.sm,
  },
  checkedToggle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  checkedHeaderText: { ...typography.label, color: colors.textSecondary },
  checkedToggleIcon: { ...typography.xs, color: colors.textMuted },
  clearCheckedText: { ...typography.sm, color: colors.error, fontWeight: '600' },

  empty: { alignItems: 'center', paddingTop: 80 },
  emptyEmoji: { fontSize: 56, marginBottom: spacing.md },
  emptyTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.sm },
  emptyBody: { ...typography.body, color: colors.textSecondary },

  fabGroup: { position: 'absolute', right: spacing.lg, bottom: spacing.xl, flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  fab: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center',
    ...shadow.lg,
  },
  fabIcon: { color: colors.textInverse, fontSize: 28, lineHeight: 30, fontWeight: '300' },
  fabRecipe: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center',
    ...shadow.md,
  },
  fabRecipeIcon: { fontSize: 22 },
  fabScan: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: colors.border,
    ...shadow.md,
  },
  fabScanIcon: { fontSize: 22 },

  // Recipe Modal
  recipeTabRow: { flexDirection: 'row', marginBottom: spacing.md, gap: spacing.sm },
  recipeTab: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center' },
  recipeTabActive: { borderColor: colors.brand, backgroundColor: colors.brandPale },
  recipeTabText: { ...typography.sm, color: colors.textSecondary, fontWeight: '600' },
  recipeTabTextActive: { color: colors.brand },
  ingredientHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  toggleAllText: { ...typography.sm, color: colors.brand, fontWeight: '600' },
  ingredientRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, gap: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  ingredientName: { flex: 1, ...typography.body, color: colors.text },
  ingredientQty: { ...typography.sm, color: colors.textSecondary },
  planToggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg, marginBottom: spacing.md },
  planToggleText: { ...typography.body, color: colors.text, fontWeight: '500' },
  planSection: { backgroundColor: colors.background, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  categoryChipActive: { borderColor: colors.brand, backgroundColor: colors.brandPale },
  categoryChipTextActive: { color: colors.brand },
  mealTypeRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  mealTypeChip: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface },
  mealTypeChipActive: { borderColor: colors.brand, backgroundColor: colors.brandPale },
  mealTypeText: { ...typography.sm, color: colors.textSecondary, fontWeight: '600' },
  mealTypeTextActive: { color: colors.brand },

  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: {
    backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: spacing.lg, paddingBottom: spacing.xxl,
  },
  modalHandle: {
    width: 40, height: 4, backgroundColor: colors.border,
    borderRadius: 2, alignSelf: 'center', marginBottom: spacing.lg,
  },
  modalTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.md },
  inputRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  suggestBox: { backgroundColor: colors.background, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md, overflow: 'hidden' },
  suggestRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  suggestName: { ...typography.body, color: colors.text, fontWeight: '600' },
  suggestCat: { ...typography.xs, color: colors.textMuted },
  freqWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  freqChip: { backgroundColor: colors.brandPale, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: 1, borderColor: colors.brand },
  freqChipText: { ...typography.sm, color: colors.brand, fontWeight: '700' },
  brandChip: { backgroundColor: colors.surface, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: 1.5, borderColor: colors.border },
  brandChipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  brandChipText: { ...typography.sm, color: colors.text, fontWeight: '600' },
  brandChipTextActive: { color: '#fff' },
  input: {
    backgroundColor: colors.background, borderRadius: radius.md,
    padding: spacing.md, ...typography.body, color: colors.text,
    borderWidth: 1, borderColor: colors.border,
  },
  inputFlex: { flex: 1 },
  inputQty: { width: 90 },
  categoryScroll: { marginBottom: spacing.lg },
  categoryChip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.border,
    marginRight: spacing.sm, backgroundColor: colors.surface,
  },
  categoryChipText: { ...typography.sm, color: colors.textSecondary, fontWeight: '600' },
  addBtn: {
    backgroundColor: colors.brand, borderRadius: radius.md,
    padding: spacing.md, alignItems: 'center',
  },
  addBtnDisabled: { opacity: 0.4 },
  addBtnText: { ...typography.body, color: colors.textInverse, fontWeight: '700' },

  // Bring! tile grid
  catHeader: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.sm, marginTop: spacing.md, marginBottom: spacing.sm,
  },
  catHeaderEmoji: { fontSize: 16 },
  catHeaderText: { ...typography.label, color: colors.textMuted, flex: 1 },
  catHeaderCount: { ...typography.xs, color: colors.textMuted, backgroundColor: colors.border, borderRadius: radius.full, paddingHorizontal: 7, paddingVertical: 2 },
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingHorizontal: spacing.sm },
  tile: {
    width: TILE_SIZE, height: 90, borderRadius: radius.md, borderWidth: 1.5,
    padding: spacing.sm, alignItems: 'center', justifyContent: 'center', position: 'relative',
  },
  tileCheckBadge: {
    position: 'absolute', top: 4, right: 4,
    width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center',
  },
  tileCheckMark: { color: colors.textInverse, fontSize: 10, fontWeight: '700' },
  tileEmoji: { fontSize: 22, marginBottom: 4 },
  tileName: { ...typography.xs, color: colors.text, fontWeight: '600', textAlign: 'center' },
  tileNameChecked: { textDecorationLine: 'line-through', color: colors.textMuted },
  tileBrand: { ...typography.xs, color: colors.brand, fontWeight: '700', marginTop: 1, textAlign: 'center' },
  tileQty: { ...typography.xs, color: colors.textSecondary, marginTop: 2 },
  checkedSection: { marginTop: spacing.md },

  // List picker
  listRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  listRowActive: { backgroundColor: colors.brandPale, marginHorizontal: -spacing.lg, paddingHorizontal: spacing.lg, borderRadius: radius.md },
  listRowEmoji: { fontSize: 22, marginRight: spacing.md },
  listRowName: { flex: 1, ...typography.body, color: colors.text },
  listRowNameActive: { color: colors.brand, fontWeight: '700' },
  listRowCheck: { fontSize: 16, color: colors.brand, fontWeight: '700' },
  listRowDelete: { fontSize: 18, paddingLeft: spacing.sm },
  supermarketSection: { marginTop: spacing.md },
  supermarketLabel: { ...typography.xs, color: colors.textMuted, marginBottom: spacing.xs, textTransform: 'uppercase', letterSpacing: 0.5 },
  supermarketChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  supermarketChipActive: { borderColor: colors.brand, backgroundColor: colors.brandPale },
  supermarketChipEmoji: { fontSize: 16 },
  supermarketChipName: { ...typography.sm, color: colors.text, fontWeight: '600' },
  supermarketChipNameActive: { color: colors.brand },
  newListBtn: {
    marginTop: spacing.md, borderWidth: 1.5, borderColor: colors.brand,
    borderRadius: radius.md, padding: spacing.md, alignItems: 'center',
    borderStyle: 'dashed',
  },
  newListBtnText: { ...typography.body, color: colors.brand, fontWeight: '600' },
  createBox: { marginTop: spacing.md },
  emojiChip: {
    width: 42, height: 42, borderRadius: radius.md, borderWidth: 1.5,
    borderColor: colors.border, alignItems: 'center', justifyContent: 'center',
  },
  emojiChipActive: { borderColor: colors.brand, backgroundColor: colors.brandPale },
  emojiChipText: { fontSize: 20 },
}); }
