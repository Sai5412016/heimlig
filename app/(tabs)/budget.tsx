// app/(tabs)/budget.tsx
import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Modal, Pressable, KeyboardAvoidingView, Platform, Alert, Animated
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
const hapticNotification = (type: Haptics.NotificationFeedbackType) => { if (Platform.OS !== 'web') Haptics.notificationAsync(type); };
import { format, subMonths, addMonths, addWeeks, addYears, parseISO, isSameMonth } from 'date-fns';

const TX_RECURRENCE_OPTIONS = [
  { key: null, label: 'Einmalig' },
  { key: 'weekly', label: 'Wöchentlich' },
  { key: 'monthly', label: 'Monatlich' },
  { key: 'yearly', label: 'Jährlich' },
];

// Advance a yyyy-MM-dd date string by N units
function advanceDate(dateStr: string, unit: string, n: number): string {
  const d = parseISO(dateStr);
  const next = unit === 'weekly' ? addWeeks(d, n) : unit === 'yearly' ? addYears(d, n) : addMonths(d, n);
  return format(next, 'yyyy-MM-dd');
}
import { de } from 'date-fns/locale';
import { colors, spacing, radius, typography, shadow, type ColorPalette } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { supabase, Transaction } from '../../lib/supabase';
import { useStore } from '../../store/useStore';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { buildTransactionsCsv, exportCsv, parseTransactionsCsv, memberIdByName } from '../../lib/dataIO';
import BudgetSplitModal from '../../components/BudgetSplitModal';

const CAT_EMOJIS: Record<string, string> = {
  'Lebensmittel': '🛒', 'Miete': '🏠', 'Transport': '🚗',
  'Freizeit': '🎮', 'Gesundheit': '💊', 'Kleidung': '👕',
  'Haushalt': '🔧', 'Kinder': '👶', 'Haustiere': '🐾',
  'Sparen': '💰', 'Restaurant': '🍽️', 'Urlaub': '✈️',
  'Elektronik': '💻', 'Sport': '🏃', 'Sonstiges': '📦',
};

const ALL_CATEGORIES = Object.keys(CAT_EMOJIS);

const CAT_COLORS: Record<string, string> = {
  'Lebensmittel': '#10B981', 'Miete': '#3B82F6', 'Transport': '#F59E0B',
  'Freizeit': '#8B5CF6', 'Gesundheit': '#EF4444', 'Kleidung': '#EC4899',
  'Haushalt': '#6B7280', 'Kinder': '#F97316', 'Haustiere': '#84CC16',
  'Sparen': '#14B8A6', 'Restaurant': '#F59E0B', 'Urlaub': '#06B6D4',
  'Elektronik': '#6366F1', 'Sport': '#22C55E', 'Sonstiges': '#9CA3AF',
};

const QUICK_PRESETS = [
  { label: '⛽ Tanken', cat: 'Transport', desc: 'Tanken' },
  { label: '🍽️ Restaurant', cat: 'Restaurant', desc: 'Essen auswärts' },
  { label: '🛒 Wocheneinkauf', cat: 'Lebensmittel', desc: 'Wocheneinkauf' },
  { label: '☕ Kaffee', cat: 'Freizeit', desc: 'Kaffee' },
  { label: '💊 Apotheke', cat: 'Gesundheit', desc: 'Apotheke' },
  { label: '👕 Kleidung', cat: 'Kleidung', desc: 'Kleidung' },
  { label: '🎬 Kino', cat: 'Freizeit', desc: 'Kino' },
  { label: '🐾 Tierarzt', cat: 'Haustiere', desc: 'Tierarzt' },
  { label: '🔧 Baumarkt', cat: 'Haushalt', desc: 'Baumarkt' },
  { label: '✈️ Urlaub', cat: 'Urlaub', desc: 'Urlaub' },
];

