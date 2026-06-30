// app/(tabs)/index.tsx – Dashboard
import React, { useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { colors, spacing, radius, typography, shadow, type ColorPalette } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { useStore } from '../../store/useStore';
import { supabase } from '../../lib/supabase';
import { format, isToday, isTomorrow, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import ChatModal from '../../components/ChatModal';
import AsyncStorage from '@react-native-async-storage/async-storage';

function AvatarCircle({ name, color, size = 36 }: { name: string; color: string; size?: number }) {
  const { colors } = useTheme();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.surface }}>
      <Text style={{ color: '#fff', fontWeight: '700', fontSize: size * 0.38 }}>{name[0].toUpperCase()}</Text>
    </View>
  );
}

function StatCard({ emoji, label, value, sub, onPress, color = colors.brand }: any) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <TouchableOpacity style={styles.statCard} onPress={onPress} activeOpacity={0.8}>
      <Text style={styles.statEmoji}>{emoji}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {sub && <Text style={styles.statSub}>{sub}</Text>}
    </TouchableOpacity>
  );
}

function TaskRow({ task, onComplete }: any) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const dueText = task.due_date
    ? isToday(parseISO(task.due_date)) ? 'Heute'
    : isTomorrow(parseISO(task.due_date)) ? 'Morgen'
    : format(parseISO(task.due_date), 'dd. MMM', { locale: de })
    : null;

  return (
    <TouchableOpacity style={styles.taskRow} onPress={() => onComplete(task.id)} activeOpacity={0.7}>
      <View style={[styles.taskDot, task.priority === 'high' && { backgroundColor: colors.error }]} />
      <View style={styles.taskContent}>
        <Text style={styles.taskTitle} numberOfLines={1}>{task.title}</Text>
        {dueText && <Text style={styles.taskDue}>{dueText}</Text>}
      </View>
      <View style={styles.taskCheck}>
        <Text style={styles.taskCheckIcon}>○</Text>
      </View>
    </TouchableOpacity>
  );
}

const QUICK_ACTIONS = [
  { emoji: '🛒', label: 'Einkauf', route: '/(tabs)/shopping' },
  { emoji: '✅', label: 'Aufgaben', route: '/(tabs)/tasks' },
  { emoji: '💶', label: 'Budget', route: '/(tabs)/budget' },
  { emoji: '👥', label: 'Haushalt', route: '/(tabs)/household' },
];

