// app/(tabs)/recipes.tsx
import React, { useCallback, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Platform,
  Linking, Modal, Pressable, ScrollView,
} from 'react-native';
import { Alert } from '../../lib/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { colors, spacing, radius, typography, shadow, type ColorPalette } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { Recipe, MealType } from '../../lib/supabase';
import { useStore } from '../../store/useStore';
import RecipeImportModal, { RecipeAddOpts } from '../../components/RecipeImportModal';
import ThemeMotif from '../../components/ThemeMotif';
import { format, addDays } from 'date-fns';
import { de } from 'date-fns/locale';

const hapticNotification = (type: Haptics.NotificationFeedbackType) => { if (Platform.OS !== 'web') Haptics.notificationAsync(type); };
const MEAL_LABELS: Record<MealType, string> = { fruehstueck: '🌅 Frühstück', mittag: '☀️ Mittagessen', abendessen: '🌙 Abendessen' };

const RECIPE_CATEGORIES: { key: string; emoji: string }[] = [
  { key: 'Hauptgericht', emoji: '🍝' },
  { key: 'Backen & Dessert', emoji: '🧁' },
  { key: 'Frühstück', emoji: '🌅' },
  { key: 'Salat & Beilage', emoji: '🥗' },
  { key: 'Suppe', emoji: '🍲' },
  { key: 'Snack', emoji: '🍿' },
  { key: 'Getränk', emoji: '🥤' },
  { key: 'Sonstiges', emoji: '🍽️' },
];
const RECIPE_CAT_EMOJI: Record<string, string> = Object.fromEntries(RECIPE_CATEGORIES.map(c => [c.key, c.emoji]));

