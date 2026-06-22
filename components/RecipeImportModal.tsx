// components/RecipeImportModal.tsx
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Modal, Pressable, ScrollView, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { colors, spacing, radius, typography } from '../constants/theme';
import { supabase, RecipeIngredient, MealType } from '../lib/supabase';
import { format, addDays } from 'date-fns';
import { de } from 'date-fns/locale';

const MEAL_LABELS: Record<MealType, string> = { fruehstueck: '🌅 Frühstück', mittag: '☀️ Mittagessen', abendessen: '🌙 Abendessen' };

export interface RecipeAddOpts { sourceUrl?: string; date?: string; mealType?: MealType; addToCart: boolean }

export default function RecipeImportModal({ visible, onClose, onAdd }: {
  visible: boolean;
  onClose: () => void;
  onAdd: (ingredients: RecipeIngredient[], recipeName: string, opts: RecipeAddOpts) => void;
}) {
  const [inputMode, setInputMode] = useState<'url' | 'text'>('url');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'input' | 'review'>('input');
  const [recipeName, setRecipeName] = useState('');
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([]);
  const [planDate, setPlanDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [mealType, setMealType] = useState<MealType>('abendessen');
  const [planEnabled, setPlanEnabled] = useState(false);
  const [addToCart, setAddToCart] = useState(true);

  const reset = () => {
    setStep('input'); setInput(''); setIngredients([]); setRecipeName('');
    setPlanDate(format(new Date(), 'yyyy-MM-dd')); setPlanEnabled(false); setAddToCart(true);
  };

  useEffect(() => { if (!visible) reset(); }, [visible]);

  const handleExtract = async () => {
    if (!input.trim()) return;
    setLoading(true);
    try {
      const body = inputMode === 'url' ? { url: input.trim() } : { text: input.trim() };
      const { data, error } = await supabase.functions.invoke('extract-recipe', { body });
      if (error) throw error;
      setRecipeName(data.name || 'Rezept');
      // Pre-select ALL ingredients (incl. basics like salt/pepper) — user can deselect
      setIngredients((data.ingredients || []).map((i: RecipeIngredient) => ({ ...i, include: true })));
      setStep('review');
    } catch (e) {
      Alert.alert('Fehler', 'Zutaten konnten nicht extrahiert werden. Bitte prüfe den Link oder den Text.');
    } finally {
      setLoading(false);
    }
  };

  const toggleIngredient = (idx: number) =>
    setIngredients(prev => prev.map((ing, i) => i === idx ? { ...ing, include: !ing.include } : ing));

  const toggleAll = () => {
    const allOn = ingredients.every(i => i.include);
    setIngredients(prev => prev.map(i => ({ ...i, include: !allOn })));
  };

  const handleAdd = () => {
    onAdd(ingredients, recipeName, {
      sourceUrl: inputMode === 'url' && input.trim() ? input.trim() : undefined,
      date: planEnabled && planDate ? planDate : undefined,
      mealType: planEnabled ? mealType : undefined,
      addToCart,
    });
    onClose();
  };

  const quickDates = [
    { label: 'Heute', value: format(new Date(), 'yyyy-MM-dd') },
    { label: 'Morgen', value: format(addDays(new Date(), 1), 'yyyy-MM-dd') },
    { label: format(addDays(new Date(), 2), 'EEE', { locale: de }), value: format(addDays(new Date(), 2), 'yyyy-MM-dd') },
    { label: format(addDays(new Date(), 3), 'EEE', { locale: de }), value: format(addDays(new Date(), 3), 'yyyy-MM-dd') },
  ];

  const selectedCount = ingredients.filter(i => i.include).length;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={[s.overlay, Platform.OS === 'web' && { justifyContent: 'flex-start' }]} onPress={onClose}>
          <Pressable style={[s.sheet, { maxHeight: Platform.OS === 'web' ? '100%' : '90%' }]}>
            <View style={s.handle} />
            <Text style={s.title}>🍳 Rezept importieren</Text>

            {step === 'input' ? (
              <>
                <View style={s.tabRow}>
                  {(['url', 'text'] as const).map(mode => (
                    <TouchableOpacity key={mode} style={[s.tab, inputMode === mode && s.tabActive]} onPress={() => setInputMode(mode)}>
                      <Text style={[s.tabText, inputMode === mode && s.tabTextActive]}>{mode === 'url' ? '🔗 Link' : '📝 Text'}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput
                  style={[s.input, inputMode === 'text' && { height: 120, textAlignVertical: 'top' }]}
                  placeholder={inputMode === 'url' ? 'https://www.chefkoch.de/rezepte/...' : 'Rezepttext hier einfügen...'}
                  placeholderTextColor={colors.textMuted}
                  value={input} onChangeText={setInput}
                  multiline={inputMode === 'text'} autoCapitalize="none" autoCorrect={false}
                />
                <TouchableOpacity style={[s.addBtn, (!input.trim() || loading) && s.addBtnDisabled]} onPress={handleExtract} disabled={!input.trim() || loading}>
                  <Text style={s.addBtnText}>{loading ? '⏳ Zutaten werden erkannt...' : 'Zutaten extrahieren →'}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                <TextInput style={[s.input, { marginBottom: spacing.md, fontWeight: '700' }]} value={recipeName} onChangeText={setRecipeName} placeholderTextColor={colors.textMuted} />

                <View style={s.ingHeader}>
                  <Text style={s.sectionLabel}>ZUTATEN ({selectedCount} ausgewählt)</Text>
                  <TouchableOpacity onPress={toggleAll}>
                    <Text style={s.toggleAll}>{ingredients.every(i => i.include) ? 'Alle abwählen' : 'Alle auswählen'}</Text>
                  </TouchableOpacity>
                </View>

                {ingredients.map((ing, idx) => (
                  <TouchableOpacity key={idx} style={s.ingRow} onPress={() => toggleIngredient(idx)}>
                    <View style={[s.checkbox, ing.include && s.checkboxChecked]}>{ing.include && <Text style={s.checkmark}>✓</Text>}</View>
                    <Text style={[s.ingName, !ing.include && { color: colors.textMuted, textDecorationLine: 'line-through' }]}>{ing.name}</Text>
                    {ing.quantity && <Text style={s.ingQty}>{ing.quantity}</Text>}
                  </TouchableOpacity>
                ))}

                <TouchableOpacity style={s.toggleRow} onPress={() => setAddToCart(v => !v)}>
                  <View style={[s.checkbox, addToCart && s.checkboxChecked]}>{addToCart && <Text style={s.checkmark}>✓</Text>}</View>
                  <Text style={s.toggleText}>Zutaten zum Einkaufskorb hinzufügen</Text>
                </TouchableOpacity>

                <TouchableOpacity style={s.toggleRow} onPress={() => setPlanEnabled(v => !v)}>
                  <View style={[s.checkbox, planEnabled && s.checkboxChecked]}>{planEnabled && <Text style={s.checkmark}>✓</Text>}</View>
                  <Text style={s.toggleText}>Als Mahlzeit im Kalender eintragen</Text>
                </TouchableOpacity>

                {planEnabled && (
                  <View style={s.planSection}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.sm }}>
                      {quickDates.map(d => (
                        <TouchableOpacity key={d.value} style={[s.chip, planDate === d.value && s.chipActive]} onPress={() => setPlanDate(d.value)}>
                          <Text style={[s.chipText, planDate === d.value && s.chipTextActive]}>{d.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                    <View style={s.mealTypeRow}>
                      {(Object.entries(MEAL_LABELS) as [MealType, string][]).map(([type, label]) => (
                        <TouchableOpacity key={type} style={[s.mealChip, mealType === type && s.chipActive]} onPress={() => setMealType(type)}>
                          <Text style={[s.chipText, mealType === type && s.chipTextActive]}>{label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                <TouchableOpacity
                  style={[s.addBtn, { marginTop: spacing.lg }, (!addToCart && !planEnabled) && s.addBtnDisabled]}
                  onPress={handleAdd} disabled={!addToCart && !planEnabled}
                >
                  <Text style={s.addBtnText}>
                    {addToCart ? `${selectedCount} Zutaten hinzufügen${planEnabled ? ' + Kalender' : ''} ✓` : planEnabled ? 'Nur in Kalender eintragen ✓' : 'Bitte Option wählen'}
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, paddingBottom: spacing.xxl },
  handle: { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.lg },
  title: { ...typography.h3, color: colors.text, marginBottom: spacing.md },
  tabRow: { flexDirection: 'row', marginBottom: spacing.md, gap: spacing.sm },
  tab: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center' },
  tabActive: { borderColor: colors.brand, backgroundColor: colors.brandPale },
  tabText: { ...typography.sm, color: colors.textSecondary, fontWeight: '600' },
  tabTextActive: { color: colors.brand },
  input: { backgroundColor: colors.background, borderRadius: radius.md, padding: spacing.md, ...typography.body, color: colors.text, borderWidth: 1, borderColor: colors.border },
  addBtn: { backgroundColor: colors.brand, borderRadius: radius.md, padding: spacing.md, alignItems: 'center' },
  addBtnDisabled: { opacity: 0.4 },
  addBtnText: { ...typography.body, color: colors.textInverse, fontWeight: '700' },
  ingHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  sectionLabel: { ...typography.xs, color: colors.textMuted, fontWeight: '700', letterSpacing: 0.5 },
  toggleAll: { ...typography.sm, color: colors.brand, fontWeight: '600' },
  ingRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, gap: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  ingName: { flex: 1, ...typography.body, color: colors.text },
  ingQty: { ...typography.sm, color: colors.textSecondary },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: colors.brand, borderColor: colors.brand },
  checkmark: { color: '#fff', fontSize: 14, fontWeight: '800' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  toggleText: { ...typography.body, color: colors.text, fontWeight: '500' },
  planSection: { backgroundColor: colors.background, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.sm },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.border, marginRight: spacing.sm, backgroundColor: colors.surface },
  chipActive: { borderColor: colors.brand, backgroundColor: colors.brandPale },
  chipText: { ...typography.sm, color: colors.textSecondary, fontWeight: '600' },
  chipTextActive: { color: colors.brand },
  mealTypeRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  mealChip: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface },
});