export default function DashboardScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const { household, currentMember, members, tasks, items, transactions, completeTask, setTasks, setTransactions } = useStore();
  const [refreshing, setRefreshing] = React.useState(false);
  const [showChat, setShowChat] = React.useState(false);

  // Birthdays live in the calendar + the dedicated widget below — keep them out of "open tasks".
  const openTasks = tasks.filter(t => !t.completed_at && t.category !== 'Geburtstag');
  const uncheckedItems = items.filter(i => !i.checked);

  // Strip "Geburtstag" boilerplate from a task title so we show just the person's name.
  const birthdayName = (title: string) =>
    title.replace(/geburtstag/ig, '').replace(/[:•\-–]/g, '').replace(/🎂/g, '').replace(/\s+/g, ' ').trim() || title;

  // Next upcoming birthday (treats birthdays as recurring annually).
  const nextBirthday = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const cands = tasks
      .filter(t => t.category === 'Geburtstag' && t.due_date)
      .map(t => {
        const d = parseISO(t.due_date!);
        const next = new Date(today.getFullYear(), d.getMonth(), d.getDate());
        next.setHours(0, 0, 0, 0);
        if (next.getTime() < today.getTime()) next.setFullYear(today.getFullYear() + 1);
        const days = Math.round((next.getTime() - today.getTime()) / 86400000);
        return { task: t, days };
      })
      .sort((a, b) => a.days - b.days);
    return cands[0] ?? null;
  }, [tasks]);

  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthlyExpenses = transactions
    .filter(t => t.type === 'expense' && t.transaction_date.startsWith(monthKey))
    .reduce((sum, t) => sum + Number(t.amount), 0);

  // Open tasks that are actually due this month (drives the "Offen · diesen Monat" card).
  const openTasksThisMonth = openTasks.filter(t => t.due_date && t.due_date.startsWith(monthKey));

  const loadData = async () => {
    if (!household) return;
    const [tasksRes, txRes] = await Promise.all([
      supabase.from('tasks').select('*').eq('household_id', household.id).is('completed_at', null).order('due_date'),
      supabase.from('transactions').select('*').eq('household_id', household.id).order('transaction_date', { ascending: false }).limit(50),
    ]);
    if (tasksRes.data) setTasks(tasksRes.data);
    if (txRes.data) setTransactions(txRes.data);
  };

  useEffect(() => { loadData(); }, [household]);

  // Reload whenever the Home tab is focused (e.g. returning from Tasks or Budget)
  useFocusEffect(useCallback(() => { loadData(); }, [household]));

  const onRefresh = async () => { setRefreshing(true); await loadData(); setRefreshing(false); };

  // Keep a tiny snapshot for the Android home-screen widget (read on its next refresh).
  useEffect(() => {
    AsyncStorage.setItem('@heimlig/widget', JSON.stringify({
      openTasks: openTasks.length,
      shoppingCount: uncheckedItems.length,
      nextTask: openTasks[0]?.title ?? '',
    })).catch(() => {});
  }, [openTasks.length, uncheckedItems.length]);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Guten Morgen';
    if (h < 18) return 'Hallo';
    return 'Guten Abend';
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{greeting()},</Text>
            <Text style={styles.name}>{currentMember?.display_name ?? 'Zuhause'} 👋</Text>
          </View>
          <View style={styles.memberStack}>
            {members.slice(0, 3).map((m, i) => (
              <View key={m.id} style={[styles.avatarStackItem, { right: i * 20 }]}>
                <AvatarCircle name={m.display_name} color={m.avatar_color} />
              </View>
            ))}
          </View>
        </View>

        {/* Household badge */}
        <View style={styles.householdBadge}>
          <Text style={styles.householdName}>🏡 {household?.name ?? 'Mein Haushalt'}</Text>
        </View>

        {/* Next birthday */}
        {nextBirthday && (
          <TouchableOpacity style={styles.birthdayCard} activeOpacity={0.85} onPress={() => router.push('/(tabs)/tasks')}>
            <Text style={styles.birthdayEmoji}>🎂</Text>
            <View style={{ flex: 1 }}>
              {nextBirthday.days === 0 ? (
                <Text style={styles.birthdayToday}>{birthdayName(nextBirthday.task.title)} hat heute Geburtstag! 🎉</Text>
              ) : (
                <>
                  <Text style={styles.birthdayLabel}>Nächster Geburtstag</Text>
                  <Text style={styles.birthdayName}>
                    {birthdayName(nextBirthday.task.title)} · {nextBirthday.days === 1 ? 'morgen' : `noch ${nextBirthday.days} Tage`}
                  </Text>
                </>
              )}
            </View>
          </TouchableOpacity>
        )}

        {/* Stats */}
        <View style={styles.statsRow}>
          <StatCard emoji="📋" label="Offen" value={openTasksThisMonth.length} sub="diesen Monat" onPress={() => router.push('/(tabs)/tasks')} />
          <StatCard emoji="🛒" label="Fehlt" value={uncheckedItems.length} sub="Artikel" onPress={() => router.push('/(tabs)/shopping')} color={colors.accent} />
          <StatCard emoji="💶" label="Ausgaben" value={`€ ${monthlyExpenses.toFixed(0)}`} sub="diesen Monat" onPress={() => router.push('/(tabs)/budget')} color={colors.info} />
        </View>

        {/* Pinboard / chat */}
        <TouchableOpacity style={styles.pinboardCard} activeOpacity={0.85} onPress={() => setShowChat(true)}>
          <Text style={styles.pinboardEmoji}>💬</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.pinboardTitle}>Pinnwand</Text>
            <Text style={styles.pinboardSub}>Nachrichten an alle im Haushalt</Text>
          </View>
          <Text style={styles.pinboardArrow}>›</Text>
        </TouchableOpacity>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <Text style={styles.sectionTitle}>Schnellzugriff</Text>
          <View style={styles.quickRow}>
            {QUICK_ACTIONS.map(q => (
              <TouchableOpacity
                key={q.label}
                style={styles.quickBtn}
                onPress={() => router.push(q.route as any)}
                activeOpacity={0.8}
              >
                <Text style={styles.quickEmoji}>{q.emoji}</Text>
                <Text style={styles.quickLabel} numberOfLines={1}>{q.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Tasks */}
        {openTasks.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Anstehende Aufgaben</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/tasks')}>
                <Text style={styles.seeAll}>Alle →</Text>
              </TouchableOpacity>
            </View>
            {openTasks.slice(0, 4).map(task => (
              <TaskRow key={task.id} task={task} onComplete={completeTask} />
            ))}
          </View>
        )}

        {/* Shopping preview */}
        {uncheckedItems.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Noch zu kaufen</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/shopping')}>
                <Text style={styles.seeAll}>Liste öffnen →</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.shoppingPreview} onPress={() => router.push('/(tabs)/shopping')}>
              <View style={styles.shoppingPreviewItems}>
                {uncheckedItems.slice(0, 3).map(item => (
                  <View key={item.id} style={styles.previewChip}>
                    <Text style={styles.previewChipText} numberOfLines={1}>{item.name}</Text>
                  </View>
                ))}
                {uncheckedItems.length > 3 && (
                  <View style={[styles.previewChip, { backgroundColor: colors.brandPale }]}>
                    <Text style={[styles.previewChipText, { color: colors.brand }]}>+{uncheckedItems.length - 3}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: spacing.xxl }} />
      </ScrollView>

      <ChatModal visible={showChat} onClose={() => setShowChat(false)} />
    </SafeAreaView>
  );
}

