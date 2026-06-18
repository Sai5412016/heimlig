// app/(tabs)/shopping.tsx
import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
  Animated, Platform, KeyboardAvoidingView, Alert, RefreshControl,
  Pressable, Modal, ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
const hapticImpact = (style: Haptics.ImpactFeedbackStyle) => { if (Platform.OS !== 'web') Haptics.impactAsync(style); };
const hapticNotification = (type: Haptics.NotificationFeedbackType) => { if (Platform.OS !== 'web') Haptics.notificationAsync(type); };
import { colors, spacing, radius, typography, shadow, SHOPPING_CATEGORIES, CATEGORY_COLORS } from '../../constants/theme';
import { supabase, ShoppingItem, RecipeIngredient, MealType } from '../../lib/supabase';
import { format, addDays } from 'date-fns';
import { de } from 'date-fns/locale';
import { useStore } from '../../store/useStore';

// ─── ITEM CARD ────────────────────────────────────────────────
const ItemCard = React.memo(({ item, onToggle, onDelete, memberName }: {
  item: ShoppingItem;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  memberName?: string;
}) => {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(item.checked ? 0.5 : 1)).current;

  const handleToggle = () => {
    hapticImpact(item.checked ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium);
    Animated.parallel([
      Animated.sequence([
        Animated.spring(scale, { toValue: 0.95, useNativeDriver: true, speed: 50 }),
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20 }),
      ]),
      Animated.timing(opacity, {
        toValue: item.checked ? 1 : 0.5,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
    onToggle(item.id);
  };

  const catColor = CATEGORY_COLORS[item.category] || colors.sonstiges;

  return (
    <Animated.View style={[styles.itemCard, { transform: [{ scale }], opacity }]}>
      <TouchableOpacity style={styles.itemCheckbox} onPress={handleToggle} activeOpacity={0.7}>
        <View style={[styles.checkbox, item.checked && styles.checkboxChecked]}>
          {item.checked && <Text style={styles.checkmark}>✓</Text>}
        </View>
      </TouchableOpacity>

      <View style={styles.itemContent}>
        <Text style={[styles.itemName, item.checked && styles.itemNameChecked]}>
          {item.name}
        </Text>
        <View style={styles.itemMeta}>
          {item.quantity && (
            <Text style={styles.itemQuantity}>{item.quantity}</Text>
          )}
          <View style={[styles.categoryDot, { backgroundColor: catColor }]} />
          <Text style={[styles.itemCategory, { color: catColor }]}>{item.category}</Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.deleteBtn}
        onPress={() => {
          hapticImpact(Haptics.ImpactFeedbackStyle.Light);
          onDelete(item.id);
        }}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={styles.deleteBtnText}>×</Text>
      </TouchableOpacity>
    </Animated.View>
  );
});

