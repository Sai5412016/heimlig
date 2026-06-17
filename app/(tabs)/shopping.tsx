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
import { supabase, ShoppingItem } from '../../lib/supabase';
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

// ─── MAIN SCREEN ──────────────────────────────────────────────
export default function ShoppingScreen() {
  const { household, currentMember, activeListId, items, setItems, toggleItem, addItem, deleteItem, shoppingLists } = useStore();
  const [showModal, setShowModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showChecked, setShowChecked] = useState(true);

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

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowModal(true)}
        activeOpacity={0.85}
      >
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>

      <AddItemModal visible={showModal} onClose={() => setShowModal(false)} onAdd={handleAdd} />
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

  fab: {
    position: 'absolute', right: spacing.lg, bottom: spacing.xl,
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center',
    ...shadow.lg,
  },
  fabIcon: { color: colors.textInverse, fontSize: 28, lineHeight: 30, fontWeight: '300' },

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
