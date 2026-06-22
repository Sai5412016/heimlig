// app/(tabs)/tasks.tsx
import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Modal, ScrollView, Pressable, KeyboardAvoidingView, Platform, Alert, Animated, Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
const hapticImpact = (style: Haptics.ImpactFeedbackStyle) => { if (Platform.OS !== 'web') Haptics.impactAsync(style); };
const hapticNotification = (type: Haptics.NotificationFeedbackType) => { if (Platform.OS !== 'web') Haptics.notificationAsync(type); };
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameDay, isToday, isBefore, startOfWeek, addMonths,
  subMonths, parseISO, addDays
} from 'date-fns';
import { de } from 'date-fns/locale';
import { colors, spacing, radius, typography, shadow } from '../../constants/theme';
import { supabase, Task, MealPlan, MealType } from '../../lib/supabase';
import { useStore } from '../../store/useStore';
import { scheduleTaskNotification, requestNotificationPermission } from '../../lib/notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Scoreboard, { monthlyScores } from '../../components/Scoreboard';

type ViewMode = 'calendar' | 'list';
type Priority = 'low' | 'normal' | 'high';

const PRIORITY_COLORS: Record<Priority, string> = {
  low: '#10B981', normal: colors.brand, high: '#EF4444',
};
const PRIORITY_LABELS: Record<Priority, string> = {
  low: 'Leicht · 5', normal: 'Mittel · 10', high: 'Schwer · 20',
};
const RECURRENCE_OPTIONS = [
  { key: null, label: 'Einmalig' },
  { key: 'daily', label: 'Täglich' },
  { key: 'weekly', label: 'Wöchentlich' },
  { key: 'monthly', label: 'Monatlich' },
  { key: 'yearly', label: 'Jährlich' },
];
const CATEGORY_EMOJIS: Record<string, string> = {
  'Haushalt': '🏠', 'Einkauf': '🛒', 'Wartung': '🔧',
  'Garten': '🌱', 'Büro': '💼', 'Familie': '👨‍👩‍👧', 'Sonstiges': '📋',
  'Gesundheit': '💊', 'Sport': '🏃', 'Finanzen': '💶', 'Reise': '✈️',
};
const HOUSEHOLD_CATEGORIES = ['Haushalt', 'Einkauf', 'Wartung', 'Garten'];

// ─── TIME SLOTS ───────────────────────────────────────────────
const TIME_SLOTS = Array.from({ length: 49 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = i % 2 === 0 ? '00' : '30';
  return `${String(h).padStart(2, '0')}:${m}`;
});

function getCurrentTimeSlot(): string {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = now.getMinutes() < 30 ? '00' : '30';
  return `${h}:${m}`;
}