function makeStyles(colors: ColorPalette) { return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingHorizontal: spacing.lg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: spacing.md, marginBottom: spacing.sm },
  greeting: { ...typography.sm, color: colors.textSecondary },
  name: { ...typography.h2, color: colors.text },
  memberStack: { flexDirection: 'row', width: 76, height: 36 },
  avatarStackItem: { position: 'absolute' },
  avatar: { alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.surface },
  avatarText: { color: colors.textInverse, fontWeight: '700' },
  householdBadge: { backgroundColor: colors.brandPale, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, alignSelf: 'flex-start', marginBottom: spacing.lg },
  householdName: { ...typography.sm, color: colors.brand, fontWeight: '600' },
  birthdayCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.lg, ...shadow.sm, borderLeftWidth: 4, borderLeftColor: colors.accent },
  birthdayEmoji: { fontSize: 30 },
  birthdayLabel: { ...typography.xs, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  birthdayName: { ...typography.body, color: colors.text, fontWeight: '700', marginTop: 2 },
  birthdayToday: { ...typography.body, color: colors.accent, fontWeight: '800' },
  pinboardCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.lg, ...shadow.sm, borderLeftWidth: 4, borderLeftColor: colors.brand },
  pinboardEmoji: { fontSize: 28 },
  pinboardTitle: { ...typography.body, color: colors.text, fontWeight: '700' },
  pinboardSub: { ...typography.xs, color: colors.textSecondary, marginTop: 2 },
  pinboardArrow: { fontSize: 26, color: colors.textMuted, fontWeight: '300' },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  statCard: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, alignItems: 'center', ...shadow.sm },
  statEmoji: { fontSize: 24, marginBottom: spacing.xs },
  statValue: { ...typography.h2, color: colors.brand },
  statLabel: { ...typography.xs, color: colors.textMuted, marginTop: 2 },
  statSub: { ...typography.xs, color: colors.textMuted },
  quickActions: { marginBottom: spacing.lg },
  sectionTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.md },
  quickRow: { flexDirection: 'row', gap: spacing.sm },
  quickBtn: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, paddingVertical: spacing.md, paddingHorizontal: spacing.xs, alignItems: 'center', ...shadow.sm },
  quickEmoji: { fontSize: 24, marginBottom: 4 },
  quickLabel: { fontSize: 10, color: colors.textSecondary, fontWeight: '600', textAlign: 'center' },
  section: { marginBottom: spacing.lg },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  seeAll: { ...typography.sm, color: colors.brand, fontWeight: '600' },
  taskRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, ...shadow.sm },
  taskDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brand, marginRight: spacing.md },
  taskContent: { flex: 1 },
  taskTitle: { ...typography.body, color: colors.text, fontWeight: '500' },
  taskDue: { ...typography.xs, color: colors.textSecondary, marginTop: 2 },
  taskCheck: { padding: spacing.xs },
  taskCheckIcon: { fontSize: 20, color: colors.textMuted },
  shoppingPreview: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, ...shadow.sm },
  shoppingPreviewItems: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  previewChip: { backgroundColor: colors.background, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  previewChipText: { ...typography.sm, color: colors.text },
}); }