function AddTransactionModal({ visible, onClose, onSave, members, currentMemberId }: {
  visible: boolean; onClose: () => void; onSave: (tx: Partial<Transaction>) => void;
  members: any[]; currentMemberId: string;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Lebensmittel');
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [paidBy, setPaidBy] = useState<string>(currentMemberId);
  const [recurrence, setRecurrence] = useState<string | null>(null);
  const [recurrenceInterval, setRecurrenceInterval] = useState(1);

  useEffect(() => {
    if (!visible) {
      setAmount(''); setDescription(''); setCategory('Lebensmittel');
      setType('expense'); setDate(format(new Date(), 'yyyy-MM-dd'));
      setPaidBy(currentMemberId); setRecurrence(null); setRecurrenceInterval(1);
    }
  }, [visible, currentMemberId]);

  const handleSave = () => {
    const num = parseFloat(amount.replace(',', '.'));
    if (!num || isNaN(num)) return;
    onSave({
      amount: num, description: description.trim() || undefined, category, type,
      transaction_date: date, member_id: paidBy || undefined,
      recurrence: recurrence || undefined,
      recurrence_interval: recurrence ? recurrenceInterval : undefined,
      recurrence_next: recurrence ? advanceDate(date, recurrence, recurrenceInterval) : undefined,
    });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[{ width: '100%' }, Platform.OS === 'web' && { flex: 1 }]}>
          <Pressable style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={styles.typeToggle}>
                <TouchableOpacity style={[styles.typeBtn, type === 'expense' && styles.typeBtnExpense]} onPress={() => setType('expense')}>
                  <Text style={[styles.typeBtnText, type === 'expense' && { color: '#fff' }]}>- Ausgabe</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.typeBtn, type === 'income' && styles.typeBtnIncome]} onPress={() => setType('income')}>
                  <Text style={[styles.typeBtnText, type === 'income' && { color: '#fff' }]}>+ Einnahme</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.fieldLabel}>SCHNELLAUSWAHL</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
                {QUICK_PRESETS.map(p => (
                  <TouchableOpacity key={p.label} style={[styles.presetChip, category === p.cat && description === p.desc && { backgroundColor: colors.brand, borderColor: colors.brand }]} onPress={() => { setCategory(p.cat); setDescription(p.desc); }}>
                    <Text style={[styles.presetChipText, category === p.cat && description === p.desc && { color: '#fff' }]}>{p.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <View style={styles.amountRow}>
                <Text style={styles.currencySymbol}>€</Text>
                <TextInput style={styles.amountInput} placeholder="0,00" placeholderTextColor={colors.textMuted} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
              </View>
              <TextInput style={styles.input} placeholder="Beschreibung (optional)" placeholderTextColor={colors.textMuted} value={description} onChangeText={setDescription} />
              <TextInput style={styles.input} placeholder="Datum (JJJJ-MM-TT)" placeholderTextColor={colors.textMuted} value={date} onChangeText={setDate} />
              <Text style={styles.fieldLabel}>KATEGORIE</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
                {ALL_CATEGORIES.map(cat => {
                  const isActive = cat === category;
                  const catColor = CAT_COLORS[cat] || colors.brand;
                  return (
                    <TouchableOpacity key={cat} style={[styles.catChip, isActive && { backgroundColor: catColor, borderColor: catColor }]} onPress={() => setCategory(cat)}>
                      <Text style={styles.catChipEmoji}>{CAT_EMOJIS[cat]}</Text>
                      <Text style={[styles.catChipText, isActive && { color: '#fff' }]}>{cat}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <Text style={styles.fieldLabel}>BEZAHLT VON</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
                {members.map(m => (
                  <TouchableOpacity key={m.id} style={[styles.memberChip, paidBy === m.id && { backgroundColor: m.avatar_color, borderColor: m.avatar_color }]} onPress={() => setPaidBy(m.id)}>
                    <View style={[styles.memberChipAvatar, { backgroundColor: paidBy === m.id ? 'rgba(255,255,255,0.3)' : m.avatar_color }]}>
                      <Text style={styles.memberChipAvatarText}>{m.display_name[0]}</Text>
                    </View>
                    <Text style={[styles.memberChipText, paidBy === m.id && { color: '#fff' }]}>{m.display_name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Text style={styles.fieldLabel}>WIEDERKEHREND</Text>
              <View style={styles.recurrenceWrap}>
                {TX_RECURRENCE_OPTIONS.map(r => (
                  <TouchableOpacity key={String(r.key)} style={[styles.catChip, recurrence === r.key && { backgroundColor: colors.brand, borderColor: colors.brand }]} onPress={() => setRecurrence(r.key)}>
                    <Text style={[styles.catChipText, recurrence === r.key && { color: '#fff' }]}>{r.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {recurrence && (
                <View style={styles.intervalRow}>
                  <Text style={styles.intervalLabel}>Alle</Text>
                  <TouchableOpacity style={styles.intervalBtn} onPress={() => setRecurrenceInterval(n => Math.max(1, n - 1))}>
                    <Text style={styles.intervalBtnText}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.intervalValue}>{recurrenceInterval}</Text>
                  <TouchableOpacity style={styles.intervalBtn} onPress={() => setRecurrenceInterval(n => Math.min(99, n + 1))}>
                    <Text style={styles.intervalBtnText}>+</Text>
                  </TouchableOpacity>
                  <Text style={styles.intervalLabel}>
                    {recurrence === 'weekly' ? (recurrenceInterval === 1 ? 'Woche' : 'Wochen')
                      : recurrence === 'yearly' ? (recurrenceInterval === 1 ? 'Jahr' : 'Jahre')
                      : (recurrenceInterval === 1 ? 'Monat' : 'Monate')}
                  </Text>
                </View>
              )}

              <TouchableOpacity style={[styles.saveBtn, !amount && { opacity: 0.4 }]} onPress={handleSave} disabled={!amount}>
                <Text style={styles.saveBtnText}>{recurrence ? 'Wiederkehrend eintragen ✓' : 'Eintragen ✓'}</Text>
              </TouchableOpacity>
              <View style={{ height: 20 }} />
            </ScrollView>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

// ─── CATEGORY BAR with avatars ────────────────────────────────
function CategoryBar({ label, amount, total, color, emoji, members, transactions }: {
  label: string; amount: number; total: number; color: string; emoji: string;
  members: any[]; transactions: Transaction[];
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const progress = total > 0 ? Math.min(amount / total, 1) : 0;
  const animWidth = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(animWidth, { toValue: progress, duration: 600, useNativeDriver: false }).start();
  }, [progress]);

  // Who paid most in this category
  const catTx = transactions.filter(t => t.category === label && t.type === 'expense');
  const memberTotals = members.map(m => ({
    member: m,
    total: catTx.filter(t => t.member_id === m.id).reduce((s, t) => s + Number(t.amount), 0)
  })).filter(mt => mt.total > 0).sort((a, b) => b.total - a.total);

  // Last transaction for this category
  const lastTx = catTx.sort((a, b) => b.transaction_date.localeCompare(a.transaction_date))[0];
  const lastPayer = lastTx ? members.find(m => m.id === lastTx.member_id) : null;

  return (
    <View style={styles.catBarRow}>
      <Text style={styles.catBarEmoji}>{emoji}</Text>
      <View style={styles.catBarContent}>
        <View style={styles.catBarHeader}>
          <Text style={styles.catBarLabel}>{label}</Text>
          <Text style={styles.catBarAmount}>€ {amount.toFixed(2)}</Text>
        </View>
        <View style={styles.catBarTrack}>
          <Animated.View style={[styles.catBarFill, { backgroundColor: color, width: animWidth.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
        </View>
        {/* Avatars + last payer */}
        <View style={styles.catBarMeta}>
          <View style={styles.catBarAvatars}>
            {memberTotals.map(mt => (
              <View key={mt.member.id} style={styles.catBarAvatarWrap}>
                <View style={[styles.catBarAvatar, { backgroundColor: mt.member.avatar_color }]}>
                  <Text style={styles.catBarAvatarText}>{mt.member.display_name[0]}</Text>
                </View>
                <Text style={styles.catBarAvatarAmount}>€{mt.total.toFixed(0)}</Text>
              </View>
            ))}
          </View>
          {lastPayer && (
            <Text style={styles.catBarLastPayer}>
              Zuletzt: {lastPayer.display_name} · {format(parseISO(lastTx!.transaction_date), 'dd. MMM', { locale: de })}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

function TransactionRow({ tx, onDelete, members }: { tx: Transaction; onDelete: (id: string) => void; members: any[] }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const catColor = CAT_COLORS[tx.category] || colors.brand;
  const payer = members.find(m => m.id === tx.member_id);
  return (
    <View style={styles.txRow}>
      <View style={[styles.txCatIcon, { backgroundColor: catColor + '22' }]}>
        <Text style={styles.txCatEmoji}>{CAT_EMOJIS[tx.category] || '📦'}</Text>
      </View>
      <View style={styles.txInfo}>
        <Text style={styles.txTitle}>{tx.description || tx.category}{tx.recurrence ? ' 🔄' : ''}</Text>
        <View style={styles.txMetaRow}>
          <Text style={styles.txDate}>{format(parseISO(tx.transaction_date), 'dd. MMM', { locale: de })}</Text>
          {payer && (
            <View style={styles.txPayerBadge}>
              <View style={[styles.txPayerAvatar, { backgroundColor: payer.avatar_color }]}>
                <Text style={styles.txPayerAvatarText}>{payer.display_name[0]}</Text>
              </View>
              <Text style={styles.txPayerName}>{payer.display_name}</Text>
            </View>
          )}
        </View>
      </View>
      <View style={styles.txRight}>
        <Text style={[styles.txAmount, { color: tx.type === 'income' ? colors.success : colors.error }]}>
          {tx.type === 'income' ? '+' : '-'} € {Number(tx.amount).toFixed(2)}
        </Text>
        <TouchableOpacity onPress={() => onDelete(tx.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.txDelete}>×</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function BudgetScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { household, currentMember, members, transactions, setTransactions } = useStore();
  const [showModal, setShowModal] = useState(false);
  const [showSplit, setShowSplit] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions'>('overview');
  const [filterCat, setFilterCat] = useState<string | null>(null);

  // Auto-create due occurrences of recurring transactions (rent, insurance, ...)
  const generateRecurring = useCallback(async () => {
    if (!household) return;
    const today = format(new Date(), 'yyyy-MM-dd');
    const { data: templates } = await supabase
      .from('transactions').select('*')
      .eq('household_id', household.id)
      .not('recurrence', 'is', null)
      .lte('recurrence_next', today);
    if (!templates || templates.length === 0) return;

    for (const t of templates) {
      let next = t.recurrence_next as string;
      const inserts: any[] = [];
      let guard = 0;
      while (next && next <= today && guard < 120) {
        inserts.push({
          household_id: household.id, amount: t.amount, type: t.type,
          category: t.category, description: t.description, member_id: t.member_id,
          transaction_date: next,
        });
        next = advanceDate(next, t.recurrence, t.recurrence_interval || 1);
        guard++;
      }
      if (inserts.length) await supabase.from('transactions').insert(inserts);
      await supabase.from('transactions').update({ recurrence_next: next }).eq('id', t.id);
    }
  }, [household]);

  const loadTransactions = useCallback(async () => {
    if (!household) return;
    await generateRecurring();
    const { data } = await supabase.from('transactions').select('*').eq('household_id', household.id).order('transaction_date', { ascending: false });
    if (data) setTransactions(data);
  }, [household, generateRecurring]);

  useEffect(() => { loadTransactions(); }, [loadTransactions]);

  const monthTransactions = transactions.filter(tx => isSameMonth(parseISO(tx.transaction_date), currentMonth));
  const totalExpenses = monthTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
  const totalIncome = monthTransactions.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
  const balance = totalIncome - totalExpenses;

  const catBreakdown = ALL_CATEGORIES.map(cat => ({
    cat, amount: monthTransactions.filter(t => t.category === cat && t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0),
  })).filter(c => c.amount > 0).sort((a, b) => b.amount - a.amount);

  // "Wer ist dran?"
  const memberExpenses: Record<string, number> = {};
  monthTransactions.filter(t => t.type === 'expense').forEach(t => {
    if (t.member_id) memberExpenses[t.member_id] = (memberExpenses[t.member_id] || 0) + Number(t.amount);
  });
  const whoIsNext = members.length > 1
    ? members.reduce((min, m) => (memberExpenses[m.id] || 0) < (memberExpenses[min.id] || 0) ? m : min, members[0])
    : null;
  const isMyTurn = whoIsNext?.id === currentMember?.id;

  // Filtered transactions for tab
  const filteredTransactions = monthTransactions.filter(tx => !filterCat || tx.category === filterCat);
  const availableCats = [...new Set(monthTransactions.map(t => t.category))];

  useEffect(() => { setFilterCat(null); }, [currentMonth]);

  const handleAddTransaction = async (txData: Partial<Transaction>) => {
    if (!household) return;
    const { data } = await supabase.from('transactions').insert({ ...txData, household_id: household.id }).select().single();
    if (data) { setTransactions([data, ...transactions]); hapticNotification(Haptics.NotificationFeedbackType.Success); }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Löschen', 'Eintrag wirklich löschen?', [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Löschen', style: 'destructive', onPress: async () => { setTransactions(transactions.filter(t => t.id !== id)); await supabase.from('transactions').delete().eq('id', id); } }
    ]);
  };

  const monthLabel = format(currentMonth, 'MMMM yyyy', { locale: de });

  // ─── EXPORT ───────────────────────────────────────────────
  const handleExport = async () => {
    if (transactions.length === 0) { Alert.alert('Keine Daten', 'Es gibt noch keine Einträge zum Exportieren.'); return; }
    try {
      const nameById: Record<string, string> = {};
      members.forEach(m => { nameById[m.id] = m.display_name; });
      const csv = buildTransactionsCsv(transactions, nameById);
      await exportCsv(`heimlig-budget-${format(new Date(), 'yyyy-MM-dd')}.csv`, csv);
    } catch (e: any) {
      Alert.alert('Fehler', e?.message ?? 'Export fehlgeschlagen.');
    }
  };

  // ─── IMPORT ───────────────────────────────────────────────
  const handleImport = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      if (res.canceled || !res.assets?.[0]) return;
      const content = await new File(res.assets[0].uri).text();
      const rows = parseTransactionsCsv(content);
      if (rows.length === 0) { Alert.alert('Keine Einträge', 'In der Datei wurden keine gültigen Einträge gefunden. Erwartet werden Spalten wie Datum, Typ, Kategorie, Betrag.'); return; }
      Alert.alert('Import bestätigen', `${rows.length} Einträge aus der Datei importieren?`, [
        { text: 'Abbrechen', style: 'cancel' },
        { text: 'Importieren', onPress: async () => {
            if (!household) return;
            const payload = rows.map(r => ({
              household_id: household.id,
              transaction_date: r.transaction_date,
              type: r.type,
              category: r.category,
              amount: r.amount,
              description: r.description,
              member_id: memberIdByName(members, r.memberName),
            }));
            const { data, error } = await supabase.from('transactions').insert(payload).select();
            if (error) { Alert.alert('Fehler', error.message); return; }
            if (data) setTransactions([...data, ...transactions]);
            hapticNotification(Haptics.NotificationFeedbackType.Success);
            Alert.alert('✓ Importiert', `${data?.length ?? rows.length} Einträge wurden hinzugefügt.`);
          } },
      ]);
    } catch (e: any) {
      Alert.alert('Fehler', e?.message ?? 'Import fehlgeschlagen.');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>💶 Budget</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          {members.length > 1 && (
            <TouchableOpacity style={styles.ioBtn} onPress={() => setShowSplit(true)}>
              <Text style={styles.ioBtnText}>💸</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.ioBtn} onPress={handleExport}>
            <Text style={styles.ioBtnText}>📤</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ioBtn} onPress={handleImport}>
            <Text style={styles.ioBtnText}>📥</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowModal(true)}>
            <Text style={styles.addBtnText}>+ Eintrag</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.monthNav}>
          <TouchableOpacity onPress={() => setCurrentMonth(m => subMonths(m, 1))} style={styles.monthNavBtn}>
            <Text style={styles.monthNavIcon}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.monthTitle}>{monthLabel}</Text>
          <TouchableOpacity onPress={() => setCurrentMonth(m => addMonths(m, 1))} style={styles.monthNavBtn}>
            <Text style={styles.monthNavIcon}>›</Text>
          </TouchableOpacity>
        </View>

        {whoIsNext && members.length > 1 && (
          <View style={[styles.whoNextBanner, isMyTurn && styles.whoNextBannerMe]}>
            <View style={[styles.whoNextAvatar, { backgroundColor: whoIsNext.avatar_color }]}>
              <Text style={styles.whoNextAvatarText}>{whoIsNext.display_name[0]}</Text>
            </View>
            <View>
              <Text style={[styles.whoNextTitle, isMyTurn && { color: colors.brand }]}>
                {isMyTurn ? '💡 Du bist als nächstes dran' : `💡 ${whoIsNext.display_name} ist als nächstes dran`}
              </Text>
              <Text style={styles.whoNextSub}>
                Differenz: € {Math.abs((memberExpenses[members[0]?.id] || 0) - (memberExpenses[members[1]?.id] || 0)).toFixed(0)}
              </Text>
            </View>
          </View>
        )}

        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { borderTopColor: colors.error }]}>
            <Text style={styles.summaryLabel}>Ausgaben</Text>
            <Text style={[styles.summaryAmount, { color: colors.error }]}>€ {totalExpenses.toFixed(2)}</Text>
          </View>
          <View style={[styles.summaryCard, { borderTopColor: colors.success }]}>
            <Text style={styles.summaryLabel}>Einnahmen</Text>
            <Text style={[styles.summaryAmount, { color: colors.success }]}>€ {totalIncome.toFixed(2)}</Text>
          </View>
          <View style={[styles.summaryCard, { borderTopColor: balance >= 0 ? colors.brand : colors.error }]}>
            <Text style={styles.summaryLabel}>Bilanz</Text>
            <Text style={[styles.summaryAmount, { color: balance >= 0 ? colors.brand : colors.error }]}>
              {balance >= 0 ? '+' : ''}€ {balance.toFixed(2)}
            </Text>
          </View>
        </View>

        <View style={styles.tabs}>
          <TouchableOpacity style={[styles.tab, activeTab === 'overview' && styles.tabActive]} onPress={() => setActiveTab('overview')}>
            <Text style={[styles.tabText, activeTab === 'overview' && styles.tabTextActive]}>Übersicht</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, activeTab === 'transactions' && styles.tabActive]} onPress={() => setActiveTab('transactions')}>
            <Text style={[styles.tabText, activeTab === 'transactions' && styles.tabTextActive]}>Buchungen ({monthTransactions.length})</Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'overview' && (
          <View style={styles.section}>
            {catBreakdown.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>💶</Text>
                <Text style={styles.emptyTitle}>Noch keine Einträge</Text>
                <Text style={styles.emptyBody}>Tippe auf "+ Eintrag" um loszulegen.</Text>
              </View>
            ) : (
              <>
                <Text style={styles.sectionTitle}>Ausgaben nach Kategorie</Text>
                {catBreakdown.map(({ cat, amount }) => (
                  <CategoryBar
                    key={cat} label={cat} amount={amount} total={totalExpenses}
                    color={CAT_COLORS[cat] || colors.brand} emoji={CAT_EMOJIS[cat] || '📦'}
                    members={members} transactions={monthTransactions}
                  />
                ))}
              </>
            )}
            {members.length > 1 && monthTransactions.length > 0 && (
              <View style={styles.memberBreakdown}>
                <Text style={styles.sectionTitle}>Pro Person</Text>
                {members.map(m => {
                  const memberTotal = monthTransactions.filter(t => t.member_id === m.id && t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
                  if (memberTotal === 0) return null;
                  return (
                    <View key={m.id} style={styles.memberRow}>
                      <View style={[styles.memberAvatar, { backgroundColor: m.avatar_color }]}>
                        <Text style={styles.memberAvatarText}>{m.display_name[0]}</Text>
                      </View>
                      <Text style={styles.memberName}>{m.display_name}</Text>
                      <Text style={styles.memberAmount}>€ {memberTotal.toFixed(2)}</Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {activeTab === 'transactions' && (
          <View style={styles.section}>
            {/* Kategorie Filter */}
            {availableCats.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} nestedScrollEnabled style={{ marginBottom: spacing.md }}>
                <TouchableOpacity
                  style={[styles.filterChip, !filterCat && styles.filterChipActive]}
                  onPress={() => setFilterCat(null)}
                >
                  <Text style={[styles.filterChipText, !filterCat && { color: '#fff' }]}>Alle</Text>
                </TouchableOpacity>
                {availableCats.map(cat => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.filterChip, filterCat === cat && styles.filterChipActive]}
                    onPress={() => setFilterCat(filterCat === cat ? null : cat)}
                  >
                    <Text style={styles.filterChipEmoji}>{CAT_EMOJIS[cat] || '📦'}</Text>
                    <Text style={[styles.filterChipText, filterCat === cat && { color: '#fff' }]}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {filteredTransactions.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>📋</Text>
                <Text style={styles.emptyTitle}>Keine Buchungen</Text>
                <Text style={styles.emptyBody}>{filterCat ? `Keine Einträge für ${filterCat}.` : `Noch keine Einträge für ${monthLabel}.`}</Text>
              </View>
            ) : (
              filteredTransactions.map(tx => <TransactionRow key={tx.id} tx={tx} onDelete={handleDelete} members={members} />)
            )}
          </View>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={() => setShowModal(true)}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <AddTransactionModal
        visible={showModal} onClose={() => setShowModal(false)}
        onSave={handleAddTransaction} members={members}
        currentMemberId={currentMember?.id ?? ''}
      />
      <BudgetSplitModal visible={showSplit} onClose={() => setShowSplit(false)} />
    </SafeAreaView>
  );
}

function makeStyles(colors: ColorPalette) { return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { ...typography.h2, color: colors.text },
  addBtn: { backgroundColor: colors.brandPale, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  addBtnText: { ...typography.sm, color: colors.brand, fontWeight: '700' },
  ioBtn: { backgroundColor: colors.background, borderRadius: radius.full, width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  ioBtnText: { fontSize: 17 },
  monthNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg },
  monthNavBtn: { padding: spacing.sm },
  monthNavIcon: { fontSize: 28, color: colors.brand, fontWeight: '600' },
  monthTitle: { ...typography.h3, color: colors.text },
  whoNextBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginHorizontal: spacing.md, marginBottom: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, borderLeftWidth: 4, borderLeftColor: colors.textMuted, ...shadow.sm },
  whoNextBannerMe: { borderLeftColor: colors.brand, backgroundColor: colors.brandPale },
  whoNextAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  whoNextAvatarText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  whoNextTitle: { ...typography.body, color: colors.text, fontWeight: '700' },
  whoNextSub: { ...typography.xs, color: colors.textSecondary, marginTop: 2 },
  summaryRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md, marginBottom: spacing.md },
  summaryCard: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, borderTopWidth: 3, ...shadow.sm },
  summaryLabel: { ...typography.xs, color: colors.textSecondary, marginBottom: spacing.xs },
  summaryAmount: { ...typography.h3, fontWeight: '700' },
  tabs: { flexDirection: 'row', marginHorizontal: spacing.md, marginBottom: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, padding: 3, ...shadow.sm },
  tab: { flex: 1, padding: spacing.sm, borderRadius: radius.sm, alignItems: 'center' },
  tabActive: { backgroundColor: colors.brand },
  tabText: { ...typography.sm, color: colors.textSecondary, fontWeight: '600' },
  tabTextActive: { color: '#fff' },
  section: { paddingHorizontal: spacing.md },
  sectionTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.md, marginTop: spacing.sm },

  // Category bar with avatars
  catBarRow: { marginBottom: spacing.md },
  catBarHeader2: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  catBarEmoji: { fontSize: 22, marginRight: spacing.sm, width: 32, textAlign: 'center' },
  catBarContent: { flex: 1 },
  catBarHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  catBarLabel: { ...typography.sm, color: colors.text, fontWeight: '600' },
  catBarAmount: { ...typography.sm, color: colors.textSecondary, fontWeight: '700' },
  catBarTrack: { height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: 'hidden', marginBottom: 6 },
  catBarFill: { height: '100%', borderRadius: 3 },
  catBarMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  catBarAvatars: { flexDirection: 'row', gap: 6 },
  catBarAvatarWrap: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  catBarAvatar: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  catBarAvatarText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  catBarAvatarAmount: { ...typography.xs, color: colors.textSecondary, fontSize: 10 },
  catBarLastPayer: { ...typography.xs, color: colors.textMuted, fontSize: 10, fontStyle: 'italic' },

  // Filter chips
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.border, marginRight: spacing.sm, backgroundColor: colors.surface },
  filterChipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  filterChipEmoji: { fontSize: 13 },
  filterChipText: { ...typography.xs, color: colors.textSecondary, fontWeight: '600' },

  // Transaction rows
  txRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, ...shadow.sm },
  txCatIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  txCatEmoji: { fontSize: 20 },
  txInfo: { flex: 1 },
  txTitle: { ...typography.body, color: colors.text, fontWeight: '500' },
  txMetaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 3 },
  txDate: { ...typography.xs, color: colors.textMuted },
  txPayerBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  txPayerAvatar: { width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  txPayerAvatarText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  txPayerName: { ...typography.xs, color: colors.textSecondary, fontWeight: '600' },
  txRight: { alignItems: 'flex-end', gap: 4 },
  txAmount: { ...typography.body, fontWeight: '700' },
  txDelete: { fontSize: 18, color: colors.textMuted },

  memberBreakdown: { marginTop: spacing.lg },
  memberRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  memberAvatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  memberAvatarText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  memberName: { flex: 1, ...typography.body, color: colors.text },
  memberAmount: { ...typography.body, color: colors.text, fontWeight: '700' },
  emptyState: { alignItems: 'center', paddingVertical: 48 },
  emptyEmoji: { fontSize: 52, marginBottom: spacing.md },
  emptyTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.sm },
  emptyBody: { ...typography.sm, color: colors.textSecondary, textAlign: 'center' },
  fab: { position: 'absolute', right: spacing.lg, bottom: spacing.xl, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', ...shadow.lg },
  fabText: { color: '#fff', fontSize: 28, lineHeight: 30, fontWeight: '300' },
  modalOverlay: { flex: 1, justifyContent: Platform.OS === 'web' ? 'flex-start' : 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, paddingBottom: spacing.xxl, maxHeight: Platform.OS === 'web' ? '100%' : '92%' },
  modalHandle: { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.lg },
  typeToggle: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  typeBtn: { flex: 1, padding: spacing.md, borderRadius: radius.md, alignItems: 'center', borderWidth: 1.5, borderColor: colors.border },
  typeBtnExpense: { backgroundColor: colors.error, borderColor: colors.error },
  typeBtnIncome: { backgroundColor: colors.success, borderColor: colors.success },
  typeBtnText: { ...typography.body, color: colors.textSecondary, fontWeight: '700' },
  presetChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full, backgroundColor: colors.brandPale, borderWidth: 1.5, borderColor: colors.brand, marginRight: spacing.sm },
  presetChipText: { ...typography.sm, color: colors.brand, fontWeight: '600' },
  amountRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  currencySymbol: { fontSize: 32, color: colors.brand, fontWeight: '700', marginRight: spacing.sm },
  amountInput: { flex: 1, fontSize: 40, fontWeight: '800', color: colors.text },
  input: { backgroundColor: colors.background, borderRadius: radius.md, padding: spacing.md, ...typography.body, color: colors.text, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  fieldLabel: { ...typography.label, color: colors.textMuted, marginBottom: spacing.sm },
  catChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.border, marginRight: spacing.sm, backgroundColor: colors.surface },
  catChipEmoji: { fontSize: 14 },
  catChipText: { ...typography.sm, color: colors.textSecondary, fontWeight: '600' },
  memberChip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.border, marginRight: spacing.sm, backgroundColor: colors.surface },
  memberChipAvatar: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  memberChipAvatarText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  memberChipText: { ...typography.sm, color: colors.textSecondary, fontWeight: '600' },
  recurrenceWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  intervalRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  intervalLabel: { ...typography.sm, color: colors.textSecondary, fontWeight: '600' },
  intervalBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  intervalBtnText: { fontSize: 20, color: colors.brand, fontWeight: '800' },
  intervalValue: { ...typography.body, color: colors.text, fontWeight: '800', minWidth: 28, textAlign: 'center' },
  saveBtn: { backgroundColor: colors.brand, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', marginTop: spacing.sm },
  saveBtnText: { ...typography.body, color: '#fff', fontWeight: '700' },
}); }