// ─── ADD ITEM MODAL ───────────────────────────────────────────
const AddItemModal = ({ visible, onClose, onAdd }: {
  visible: boolean;
  onClose: () => void;
  onAdd: (name: string, quantity: string, category: string) => void;
}) => {
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [category, setCategory] = useState('Lebensmittel');
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      setTimeout(() => inputRef.current?.focus(), 300);
    } else {
      setName(''); setQuantity(''); setCategory('Lebensmittel');
    }
  }, [visible]);

  const handleAdd = () => {
    if (!name.trim()) return;
    onAdd(name.trim(), quantity.trim(), category);
    setName(''); setQuantity('');
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
                onChangeText={setName}
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

// ─── RECIPE IMPORT MODAL ──────────────────────────────────────
const MEAL_LABELS: Record<MealType, string> = { fruehstueck: '🌅 Frühstück', mittag: '☀️ Mittagessen', abendessen: '🌙 Abendessen' };

const RecipeImportModal = ({ visible, onClose, onAdd }: {
  visible: boolean;
  onClose: () => void;
  onAdd: (ingredients: RecipeIngredient[], recipeName: string, date?: string, mealType?: MealType) => void;
}) => {
  const [inputMode, setInputMode] = useState<'url' | 'text'>('url');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'input' | 'review'>('input');
  const [recipeName, setRecipeName] = useState('');
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([]);
  const [planDate, setPlanDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [mealType, setMealType] = useState<MealType>('abendessen');
  const [planEnabled, setPlanEnabled] = useState(false);

  const reset = () => { setStep('input'); setInput(''); setIngredients([]); setRecipeName(''); setPlanDate(format(new Date(), 'yyyy-MM-dd')); setPlanEnabled(false); };

  useEffect(() => { if (!visible) reset(); }, [visible]);

  const handleExtract = async () => {
    if (!input.trim()) return;
    setLoading(true);
    try {
      const body = inputMode === 'url' ? { url: input.trim() } : { text: input.trim() };
      const { data, error } = await supabase.functions.invoke('extract-recipe', { body });
      if (error) throw error;
      setRecipeName(data.name || 'Rezept');
      setIngredients(data.ingredients || []);
      setStep('review');
    } catch (e) {
      Alert.alert('Fehler', 'Zutaten konnten nicht extrahiert werden. Bitte prüfe den Link oder den Text.');
    } finally {
      setLoading(false);
    }
  };

  const toggleIngredient = (idx: number) => {
    setIngredients(prev => prev.map((ing, i) => i === idx ? { ...ing, include: !ing.include } : ing));
  };

  const toggleAll = () => {
    const allOn = ingredients.every(i => i.include);
    setIngredients(prev => prev.map(i => ({ ...i, include: !allOn })));
  };

  const handleAdd = () => {
    onAdd(ingredients, recipeName, planEnabled && planDate ? planDate : undefined, planEnabled ? mealType : undefined);
    onClose();
  };

  const quickDates = [
    { label: 'Heute', value: format(new Date(), 'yyyy-MM-dd') },
    { label: 'Morgen', value: format(addDays(new Date(), 1), 'yyyy-MM-dd') },
    { label: format(addDays(new Date(), 2), 'EEE', { locale: de }), value: format(addDays(new Date(), 2), 'yyyy-MM-dd') },
    { label: format(addDays(new Date(), 3), 'EEE', { locale: de }), value: format(addDays(new Date(), 3), 'yyyy-MM-dd') },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={styles.modalOverlay} onPress={onClose}>
          <Pressable style={[styles.modalSheet, { maxHeight: '90%' }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>🍳 Rezept importieren</Text>

            {step === 'input' ? (
              <>
                {/* Mode Tabs */}
                <View style={styles.recipeTabRow}>
                  {(['url', 'text'] as const).map(mode => (
                    <TouchableOpacity key={mode} style={[styles.recipeTab, inputMode === mode && styles.recipeTabActive]} onPress={() => setInputMode(mode)}>
                      <Text style={[styles.recipeTabText, inputMode === mode && styles.recipeTabTextActive]}>
                        {mode === 'url' ? '🔗 Link' : '📝 Text'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TextInput
                  style={[styles.input, inputMode === 'text' && { height: 120, textAlignVertical: 'top' }]}
                  placeholder={inputMode === 'url' ? 'https://www.chefkoch.de/rezepte/...' : 'Rezepttext hier einfügen...'}
                  placeholderTextColor={colors.textMuted}
                  value={input}
                  onChangeText={setInput}
                  multiline={inputMode === 'text'}
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                <TouchableOpacity style={[styles.addBtn, (!input.trim() || loading) && styles.addBtnDisabled]} onPress={handleExtract} disabled={!input.trim() || loading}>
                  <Text style={styles.addBtnText}>{loading ? '⏳ Zutaten werden erkannt...' : 'Zutaten extrahieren →'}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Recipe Name */}
                <TextInput style={[styles.input, { marginBottom: spacing.md, fontWeight: '700' }]} value={recipeName} onChangeText={setRecipeName} placeholderTextColor={colors.textMuted} />

                {/* Ingredient List */}
                <View style={styles.ingredientHeader}>
                  <Text style={styles.sectionLabel}>ZUTATEN ({ingredients.filter(i => i.include).length} ausgewählt)</Text>
                  <TouchableOpacity onPress={toggleAll}>
                    <Text style={styles.toggleAllText}>{ingredients.every(i => i.include) ? 'Alle abwählen' : 'Alle auswählen'}</Text>
                  </TouchableOpacity>
                </View>

                {ingredients.map((ing, idx) => (
                  <TouchableOpacity key={idx} style={styles.ingredientRow} onPress={() => toggleIngredient(idx)}>
                    <View style={[styles.checkbox, ing.include && styles.checkboxChecked]}>
                      {ing.include && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                    <Text style={[styles.ingredientName, !ing.include && { color: colors.textMuted, textDecorationLine: 'line-through' }]}>{ing.name}</Text>
                    {ing.quantity && <Text style={styles.ingredientQty}>{ing.quantity}</Text>}
                  </TouchableOpacity>
                ))}

                {/* Meal Planning */}
                <TouchableOpacity style={styles.planToggleRow} onPress={() => setPlanEnabled(v => !v)}>
                  <View style={[styles.checkbox, planEnabled && styles.checkboxChecked]}>
                    {planEnabled && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <Text style={styles.planToggleText}>Als Mahlzeit im Kalender eintragen</Text>
                </TouchableOpacity>

                {planEnabled && (
                  <View style={styles.planSection}>
                    {/* Quick Date Chips */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.sm }}>
                      {quickDates.map(d => (
                        <TouchableOpacity key={d.value} style={[styles.categoryChip, planDate === d.value && styles.categoryChipActive]} onPress={() => setPlanDate(d.value)}>
                          <Text style={[styles.categoryChipText, planDate === d.value && styles.categoryChipTextActive]}>{d.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>

                    {/* Meal Type */}
                    <View style={styles.mealTypeRow}>
                      {(Object.entries(MEAL_LABELS) as [MealType, string][]).map(([type, label]) => (
                        <TouchableOpacity key={type} style={[styles.mealTypeChip, mealType === type && styles.mealTypeChipActive]} onPress={() => setMealType(type)}>
                          <Text style={[styles.mealTypeText, mealType === type && styles.mealTypeTextActive]}>{label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                <TouchableOpacity style={[styles.addBtn, { marginTop: spacing.lg }]} onPress={handleAdd} disabled={ingredients.filter(i => i.include).length === 0}>
                  <Text style={styles.addBtnText}>
                    {ingredients.filter(i => i.include).length} Zutaten zur Liste hinzufügen ✓
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ─── MAIN SCREEN ──────────────────────────────────────────────
export default function ShoppingScreen() {
  const { household, currentMember, activeListId, items, setItems, toggleItem, addItem, deleteItem, shoppingLists } = useStore();
  const [showModal, setShowModal] = useState(false);
  const [showRecipeModal, setShowRecipeModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showChecked, setShowChecked] = useState(true);
  const isPremium = household?.plan_tier !== 'free';

  const activeList = shoppingLists.find(l => l.id === activeListId);
  const unchecked = items.filter(i => !i.checked);
  const checked = items.filter(i => i.checked);
  const progress = items.length > 0 ? checked.length / items.length : 0;

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

  const handleAdd = async (name: string, quantity: string, category: string) => {
    if (!activeListId) return;
    await addItem(activeListId, name, quantity || undefined, category);
    setShowModal(false);
    hapticNotification(Haptics.NotificationFeedbackType.Success);
  };

  const handleRecipeAdd = async (ingredients: RecipeIngredient[], recipeName: string, date?: string, mealType?: MealType) => {
    if (!activeListId || !household || !currentMember) return;
    const toAdd = ingredients.filter(i => i.include);
    for (const ing of toAdd) {
      await addItem(activeListId, ing.name, ing.quantity, ing.category);
    }
    // Save recipe
    const { data: recipe } = await supabase.from('recipes').insert({
      household_id: household.id,
      name: recipeName,
      ingredients,
      created_by: currentMember.id,
    }).select().single();
    // Save meal plan if date selected
    if (date && mealType && recipe) {
      await supabase.from('meal_plans').insert({
        household_id: household.id,
        recipe_id: recipe.id,
        recipe_name: recipeName,
        planned_date: date,
        meal_type: mealType,
        created_by: currentMember.id,
      });
    }
    hapticNotification(Haptics.NotificationFeedbackType.Success);
    Alert.alert('✓ Fertig', `${toAdd.length} Zutaten aus "${recipeName}" wurden hinzugefügt.`);
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

  const renderItem = ({ item }: { item: ShoppingItem }) => (
    <ItemCard item={item} onToggle={toggleItem} onDelete={deleteItem} />
  );

  const ListHeader = () => (
    <View>
      {/* Progress */}
      {items.length > 0 && (
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <Animated.View style={[styles.progressFill, {
              width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] })
            }]} />
          </View>
          <Text style={styles.progressText}>
            {checked.length} von {items.length} erledigt
          </Text>
        </View>
      )}

      {unchecked.length > 0 && (
        <Text style={styles.sectionLabel}>ZU KAUFEN ({unchecked.length})</Text>
      )}
    </View>
  );

  const CheckedHeader = () => (
    checked.length > 0 ? (
      <View style={styles.checkedHeader}>
        <TouchableOpacity onPress={() => setShowChecked(v => !v)} style={styles.checkedToggle}>
          <Text style={styles.checkedHeaderText}>✓ Erledigt ({checked.length})</Text>
          <Text style={styles.checkedToggleIcon}>{showChecked ? '▲' : '▼'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleClearChecked}>
          <Text style={styles.clearCheckedText}>Löschen</Text>
        </TouchableOpacity>
      </View>
    ) : null
  );

  const listData = [
    ...unchecked,
    ...(showChecked ? checked : []),
  ];

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
        <TouchableOpacity style={styles.listSwitchBtn}>
          <Text style={styles.listSwitchText}>Listen ▾</Text>
        </TouchableOpacity>
      </View>

      {/* List */}
      <FlatList
        data={listData}
        keyExtractor={i => i.id}
        renderItem={renderItem}
        ListHeaderComponent={ListHeader}
        ListFooterComponent={<CheckedHeader />}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🛒</Text>
            <Text style={styles.emptyTitle}>Liste ist leer</Text>
            <Text style={styles.emptyBody}>Füge deinen ersten Artikel hinzu.</Text>
          </View>
        }
      />

      {/* FABs */}
      <View style={styles.fabGroup}>
        {isPremium && (
          <TouchableOpacity style={styles.fabRecipe} onPress={() => setShowRecipeModal(true)} activeOpacity={0.85}>
            <Text style={styles.fabRecipeIcon}>🍳</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.fab} onPress={() => setShowModal(true)} activeOpacity={0.85}>
          <Text style={styles.fabIcon}>+</Text>
        </TouchableOpacity>
      </View>

      <AddItemModal visible={showModal} onClose={() => setShowModal(false)} onAdd={handleAdd} />
      <RecipeImportModal visible={showRecipeModal} onClose={() => setShowRecipeModal(false)} onAdd={handleRecipeAdd} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
});