// ─── CATEGORY PICKER ──────────────────────────────────────────
function CategoryModal({ recipe, onClose, onPick }: {
  recipe: Recipe | null;
  onClose: () => void;
  onPick: (category: string | null) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <Modal visible={!!recipe} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.modalTitle}>📁 Kategorie für „{recipe?.name}"</Text>
          <View style={styles.catGrid}>
            {RECIPE_CATEGORIES.map(c => {
              const active = recipe?.category === c.key;
              return (
                <TouchableOpacity
                  key={c.key}
                  style={[styles.catOption, active && styles.chipActive]}
                  onPress={() => onPick(c.key)}
                >
                  <Text style={styles.catOptionEmoji}>{c.emoji}</Text>
                  <Text style={[styles.catOptionText, active && styles.chipTextActive]}>{c.key}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {recipe?.category && (
            <TouchableOpacity style={styles.closeBtn} onPress={() => onPick(null)}>
              <Text style={styles.closeBtnText}>Kategorie entfernen</Text>
            </TouchableOpacity>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── PLAN MODAL (schedule an existing recipe) ─────────────────
function PlanModal({ recipe, onClose, onConfirm }: {
  recipe: Recipe | null;
  onClose: () => void;
  onConfirm: (date: string, mealType: MealType, addToCart: boolean) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [mealType, setMealType] = useState<MealType>('abendessen');
  const [addToCart, setAddToCart] = useState(true);

  React.useEffect(() => {
    if (recipe) { setDate(format(new Date(), 'yyyy-MM-dd')); setMealType('abendessen'); setAddToCart(true); }
  }, [recipe]);

  const quickDates = Array.from({ length: 14 }, (_, i) => {
    const d = addDays(new Date(), i);
    return {
      label: i === 0 ? 'Heute' : i === 1 ? 'Morgen' : format(d, 'EEE dd.MM.', { locale: de }),
      value: format(d, 'yyyy-MM-dd'),
    };
  });

  return (
    <Modal visible={!!recipe} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.modalTitle}>📅 „{recipe?.name}" einplanen</Text>

          <Text style={styles.sectionLabel}>WANN</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
            {quickDates.map(d => (
              <TouchableOpacity key={d.value} style={[styles.chip, date === d.value && styles.chipActive]} onPress={() => setDate(d.value)}>
                <Text style={[styles.chipText, date === d.value && styles.chipTextActive]}>{d.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.sectionLabel}>MAHLZEIT</Text>
          <View style={styles.mealTypeRow}>
            {(Object.entries(MEAL_LABELS) as [MealType, string][]).map(([type, label]) => (
              <TouchableOpacity key={type} style={[styles.mealChip, mealType === type && styles.chipActive]} onPress={() => setMealType(type)}>
                <Text style={[styles.chipText, mealType === type && styles.chipTextActive]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.toggleRow} onPress={() => setAddToCart(v => !v)}>
            <View style={[styles.checkbox, addToCart && styles.checkboxChecked]}>{addToCart && <Text style={styles.checkmark}>✓</Text>}</View>
            <Text style={styles.toggleText}>Zutaten zum Einkaufskorb hinzufügen</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.primaryBtn} onPress={() => onConfirm(date, mealType, addToCart)}>
            <Text style={styles.primaryBtnText}>Einplanen ✓</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>Abbrechen</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── MAIN SCREEN ──────────────────────────────────────────────
export default function RecipesScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { household, recipes, items, loadRecipes, toggleRecipeFavorite, setRecipeCategory, deleteRecipe, saveRecipe, planRecipe, removeRecipeIngredientsFromCart } = useStore();
  const [showImport, setShowImport] = useState(false);
  const [planTarget, setPlanTarget] = useState<Recipe | null>(null);
  const [catTarget, setCatTarget] = useState<Recipe | null>(null);
  const [filter, setFilter] = useState<string | null>(null);

  const visibleRecipes = useMemo(
    () => (filter ? recipes.filter(r => r.category === filter) : recipes),
    [recipes, filter],
  );
  // Only show category chips that actually have recipes, so the bar stays tidy.
  const usedCategories = useMemo(
    () => RECIPE_CATEGORIES.filter(c => recipes.some(r => r.category === c.key)),
    [recipes],
  );

  useFocusEffect(useCallback(() => { loadRecipes(); }, [household?.id]));

  const handleImportAdd = async (ingredients: any, recipeName: string, opts: RecipeAddOpts) => {
    const { added, planned } = await saveRecipe(ingredients, recipeName, opts);
    hapticNotification(Haptics.NotificationFeedbackType.Success);
    const parts = [];
    if (added > 0) parts.push(`${added} Zutaten im Einkauf`);
    if (planned) parts.push('im Kalender');
    Alert.alert('✓ Gespeichert', `"${recipeName}"${parts.length ? ' – ' + parts.join(' & ') : ''}.`);
  };

  const handlePlanConfirm = async (date: string, mealType: MealType, addToCart: boolean) => {
    if (!planTarget) return;
    const { added } = await planRecipe(planTarget, { date, mealType, addToCart });
    setPlanTarget(null);
    hapticNotification(Haptics.NotificationFeedbackType.Success);
    Alert.alert('✓ Eingeplant', `"${planTarget.name}" für ${format(new Date(date), 'EEEE, d. MMM', { locale: de })}${added ? ` – ${added} Zutaten im Einkauf` : ''}.`);
  };

  const handlePickCategory = async (category: string | null) => {
    if (catTarget) await setRecipeCategory(catTarget.id, category);
    setCatTarget(null);
  };

  const confirmDelete = (recipe: Recipe) => {
    Alert.alert('Rezept löschen?', `"${recipe.name}" dauerhaft entfernen?`, [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Löschen', style: 'destructive', onPress: () => deleteRecipe(recipe.id) },
    ]);
  };

  // "Doch nicht kochen" — pull this recipe's not-yet-bought ingredients back out of the cart.
  const confirmRemoveFromCart = (recipe: Recipe, count: number) => {
    Alert.alert(
      'Zutaten aus dem Einkauf entfernen?',
      `${count} Zutat${count === 1 ? '' : 'en'} von "${recipe.name}" aus dem Einkaufskorb entfernen? Bereits abgehakte Artikel bleiben erhalten.`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Entfernen', style: 'destructive', onPress: async () => {
            const removed = await removeRecipeIngredientsFromCart(recipe.id);
            hapticNotification(Haptics.NotificationFeedbackType.Success);
            if (removed > 0) Alert.alert('✓ Entfernt', `${removed} Zutat${removed === 1 ? '' : 'en'} aus dem Einkaufskorb entfernt.`);
          }
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: Recipe }) => {
    const count = (item.ingredients || []).length;
    const cartCount = items.filter(i => i.recipe_id === item.id && !i.checked).length;
    return (
      <View style={styles.card}>
        <TouchableOpacity onPress={() => toggleRecipeFavorite(item.id)} style={styles.favBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.favIcon}>{item.is_favorite ? '⭐' : '☆'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cardBody} onPress={() => setPlanTarget(item)} activeOpacity={0.7}>
          <Text style={styles.cardName}>{item.name}</Text>
          <Text style={styles.cardMeta}>
            {item.category ? `${RECIPE_CAT_EMOJI[item.category] ?? '📁'} ${item.category} · ` : ''}{count} Zutaten{item.source_url ? ' · 🔗 Link' : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn} onPress={() => setCatTarget(item)}>
          <Text style={styles.iconBtnText}>🏷️</Text>
        </TouchableOpacity>
        {item.source_url && (
          <TouchableOpacity style={styles.iconBtn} onPress={() => Linking.openURL(item.source_url!)}>
            <Text style={styles.iconBtnText}>🔗</Text>
          </TouchableOpacity>
        )}
        {cartCount > 0 && (
          <TouchableOpacity style={styles.iconBtn} onPress={() => confirmRemoveFromCart(item, cartCount)}>
            <Text style={styles.iconBtnText}>🛒✕</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.iconBtn} onPress={() => setPlanTarget(item)}>
          <Text style={styles.iconBtnText}>📅</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn} onPress={() => confirmDelete(item)}>
          <Text style={[styles.iconBtnText, { color: colors.textMuted }]}>✕</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Text style={styles.headerTitle}>🍳 Rezepte</Text>
            <ThemeMotif />
          </View>
          <Text style={styles.headerSub}>{recipes.length} gespeichert</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowImport(true)}>
          <Text style={styles.addBtnText}>+ Rezept</Text>
        </TouchableOpacity>
      </View>

      {recipes.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>🍽️</Text>
          <Text style={styles.emptyTitle}>Noch keine Rezepte</Text>
          <Text style={styles.emptyText}>Tippe auf „+ Rezept", um dein erstes Rezept per Link oder Text zu speichern.</Text>
        </View>
      ) : (
        <>
          {usedCategories.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={{ paddingHorizontal: spacing.md, gap: spacing.sm }}>
              <TouchableOpacity style={[styles.filterChip, !filter && styles.chipActive]} onPress={() => setFilter(null)}>
                <Text style={[styles.chipText, !filter && styles.chipTextActive]}>Alle</Text>
              </TouchableOpacity>
              {usedCategories.map(c => (
                <TouchableOpacity key={c.key} style={[styles.filterChip, filter === c.key && styles.chipActive]} onPress={() => setFilter(filter === c.key ? null : c.key)}>
                  <Text style={[styles.chipText, filter === c.key && styles.chipTextActive]}>{c.emoji} {c.key}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
          <FlatList
            data={visibleRecipes}
            keyExtractor={r => r.id}
            renderItem={renderItem}
            contentContainerStyle={{ padding: spacing.md }}
          />
        </>
      )}

      <RecipeImportModal visible={showImport} onClose={() => setShowImport(false)} onAdd={handleImportAdd} />
      <PlanModal recipe={planTarget} onClose={() => setPlanTarget(null)} onConfirm={handlePlanConfirm} />
      <CategoryModal recipe={catTarget} onClose={() => setCatTarget(null)} onPick={handlePickCategory} />
    </SafeAreaView>
  );
}

function makeStyles(colors: ColorPalette) { return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerTitle: { ...typography.h2, color: colors.text },
  headerSub: { ...typography.sm, color: colors.textSecondary, marginTop: 2 },
  addBtn: { backgroundColor: colors.brand, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  addBtnText: { ...typography.sm, color: '#fff', fontWeight: '700' },

  filterScroll: { maxHeight: 48, paddingVertical: spacing.sm, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  filterChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface, justifyContent: 'center' },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  catOption: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface },
  catOptionEmoji: { fontSize: 16 },
  catOptionText: { ...typography.sm, color: colors.text, fontWeight: '600' },

  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.md, marginBottom: spacing.sm, ...shadow.sm,
  },
  favBtn: { paddingRight: spacing.sm },
  favIcon: { fontSize: 22 },
  cardBody: { flex: 1 },
  cardName: { ...typography.body, color: colors.text, fontWeight: '700' },
  cardMeta: { ...typography.xs, color: colors.textSecondary, marginTop: 2 },
  iconBtn: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  iconBtnText: { fontSize: 18 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  emptyEmoji: { fontSize: 56, marginBottom: spacing.md },
  emptyTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.sm },
  emptyText: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },

  // Modal
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingBottom: spacing.xxl },
  handle: { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.lg },
  modalTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.lg },
  sectionLabel: { ...typography.xs, color: colors.textMuted, fontWeight: '700', letterSpacing: 0.5, marginBottom: spacing.sm },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.border, marginRight: spacing.sm, backgroundColor: colors.surface },
  chipActive: { borderColor: colors.brand, backgroundColor: colors.brandPale },
  chipText: { ...typography.sm, color: colors.textSecondary, fontWeight: '600' },
  chipTextActive: { color: colors.brand },
  mealTypeRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', marginBottom: spacing.md },
  mealChip: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginVertical: spacing.md },
  toggleText: { ...typography.body, color: colors.text, fontWeight: '500' },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: colors.brand, borderColor: colors.brand },
  checkmark: { color: '#fff', fontSize: 14, fontWeight: '800' },
  primaryBtn: { backgroundColor: colors.brand, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', marginTop: spacing.sm },
  primaryBtnText: { ...typography.body, color: colors.textInverse, fontWeight: '700' },
  closeBtn: { padding: spacing.md, alignItems: 'center' },
  closeBtnText: { ...typography.body, color: colors.textSecondary },
}); }
