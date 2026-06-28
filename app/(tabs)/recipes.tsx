// app/(tabs)/recipes.tsx
import React, { useCallback, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Platform,
  Alert, Linking, Modal, Pressable, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { colors, spacing, radius, typography, shadow, type ColorPalette } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { Recipe, MealType } from '../../lib/supabase';
import { useStore } from '../../store/useStore';
import RecipeImportModal, { RecipeAddOpts } from '../../components/RecipeImportModal';
import { format, addDays } from 'date-fns';
import { de } from 'date-fns/locale';

const hapticNotification = (type: Haptics.NotificationFeedbackType) => { if (Platform.OS !== 'web') Haptics.notificationAsync(type); };
const MEAL_LABELS: Record<MealType, string> = { fruehstueck: '🌅 Frühstück', mittag: '☀️ Mittagessen', abendessen: '🌙 Abendessen' };

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

  const quickDates = [
    { label: 'Heute', value: format(new Date(), 'yyyy-MM-dd') },
    { label: 'Morgen', value: format(addDays(new Date(), 1), 'yyyy-MM-dd') },
    { label: format(addDays(new Date(), 2), 'EEE', { locale: de }), value: format(addDays(new Date(), 2), 'yyyy-MM-dd') },
    { label: format(addDays(new Date(), 3), 'EEE', { locale: de }), value: format(addDays(new Date(), 3), 'yyyy-MM-dd') },
  ];

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
  const { household, recipes, loadRecipes, toggleRecipeFavorite, deleteRecipe, saveRecipe, planRecipe } = useStore();
  const [showImport, setShowImport] = useState(false);
  const [planTarget, setPlanTarget] = useState<Recipe | null>(null);
  const isPremium = household?.plan_tier !== 'free';

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

  const confirmDelete = (recipe: Recipe) => {
    Alert.alert('Rezept löschen?', `"${recipe.name}" dauerhaft entfernen?`, [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Löschen', style: 'destructive', onPress: () => deleteRecipe(recipe.id) },
    ]);
  };

  const renderItem = ({ item }: { item: Recipe }) => {
    const count = (item.ingredients || []).length;
    return (
      <View style={styles.card}>
        <TouchableOpacity onPress={() => toggleRecipeFavorite(item.id)} style={styles.favBtn}>
          <Text style={styles.favIcon}>{item.is_favorite ? '⭐' : '☆'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cardBody} onPress={() => setPlanTarget(item)} activeOpacity={0.7}>
          <Text style={styles.cardName}>{item.name}</Text>
          <Text style={styles.cardMeta}>
            {count} Zutaten{item.source_url ? ' · 🔗 Link' : ''}
          </Text>
        </TouchableOpacity>
        {item.source_url && (
          <TouchableOpacity style={styles.iconBtn} onPress={() => Linking.openURL(item.source_url!)}>
            <Text style={styles.iconBtnText}>🔗</Text>
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
          <Text style={styles.headerTitle}>🍳 Rezepte</Text>
          <Text style={styles.headerSub}>{recipes.length} gespeichert</Text>
        </View>
        {isPremium && (
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowImport(true)}>
            <Text style={styles.addBtnText}>+ Rezept</Text>
          </TouchableOpacity>
        )}
      </View>

      {!isPremium ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>🔒</Text>
          <Text style={styles.emptyTitle}>Premium-Feature</Text>
          <Text style={styles.emptyText}>Rezepte verwalten ist im Premium-Plan verfügbar.</Text>
        </View>
      ) : recipes.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>🍽️</Text>
          <Text style={styles.emptyTitle}>Noch keine Rezepte</Text>
          <Text style={styles.emptyText}>Tippe auf „+ Rezept", um dein erstes Rezept per Link oder Text zu speichern.</Text>
        </View>
      ) : (
        <FlatList
          data={recipes}
          keyExtractor={r => r.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: spacing.md }}
        />
      )}

      <RecipeImportModal visible={showImport} onClose={() => setShowImport(false)} onAdd={handleImportAdd} />
      <PlanModal recipe={planTarget} onClose={() => setPlanTarget(null)} onConfirm={handlePlanConfirm} />
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
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, paddingBottom: spacing.xxl },
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