// ─── TIME PICKER DROPDOWN ─────────────────────────────────────
function TimePickerDropdown({ value, onChange }: { value: string; onChange: (t: string) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.timePickerWrap}>
      <TouchableOpacity
        style={styles.timePickerBtn}
        onPress={() => setOpen(v => !v)}
        activeOpacity={0.8}
      >
        <Text style={styles.timePickerValue}>⏰ {value}</Text>
        <Text style={styles.timePickerArrow}>{open ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {open && (
        <View style={styles.timeDropdown}>
          <ScrollView style={{ maxHeight: 220 }} nestedScrollEnabled showsVerticalScrollIndicator={false}>
            {TIME_SLOTS.map(slot => (
              <TouchableOpacity
                key={slot}
                style={[styles.timeDropdownItem, value === slot && styles.timeDropdownItemActive]}
                onPress={() => { onChange(slot); setOpen(false); }}
              >
                <Text style={[styles.timeDropdownText, value === slot && { color: '#fff', fontWeight: '700' }]}>
                  {slot}
                </Text>
                {value === slot && <Text style={{ color: '#fff' }}>✓</Text>}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

// ─── ADD TASK MODAL ───────────────────────────────────────────
function AddTaskModal({ visible, onClose, onSave, members, preselectedDate }: {
  visible: boolean; onClose: () => void;
  onSave: (task: Partial<Task> & { due_time?: string; notify?: boolean }) => void;
  members: any[]; preselectedDate?: Date | null;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Haushalt');
  const [priority, setPriority] = useState<Priority>('normal');
  const [assignedTo, setAssignedTo] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState(preselectedDate ? format(preselectedDate, 'yyyy-MM-dd') : '');
  const [dueTime, setDueTime] = useState(getCurrentTimeSlot());
  const [useTime, setUseTime] = useState(false);
  const [recurrence, setRecurrence] = useState<string | null>(null);
  const [notify, setNotify] = useState(true);

  useEffect(() => {
    if (visible && preselectedDate) setDueDate(format(preselectedDate, 'yyyy-MM-dd'));
    if (!visible) {
      setTitle(''); setDescription(''); setCategory('Haushalt');
      setPriority('normal'); setAssignedTo(null); setDueDate('');
      setDueTime(getCurrentTimeSlot()); setUseTime(false);
      setRecurrence(null); setNotify(true);
    }
  }, [visible, preselectedDate]);

  const handleSave = () => {
    if (!title.trim()) return;
    onSave({
      title: title.trim(), description: description.trim() || undefined,
      category, priority, assigned_to: assignedTo || undefined,
      due_date: dueDate || undefined,
      due_time: useTime ? dueTime : undefined,
      recurrence: recurrence || undefined,
      points: priority === 'high' ? 20 : priority === 'normal' ? 10 : 5,
      notify,
    } as any);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={[styles.modalOverlay, Platform.OS === 'web' && { justifyContent: 'flex-start' }]} onPress={onClose}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={Platform.OS === 'web' ? { width: '100%' } : undefined}>
          <Pressable style={[styles.modalSheet, Platform.OS === 'web' && { maxHeight: '100%' }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Neue Aufgabe</Text>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

              <TextInput style={styles.input} placeholder="Was ist zu tun?" placeholderTextColor={colors.textMuted} value={title} onChangeText={setTitle} autoFocus />
              <TextInput style={[styles.input, { height: 70, textAlignVertical: 'top' }]} placeholder="Notizen (optional)" placeholderTextColor={colors.textMuted} value={description} onChangeText={setDescription} multiline />

              {/* Datum */}
              <Text style={styles.fieldLabel}>DATUM</Text>
              <TextInput
                style={styles.input}
                placeholder="JJJJ-MM-TT"
                placeholderTextColor={colors.textMuted}
                value={dueDate}
                onChangeText={setDueDate}
              />

              {/* Uhrzeit Toggle + Dropdown */}
              <View style={styles.timeToggleRow}>
                <Text style={styles.fieldLabel}>UHRZEIT</Text>
                <TouchableOpacity
                  style={[styles.timeToggleSwitch, useTime && styles.timeToggleSwitchActive]}
                  onPress={() => setUseTime(v => !v)}
                >
                  <Text style={[styles.timeToggleText, useTime && { color: '#fff' }]}>
                    {useTime ? 'An' : 'Aus'}
                  </Text>
                </TouchableOpacity>
              </View>

              {useTime && (
                <TimePickerDropdown value={dueTime} onChange={setDueTime} />
              )}

              {/* Erinnerung */}
              {dueDate !== '' && (
                <TouchableOpacity style={[styles.notifyToggle, notify && styles.notifyToggleActive]} onPress={() => setNotify(v => !v)}>
                  <Text style={styles.notifyToggleEmoji}>{notify ? '🔔' : '🔕'}</Text>
                  <View>
                    <Text style={[styles.notifyToggleText, notify && { color: colors.brand }]}>{notify ? 'Erinnerung aktiv' : 'Keine Erinnerung'}</Text>
                    <Text style={styles.notifyToggleSub}>
                      {notify ? `5:00 Uhr früh${useTime ? ` + 15 Min. vor ${dueTime}` : ''}` : 'Keine Benachrichtigung'}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}

              {/* Priorität */}
              <Text style={styles.fieldLabel}>PRIORITÄT</Text>
              <View style={styles.chipRow}>
                {(Object.keys(PRIORITY_LABELS) as Priority[]).map(p => (
                  <TouchableOpacity key={p} style={[styles.chip, priority === p && { backgroundColor: PRIORITY_COLORS[p], borderColor: PRIORITY_COLORS[p] }]} onPress={() => setPriority(p)}>
                    <Text style={[styles.chipText, priority === p && { color: '#fff' }]}>{PRIORITY_LABELS[p]}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Kategorie */}
              <Text style={styles.fieldLabel}>KATEGORIE</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
                {Object.keys(CATEGORY_EMOJIS).map(cat => (
                  <TouchableOpacity key={cat} style={[styles.chip, category === cat && { backgroundColor: colors.brand, borderColor: colors.brand }]} onPress={() => setCategory(cat)}>
                    <Text style={styles.chipEmoji}>{CATEGORY_EMOJIS[cat]}</Text>
                    <Text style={[styles.chipText, category === cat && { color: '#fff' }]}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Zuweisen */}
              {members.length > 1 && (
                <>
                  <Text style={styles.fieldLabel}>ZUWEISEN AN</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
                    <TouchableOpacity style={[styles.chip, !assignedTo && { backgroundColor: colors.brand, borderColor: colors.brand }]} onPress={() => setAssignedTo(null)}>
                      <Text style={[styles.chipText, !assignedTo && { color: '#fff' }]}>Alle</Text>
                    </TouchableOpacity>
                    {members.map(m => (
                      <TouchableOpacity key={m.id} style={[styles.chip, assignedTo === m.id && { backgroundColor: m.avatar_color, borderColor: m.avatar_color }]} onPress={() => setAssignedTo(m.id)}>
                        <Text style={[styles.chipText, assignedTo === m.id && { color: '#fff' }]}>{m.display_name}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              )}

              {/* Wiederkehrend */}
              <Text style={styles.fieldLabel}>WIEDERKEHREND</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.lg }}>
                {RECURRENCE_OPTIONS.map(r => (
                  <TouchableOpacity key={String(r.key)} style={[styles.chip, recurrence === r.key && { backgroundColor: colors.brand, borderColor: colors.brand }]} onPress={() => setRecurrence(r.key)}>
                    <Text style={[styles.chipText, recurrence === r.key && { color: '#fff' }]}>{r.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <TouchableOpacity style={[styles.saveBtn, !title.trim() && { opacity: 0.4 }]} onPress={handleSave} disabled={!title.trim()}>
                <Text style={styles.saveBtnText}>Aufgabe erstellen ✓</Text>
              </TouchableOpacity>
              <View style={{ height: 20 }} />
            </ScrollView>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

// ─── TASK CARD ────────────────────────────────────────────────
function TaskCard({ task, onComplete, onDelete, members, showPoints }: {
  task: Task & { due_time?: string }; onComplete: (id: string) => void;
  onDelete: (id: string) => void; members: any[]; showPoints?: boolean;
}) {
  const isCompleted = !!task.completed_at;
  const isOverdue = task.due_date && !isCompleted && isBefore(parseISO(task.due_date), new Date()) && !isToday(parseISO(task.due_date));
  const assignedMember = members.find(m => m.id === task.assigned_to);
  const priorityColor = PRIORITY_COLORS[task.priority as Priority] || colors.brand;
  const isHouseholdCat = HOUSEHOLD_CATEGORIES.includes(task.category);

  const dueDateText = task.due_date
    ? isToday(parseISO(task.due_date)) ? 'Heute'
    : isSameDay(parseISO(task.due_date), addDays(new Date(), 1)) ? 'Morgen'
    : format(parseISO(task.due_date), 'dd. MMM', { locale: de })
    : null;

  return (
    <View style={[styles.taskCard, isCompleted && { opacity: 0.5 }]}>
      <View style={[styles.priorityBar, { backgroundColor: priorityColor }]} />
      <TouchableOpacity style={styles.taskCheckbox} onPress={() => {
        if (isCompleted) { onComplete(task.id); return; }
        Alert.alert('Aufgabe erledigen?', `"${task.title}" als erledigt markieren?`, [
          { text: 'Abbrechen', style: 'cancel' },
          { text: 'Erledigt ✓', onPress: () => { hapticImpact(Haptics.ImpactFeedbackStyle.Medium); onComplete(task.id); } },
        ]);
      }}>
        <View style={[styles.checkbox, isCompleted && { backgroundColor: colors.brand, borderColor: colors.brand }]}>
          {isCompleted && <Text style={styles.checkmark}>✓</Text>}
        </View>
      </TouchableOpacity>
      <View style={styles.taskInfo}>
        <View style={styles.taskTitleRow}>
          <Text style={[styles.taskTitle, isCompleted && { textDecorationLine: 'line-through', color: colors.textMuted }]}>{task.title}</Text>
          {showPoints && isHouseholdCat && !isCompleted && (
            <View style={styles.pointsBadge}>
              <Text style={styles.pointsBadgeText}>+{task.points || 10}🏆</Text>
            </View>
          )}
        </View>
        {task.description ? <Text style={styles.taskDesc} numberOfLines={1}>{task.description}</Text> : null}
        <View style={styles.taskMeta}>
          <Text style={styles.taskCatEmoji}>{CATEGORY_EMOJIS[task.category] || '📋'}</Text>
          <Text style={styles.taskCatLabel}>{task.category}</Text>
          {dueDateText && (
            <View style={[styles.dueBadge, isOverdue && { backgroundColor: '#FEE2E2' }]}>
              <Text style={[styles.dueBadgeText, isOverdue && { color: colors.error }]}>
                {isOverdue ? '⚠️ ' : '📅 '}{dueDateText}{(task as any).due_time ? ` · ${(task as any).due_time}` : ''}
              </Text>
            </View>
          )}
          {task.recurrence && (
            <View style={styles.recurrenceBadge}>
              <Text style={styles.recurrenceBadgeText}>🔄 {RECURRENCE_OPTIONS.find(r => r.key === task.recurrence)?.label}</Text>
            </View>
          )}
          {assignedMember && (
            <View style={[styles.assignBadge, { backgroundColor: assignedMember.avatar_color + '22' }]}>
              <Text style={[styles.assignBadgeText, { color: assignedMember.avatar_color }]}>{assignedMember.display_name[0]}</Text>
            </View>
          )}
        </View>
      </View>
      <TouchableOpacity style={styles.deleteTaskBtn} onPress={() => onDelete(task.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Text style={styles.deleteTaskBtnText}>×</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── CALENDAR VIEW ────────────────────────────────────────────
function CalendarView({ tasks, onDayPress, selectedDate, mealPlans }: {
  tasks: Task[]; onDayPress: (date: Date) => void; selectedDate: Date | null; mealPlans: MealPlan[];
}) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const monthStart = startOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calStart, end: addDays(endOfMonth(currentMonth), 6 - endOfMonth(currentMonth).getDay()) });

  const tasksByDate: Record<string, Task[]> = {};
  tasks.forEach(t => {
    if (t.due_date) {
      const key = t.due_date.substring(0, 10);
      if (!tasksByDate[key]) tasksByDate[key] = [];
      tasksByDate[key].push(t);
    }
  });

  return (
    <View style={styles.calendarContainer}>
      <View style={styles.monthNav}>
        <TouchableOpacity onPress={() => setCurrentMonth(m => subMonths(m, 1))} style={styles.monthNavBtn}><Text style={styles.monthNavIcon}>‹</Text></TouchableOpacity>
        <Text style={styles.monthTitle}>{format(currentMonth, 'MMMM yyyy', { locale: de })}</Text>
        <TouchableOpacity onPress={() => setCurrentMonth(m => addMonths(m, 1))} style={styles.monthNavBtn}><Text style={styles.monthNavIcon}>›</Text></TouchableOpacity>
      </View>
      <View style={styles.weekdayRow}>
        {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(d => <Text key={d} style={styles.weekdayLabel}>{d}</Text>)}
      </View>
      <View style={styles.daysGrid}>
        {days.map(day => {
          const key = format(day, 'yyyy-MM-dd');
          const dayTasks = tasksByDate[key] || [];
          const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const isToday_ = isToday(day);
          return (
            <TouchableOpacity key={key} style={[styles.dayCell, isSelected && styles.dayCellSelected, isToday_ && !isSelected && styles.dayCellToday]} onPress={() => onDayPress(day)}>
              <Text style={[styles.dayNumber, !isCurrentMonth && { opacity: 0.3 }, isSelected && { color: '#fff' }, isToday_ && !isSelected && { color: colors.brand, fontWeight: '700' }]}>{format(day, 'd')}</Text>
              {(dayTasks.length > 0 || mealPlans.some(m => m.planned_date === key)) && (
                <View style={styles.dotRow}>
                  {dayTasks.slice(0, 2).map((t, i) => (
                    <View key={i} style={[styles.taskDotCal, { backgroundColor: t.completed_at ? colors.textMuted : PRIORITY_COLORS[t.priority as Priority] || colors.brand }, isSelected && { backgroundColor: 'rgba(255,255,255,0.8)' }]} />
                  ))}
                  {mealPlans.some(m => m.planned_date === key) && (
                    <View style={[styles.taskDotCal, { backgroundColor: colors.accent }, isSelected && { backgroundColor: 'rgba(255,255,255,0.8)' }]} />
                  )}
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ─── POINTS TOAST ─────────────────────────────────────────────
function PointsToast({ points, visible }: { points: number; visible: boolean }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (visible) {
      anim.setValue(0);
      Animated.sequence([
        Animated.spring(anim, { toValue: 1, useNativeDriver: true, speed: 20 }),
        Animated.delay(700),
        Animated.timing(anim, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;
  return (
    <Animated.View style={[styles.pointsToast, {
      opacity: anim,
      transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [30, -10] }) }, { scale: anim }]
    }]}>
      <Text style={styles.pointsToastText}>+{points} Punkte 🏆</Text>
    </Animated.View>
  );
}

// ─── MAIN SCREEN ──────────────────────────────────────────────
export default function TasksScreen() {
  const { household, currentMember, members, tasks, setTasks, completeTask, weekScores, loadWeekScores, items, setItems } = useStore();
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [showModal, setShowModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [toastPoints, setToastPoints] = useState(0);
  const [showToast, setShowToast] = useState(false);
  const [showScoreboard, setShowScoreboard] = useState(false);
  const [monthScores, setMonthScores] = useState<Record<string, number>>({});

  // Gamification only runs in households with more than one member and when not disabled
  const gamificationOn = household?.gamification_enabled !== false && members.length > 1;

  const loadMonthScores = useCallback(async () => {
    if (!household) return;
    const rows = await monthlyScores(household.id, members, new Date());
    const map: Record<string, number> = {};
    rows.forEach(r => { map[r.member.id] = r.points; });
    setMonthScores(map);
  }, [household?.id, members.length]);

  const loadTasks = useCallback(async () => {
    if (!household) return;
    const { data } = await supabase.from('tasks').select('*').eq('household_id', household.id).order('due_date', { ascending: true, nullsFirst: false });
    if (data) setTasks(data);
  }, [household]);

  const loadMealPlans = useCallback(async () => {
    if (!household) return;
    const { data } = await supabase
      .from('meal_plans')
      .select('*, recipes(source_url)')
      .eq('household_id', household.id);
    if (data) setMealPlans(data as any);
  }, [household]);

  useEffect(() => {
    loadTasks();
    loadWeekScores();
    loadMealPlans();
    loadMonthScores();
    requestNotificationPermission();
  }, [loadTasks, loadMealPlans, loadMonthScores]);

  // Once per month: celebrate last month's top household member
  useEffect(() => {
    if (!gamificationOn || !household) return;
    (async () => {
      const prevMonth = subMonths(new Date(), 1);
      const key = format(prevMonth, 'yyyy-MM');
      const storeKey = `heimlig_celebrated_${household.id}`;
      const last = await AsyncStorage.getItem(storeKey);
      if (last === key) return;
      const rows = await monthlyScores(household.id, members, prevMonth);
      const winner = rows[0];
      await AsyncStorage.setItem(storeKey, key);
      if (winner && winner.points > 0) {
        Alert.alert(
          '🏆 Heimlig-Haushälter:in des Monats!',
          `Im ${format(prevMonth, 'MMMM', { locale: de })} war es ${winner.member.display_name} mit ${winner.points} Punkten! 🎉\n\nNeuer Monat, neue Chance – auf geht's!`
        );
      }
    })();
  }, [gamificationOn, household?.id, members.length]);

  const handleAddTask = async (taskData: Partial<Task> & { due_time?: string; notify?: boolean }) => {
    if (!household || !currentMember) return;
    const { notify, due_time, ...rest } = taskData as any;
    const { data } = await supabase.from('tasks').insert({ ...rest, household_id: household.id, created_by: currentMember.id }).select().single();
    if (data) {
      setTasks([...tasks, data]);
      hapticNotification(Haptics.NotificationFeedbackType.Success);
      if (notify && data.due_date) await scheduleTaskNotification(data.id, data.title, data.due_date, due_time);
    }
  };

  const handleComplete = async (id: string) => {
    const result = await completeTask(id);
    hapticImpact(Haptics.ImpactFeedbackStyle.Medium);
    loadMonthScores();
    if (gamificationOn && result.isHousehold && result.points > 0) {
      hapticNotification(Haptics.NotificationFeedbackType.Success);
      setToastPoints(result.points);
      setShowToast(false);
      setTimeout(() => setShowToast(true), 50);
      setTimeout(() => setShowToast(false), 1500);
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Löschen', 'Aufgabe wirklich löschen?', [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Löschen', style: 'destructive', onPress: async () => { setTasks(tasks.filter(t => t.id !== id)); await supabase.from('tasks').delete().eq('id', id); } }
    ]);
  };

  const filteredTasks = tasks.filter(t => {
    if (!showCompleted && t.completed_at) return false;
    if (filterCategory && t.category !== filterCategory) return false;
    if (selectedDate && viewMode === 'calendar') return t.due_date && isSameDay(parseISO(t.due_date), selectedDate);
    return true;
  });

  const openTasks = filteredTasks.filter(t => !t.completed_at);
  const completedTasks = filteredTasks.filter(t => !!t.completed_at);
  const overdueTasks = tasks.filter(t => t.due_date && !t.completed_at && isBefore(parseISO(t.due_date), new Date()) && !isToday(parseISO(t.due_date)));
  const myScore = monthScores[currentMember?.id ?? ''] || 0;
  const topScore = Math.max(0, ...members.map(m => monthScores[m.id] || 0));
  const isLeading = myScore > 0 && myScore >= topScore;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>📋 Aufgaben</Text>
          <Text style={styles.headerSub}>{openTasks.length} offen{overdueTasks.length > 0 ? ` · ${overdueTasks.length} überfällig` : ''}</Text>
        </View>
        <View style={styles.headerRight}>
          {gamificationOn && (
            <TouchableOpacity style={[styles.scoreBadge, isLeading && styles.scoreBadgeLeading]} onPress={() => setShowScoreboard(true)}>
              <Text style={styles.scoreBadgeText}>{isLeading ? '👑' : '🏆'} {myScore}</Text>
            </TouchableOpacity>
          )}
          <View style={styles.viewToggle}>
            <TouchableOpacity style={[styles.viewToggleBtn, viewMode === 'calendar' && styles.viewToggleBtnActive]} onPress={() => { setViewMode('calendar'); setSelectedDate(null); }}>
              <Text style={styles.viewToggleText}>📅</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.viewToggleBtn, viewMode === 'list' && styles.viewToggleBtnActive]} onPress={() => setViewMode('list')}>
              <Text style={styles.viewToggleText}>☰</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {overdueTasks.length > 0 && (
        <View style={styles.overdueBanner}>
          <Text style={styles.overdueBannerText}>⚠️ {overdueTasks.length} überfällige Aufgabe{overdueTasks.length > 1 ? 'n' : ''}</Text>
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false}>
        {viewMode === 'calendar' && (
          <CalendarView tasks={tasks} selectedDate={selectedDate} mealPlans={mealPlans} onDayPress={(day) => setSelectedDate(isSameDay(day, selectedDate || new Date(-1)) ? null : day)} />
        )}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          <TouchableOpacity style={[styles.filterChip, !filterCategory && styles.filterChipActive]} onPress={() => setFilterCategory(null)}>
            <Text style={[styles.filterChipText, !filterCategory && styles.filterChipTextActive]}>Alle</Text>
          </TouchableOpacity>
          {Object.keys(CATEGORY_EMOJIS).map(cat => (
            <TouchableOpacity key={cat} style={[styles.filterChip, filterCategory === cat && styles.filterChipActive]} onPress={() => setFilterCategory(filterCategory === cat ? null : cat)}>
              <Text style={styles.filterChipEmoji}>{CATEGORY_EMOJIS[cat]}</Text>
              <Text style={[styles.filterChipText, filterCategory === cat && styles.filterChipTextActive]}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {selectedDate && (
          <View style={styles.selectedDateHeader}>
            <Text style={styles.selectedDateText}>{isToday(selectedDate) ? 'Heute' : format(selectedDate, 'EEEE, dd. MMMM', { locale: de })}</Text>
            <TouchableOpacity onPress={() => setShowModal(true)}>
              <Text style={styles.addForDayText}>+ Aufgabe</Text>
            </TouchableOpacity>
          </View>
        )}
        {selectedDate && mealPlans.filter(m => m.planned_date === format(selectedDate, 'yyyy-MM-dd')).length > 0 && (
          <View style={styles.mealPlanSection}>
            <Text style={styles.mealPlanTitle}>🍽️ Mahlzeiten</Text>
            {(['fruehstueck', 'mittag', 'abendessen'] as MealType[]).map(type => {
              const meal = mealPlans.find(m => m.planned_date === format(selectedDate, 'yyyy-MM-dd') && m.meal_type === type);
              if (!meal) return null;
              const labels: Record<MealType, string> = { fruehstueck: '🌅 Frühstück', mittag: '☀️ Mittagessen', abendessen: '🌙 Abendessen' };
              const sourceUrl = (meal as any).recipes?.source_url;
              return (
                <View key={type} style={styles.mealPlanRow}>
                  <Text style={styles.mealPlanLabel}>{labels[type]}</Text>
                  <TouchableOpacity style={{ flex: 1 }} onPress={() => sourceUrl && Linking.openURL(sourceUrl)} activeOpacity={sourceUrl ? 0.6 : 1}>
                    <Text style={styles.mealPlanName}>{meal.recipe_name}{sourceUrl ? ' 🔗' : ''}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.mealDeleteBtn} onPress={() => {
                    Alert.alert('Mahlzeit entfernen?', `"${meal.recipe_name}" aus dem Kalender löschen? Die zugehörigen Zutaten werden auch aus dem Einkaufskorb entfernt.`, [
                      { text: 'Abbrechen', style: 'cancel' },
                      { text: 'Löschen', style: 'destructive', onPress: async () => {
                        // Deleting the meal plan cascades to its linked shopping_items in the DB
                        await supabase.from('meal_plans').delete().eq('id', meal.id);
                        setMealPlans(prev => prev.filter(m => m.id !== meal.id));
                        setItems(items.filter(i => i.meal_plan_id !== meal.id));
                      }},
                    ]);
                  }}>
                    <Text style={styles.mealDeleteText}>✕</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}

        <View style={styles.taskList}>
          {openTasks.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>{selectedDate ? '✨' : '🎉'}</Text>
              <Text style={styles.emptyTitle}>{selectedDate ? 'Kein Plan für diesen Tag' : 'Alles erledigt!'}</Text>
              <Text style={styles.emptyBody}>{selectedDate ? 'Tippe auf + Aufgabe.' : 'Genieß den freien Tag. 🌿'}</Text>
            </View>
          )}
          {openTasks.map(task => <TaskCard key={task.id} task={task as any} onComplete={handleComplete} onDelete={handleDelete} members={members} showPoints={gamificationOn} />)}
          {completedTasks.length > 0 && (
            <>
              <TouchableOpacity style={styles.completedHeader} onPress={() => setShowCompleted(v => !v)}>
                <Text style={styles.completedHeaderText}>✓ Erledigt ({completedTasks.length})</Text>
                <Text style={styles.completedToggle}>{showCompleted ? '▲' : '▼'}</Text>
              </TouchableOpacity>
              {showCompleted && completedTasks.map(task => <TaskCard key={task.id} task={task as any} onComplete={handleComplete} onDelete={handleDelete} members={members} showPoints={gamificationOn} />)}
            </>
          )}
        </View>
        <View style={{ height: 100 }} />
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={() => setShowModal(true)}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <PointsToast points={toastPoints} visible={showToast} />

      {gamificationOn && household && (
        <Scoreboard
          visible={showScoreboard}
          onClose={() => setShowScoreboard(false)}
          householdId={household.id}
          members={members}
          currentMemberId={currentMember?.id}
        />
      )}

      <AddTaskModal visible={showModal} onClose={() => setShowModal(false)} onSave={handleAddTask} members={members} preselectedDate={selectedDate} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { ...typography.h2, color: colors.text },
  headerSub: { ...typography.sm, color: colors.textSecondary, marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  scoreBadge: { backgroundColor: colors.brandPale, borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  scoreBadgeLeading: { backgroundColor: '#FEF3C7' },
  scoreBadgeText: { ...typography.xs, color: colors.brand, fontWeight: '800' },
  viewToggle: { flexDirection: 'row', backgroundColor: colors.background, borderRadius: radius.md, padding: 3 },
  viewToggleBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.sm },
  viewToggleBtnActive: { backgroundColor: colors.surface, ...shadow.sm },
  viewToggleText: { fontSize: 18 },
  overdueBanner: { backgroundColor: '#FEF2F2', padding: spacing.sm, paddingHorizontal: spacing.lg, borderBottomWidth: 1, borderBottomColor: '#FECACA' },
  overdueBannerText: { ...typography.sm, color: colors.error, fontWeight: '600' },
  calendarContainer: { backgroundColor: colors.surface, margin: spacing.md, borderRadius: radius.lg, ...shadow.sm, padding: spacing.md },
  monthNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  monthNavBtn: { padding: spacing.sm },
  monthNavIcon: { fontSize: 24, color: colors.brand, fontWeight: '600' },
  monthTitle: { ...typography.h3, color: colors.text },
  weekdayRow: { flexDirection: 'row', marginBottom: spacing.sm },
  weekdayLabel: { flex: 1, textAlign: 'center', ...typography.xs, color: colors.textMuted, fontWeight: '700', textTransform: 'uppercase' },
  daysGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: '14.28%', alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radius.sm },
  dayCellSelected: { backgroundColor: colors.brand },
  dayCellToday: { backgroundColor: colors.brandPale },
  dayNumber: { ...typography.sm, color: colors.text, fontWeight: '500' },
  dotRow: { flexDirection: 'row', gap: 2, marginTop: 2 },
  taskDotCal: { width: 5, height: 5, borderRadius: 3 },
  filterScroll: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.border, marginRight: spacing.sm, backgroundColor: colors.surface },
  filterChipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  filterChipEmoji: { fontSize: 14 },
  filterChipText: { ...typography.xs, color: colors.textSecondary, fontWeight: '600' },
  filterChipTextActive: { color: '#fff' },
  selectedDateHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  selectedDateText: { ...typography.h3, color: colors.text },
  addForDayText: { ...typography.sm, color: colors.brand, fontWeight: '700' },
  mealPlanSection: { marginHorizontal: spacing.lg, marginBottom: spacing.sm, backgroundColor: '#FFF5F0', borderRadius: radius.md, padding: spacing.md, borderLeftWidth: 3, borderLeftColor: colors.accent },
  mealPlanTitle: { ...typography.label, color: colors.accent, marginBottom: spacing.xs },
  mealPlanRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 2 },
  mealPlanLabel: { ...typography.sm, color: colors.textSecondary, width: 110 },
  mealPlanName: { ...typography.sm, color: colors.text, fontWeight: '600', flex: 1 },
  mealDeleteBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  mealDeleteText: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  taskList: { paddingHorizontal: spacing.md },
  taskCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.md, marginBottom: spacing.sm, ...shadow.sm, overflow: 'hidden' },
  priorityBar: { width: 4, alignSelf: 'stretch' },
  taskCheckbox: { padding: spacing.md },
  checkbox: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  checkmark: { color: '#fff', fontSize: 13, fontWeight: '700' },
  taskInfo: { flex: 1, paddingVertical: spacing.md, paddingRight: spacing.sm },
  taskTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  taskTitle: { ...typography.body, color: colors.text, fontWeight: '500', flex: 1 },
  pointsBadge: { backgroundColor: '#FEF3C7', borderRadius: radius.full, paddingHorizontal: 6, paddingVertical: 2 },
  pointsBadgeText: { fontSize: 10, color: '#D97706', fontWeight: '800' },
  taskDesc: { ...typography.xs, color: colors.textSecondary, marginTop: 2 },
  taskMeta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 6 },
  taskCatEmoji: { fontSize: 13 },
  taskCatLabel: { ...typography.xs, color: colors.textSecondary },
  dueBadge: { backgroundColor: '#F0FDF4', borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  dueBadgeText: { ...typography.xs, color: colors.brand, fontWeight: '600' },
  recurrenceBadge: { backgroundColor: colors.brandPale, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  recurrenceBadgeText: { ...typography.xs, color: colors.brand, fontWeight: '600' },
  assignBadge: { borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  assignBadgeText: { ...typography.xs, fontWeight: '700' },
  deleteTaskBtn: { padding: spacing.md },
  deleteTaskBtnText: { fontSize: 20, color: colors.textMuted },
  completedHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, marginTop: spacing.sm },
  completedHeaderText: { ...typography.label, color: colors.textSecondary },
  completedToggle: { ...typography.xs, color: colors.textMuted },
  emptyState: { alignItems: 'center', paddingTop: 48, paddingBottom: 24 },
  emptyEmoji: { fontSize: 52, marginBottom: spacing.md },
  emptyTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.sm },
  emptyBody: { ...typography.sm, color: colors.textSecondary, textAlign: 'center' },
  fab: { position: 'absolute', right: spacing.lg, bottom: spacing.xl, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', ...shadow.lg },
  fabText: { color: '#fff', fontSize: 28, lineHeight: 30, fontWeight: '300' },
  pointsToast: { position: 'absolute', bottom: 100, alignSelf: 'center', backgroundColor: colors.brand, borderRadius: radius.full, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, ...shadow.lg },
  pointsToastText: { color: '#fff', fontWeight: '800', fontSize: 18 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, paddingBottom: spacing.xxl, maxHeight: '92%' },
  modalHandle: { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.lg },
  modalTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.md },
  input: { backgroundColor: colors.background, borderRadius: radius.md, padding: spacing.md, ...typography.body, color: colors.text, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  timeToggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  timeToggleSwitch: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface },
  timeToggleSwitchActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  timeToggleText: { ...typography.sm, color: colors.textSecondary, fontWeight: '600' },
  timePickerWrap: { marginBottom: spacing.md, zIndex: 100 },
  timePickerBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.background, borderRadius: radius.md, padding: spacing.md, borderWidth: 1.5, borderColor: colors.brand },
  timePickerValue: { ...typography.body, color: colors.text, fontWeight: '600' },
  timePickerArrow: { color: colors.brand, fontWeight: '700' },
  timeDropdown: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.brand, marginTop: 4, ...shadow.md, overflow: 'hidden' },
  timeDropdownItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  timeDropdownItemActive: { backgroundColor: colors.brand },
  timeDropdownText: { ...typography.body, color: colors.text },
  notifyToggle: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, marginBottom: spacing.md, backgroundColor: colors.surface },
  notifyToggleActive: { borderColor: colors.brand, backgroundColor: colors.brandPale },
  notifyToggleEmoji: { fontSize: 24 },
  notifyToggleText: { ...typography.sm, color: colors.textSecondary, fontWeight: '600' },
  notifyToggleSub: { ...typography.xs, color: colors.textMuted, marginTop: 2 },
  fieldLabel: { ...typography.label, color: colors.textMuted, marginBottom: spacing.sm },
  chipRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.border, marginRight: spacing.sm, backgroundColor: colors.surface },
  chipEmoji: { fontSize: 14 },
  chipText: { ...typography.sm, color: colors.textSecondary, fontWeight: '600' },
  saveBtn: { backgroundColor: colors.brand, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', marginTop: spacing.sm },
  saveBtnText: { ...typography.body, color: '#fff', fontWeight: '700' },
});
