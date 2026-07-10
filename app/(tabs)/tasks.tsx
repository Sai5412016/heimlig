// app/(tabs)/tasks.tsx
import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Modal, ScrollView, Pressable, KeyboardAvoidingView, Platform, Animated, Linking, Image
} from 'react-native';
import { Alert } from '../../lib/alert';
import { Swipeable } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
const hapticImpact = (style: Haptics.ImpactFeedbackStyle) => { if (Platform.OS !== 'web') Haptics.impactAsync(style); };
const hapticNotification = (type: Haptics.NotificationFeedbackType) => { if (Platform.OS !== 'web') Haptics.notificationAsync(type); };
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameDay, isToday, isBefore, startOfWeek, addMonths,
  subMonths, parseISO, addDays
} from 'date-fns';
import { de } from 'date-fns/locale';
import { colors, spacing, radius, typography, shadow, APP_THEMES, type ColorPalette } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { supabase, Task, MealPlan, MealType } from '../../lib/supabase';
import { useStore } from '../../store/useStore';
import { scheduleTaskNotification, requestNotificationPermission } from '../../lib/notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Scoreboard, { monthlyScores } from '../../components/Scoreboard';
import RewardsModal from '../../components/RewardsModal';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import { parseICS, type IcsEvent } from '../../lib/ics';
import { uploadTaskAttachment, deleteTaskAttachment, getTaskAttachmentUrl, type PickedFile } from '../../lib/taskAttachments';
import ThemeMotif from '../../components/ThemeMotif';

type ViewMode = 'week' | 'month' | 'list';
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
  'Geburtstag': '🎂', 'Medikament': '💊', 'Pflanzen': '🪴', 'Haustier': '🐾',
};
const CATEGORY_COLORS: Record<string, string> = {
  'Haushalt': '#2D6A4F', 'Einkauf': '#FF6B35', 'Wartung': '#6C757D',
  'Garten': '#52B788', 'Büro': '#4A6FA5', 'Familie': '#E91E8C', 'Sonstiges': '#9AB5A0',
  'Gesundheit': '#E5573F', 'Sport': '#F5A623', 'Finanzen': '#2D9E57', 'Reise': '#00B4D8',
  'Geburtstag': '#FF4B6E', 'Medikament': '#E5573F', 'Pflanzen': '#52B788', 'Haustier': '#B07D48',
};
const catColor = (cat?: string) => CATEGORY_COLORS[cat || ''] || '#9AB5A0';
const HOUSEHOLD_CATEGORIES = ['Haushalt', 'Einkauf', 'Wartung', 'Garten'];

// ─── TIME SLOTS ───────────────────────────────────────────────
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

function getCurrentTime(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

// ─── TIME PICKER DROPDOWN ─────────────────────────────────────
// Two scrollable columns (Stunde/Minute) so times can be set to the exact minute,
// not just in fixed steps.
function TimePickerDropdown({ value, onChange }: { value: string; onChange: (t: string) => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [open, setOpen] = useState(false);
  const [h, m] = value.split(':');

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
          <View style={{ flexDirection: 'row' }}>
            <ScrollView style={styles.timeDropdownCol} nestedScrollEnabled showsVerticalScrollIndicator={false}>
              {HOURS.map(hh => (
                <TouchableOpacity
                  key={hh}
                  style={[styles.timeDropdownItem, h === hh && styles.timeDropdownItemActive]}
                  onPress={() => onChange(`${hh}:${m}`)}
                >
                  <Text style={[styles.timeDropdownText, h === hh && { color: '#fff', fontWeight: '700' }]}>{hh}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={styles.timeDropdownDivider} />
            <ScrollView style={styles.timeDropdownCol} nestedScrollEnabled showsVerticalScrollIndicator={false}>
              {MINUTES.map(mm => (
                <TouchableOpacity
                  key={mm}
                  style={[styles.timeDropdownItem, m === mm && styles.timeDropdownItemActive]}
                  onPress={() => onChange(`${h}:${mm}`)}
                >
                  <Text style={[styles.timeDropdownText, m === mm && { color: '#fff', fontWeight: '700' }]}>{mm}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
          <TouchableOpacity style={styles.timeDropdownDone} onPress={() => setOpen(false)}>
            <Text style={styles.timeDropdownDoneText}>Fertig ✓</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ─── ADD TASK MODAL ───────────────────────────────────────────
function AddTaskModal({ visible, onClose, onSave, members, preselectedDate, editTask, householdId }: {
  visible: boolean; onClose: () => void;
  onSave: (task: Partial<Task> & { due_time?: string; notify?: boolean }) => void;
  members: any[]; preselectedDate?: Date | null;
  editTask?: (Task & { due_time?: string }) | null;
  householdId?: string;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Haushalt');
  const [priority, setPriority] = useState<Priority>('normal');
  const [assignedTo, setAssignedTo] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState(preselectedDate ? format(preselectedDate, 'yyyy-MM-dd') : '');
  const [dueTime, setDueTime] = useState(getCurrentTime());
  const [useTime, setUseTime] = useState(false);
  const [recurrence, setRecurrence] = useState<string | null>(null);
  const [recurrenceInterval, setRecurrenceInterval] = useState(1);
  const [rotation, setRotation] = useState<string[]>([]);
  const [notify, setNotify] = useState(true);
  const [remindTime, setRemindTime] = useState('05:00');
  const [attachment, setAttachment] = useState<{ path: string; name: string } | null>(null);
  const [attachmentUploading, setAttachmentUploading] = useState(false);
  const [locationUrl, setLocationUrl] = useState('');

  useEffect(() => {
    if (!visible) {
      setTitle(''); setDescription(''); setCategory('Haushalt');
      setPriority('normal'); setAssignedTo(null); setDueDate('');
      setDueTime(getCurrentTime()); setUseTime(false);
      setRecurrence(null); setRecurrenceInterval(1); setRotation([]); setNotify(true);
      setRemindTime('05:00');
      setAttachment(null); setLocationUrl('');
      return;
    }
    if (editTask) {
      // Prefill for editing
      setTitle(editTask.title || '');
      setDescription(editTask.description || '');
      setCategory(editTask.category || 'Haushalt');
      setPriority((editTask.priority as Priority) || 'normal');
      setAssignedTo(editTask.assigned_to || null);
      setDueDate(editTask.due_date || '');
      setUseTime(!!editTask.due_time);
      setDueTime(editTask.due_time || getCurrentTime());
      setRecurrence(editTask.recurrence || null);
      setRecurrenceInterval(editTask.recurrence_interval || 1);
      setRotation(editTask.rotation || []);
      setNotify(true);
      setRemindTime(editTask.remind_time || '05:00');
      setAttachment(editTask.attachment_path ? { path: editTask.attachment_path, name: editTask.attachment_name || 'Anhang' } : null);
      setLocationUrl(editTask.location_url || '');
    } else if (preselectedDate) {
      setDueDate(format(preselectedDate, 'yyyy-MM-dd'));
    }
  }, [visible, preselectedDate, editTask]);

  const pickPhoto = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
    if (res.canceled || !res.assets?.[0]) return;
    const asset = res.assets[0];
    await handleUploadAttachment({ uri: asset.uri, name: asset.fileName || `Foto_${Date.now()}.jpg`, mimeType: asset.mimeType || 'image/jpeg' });
  };

  const pickDocument = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
    if (res.canceled || !res.assets?.[0]) return;
    const asset = res.assets[0];
    await handleUploadAttachment({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType || undefined });
  };

  const handleUploadAttachment = async (file: PickedFile) => {
    if (!householdId) return;
    setAttachmentUploading(true);
    const result = await uploadTaskAttachment(householdId, file);
    setAttachmentUploading(false);
    if (result) setAttachment(result);
    else Alert.alert('Fehler', 'Datei konnte nicht hochgeladen werden.');
  };

  const removeAttachment = () => {
    if (attachment) deleteTaskAttachment(attachment.path);
    setAttachment(null);
  };

  const handleSave = () => {
    if (!title.trim()) return;
    const useRotation = !!recurrence && rotation.length >= 2;
    // With a rotation, the current task goes to whoever is up next (or stays put on edit).
    const startAssignee = useRotation
      ? (assignedTo && rotation.includes(assignedTo) ? assignedTo : rotation[0])
      : (assignedTo || undefined);
    onSave({
      title: title.trim(), description: description.trim() || undefined,
      category, priority, assigned_to: startAssignee,
      rotation: useRotation ? rotation : null,
      due_date: dueDate || undefined,
      due_time: useTime ? dueTime : undefined,
      recurrence: recurrence || undefined,
      recurrence_interval: recurrence ? recurrenceInterval : undefined,
      points: priority === 'high' ? 20 : priority === 'normal' ? 10 : 5,
      notify,
      remind_time: notify ? remindTime : undefined,
      attachment_path: attachment?.path || null,
      attachment_name: attachment?.name || null,
      location_url: locationUrl.trim() || null,
    } as any);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.modalOverlay, Platform.OS === 'web' && { justifyContent: 'flex-start' }]}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)' }]} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={Platform.OS === 'web' ? { width: '100%', flex: 1 } : undefined}>
          <View style={[styles.modalSheet, Platform.OS === 'web' && { maxHeight: '100%' }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{editTask ? 'Aufgabe bearbeiten' : 'Neue Aufgabe'}</Text>
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
                <>
                  <TouchableOpacity style={[styles.notifyToggle, notify && styles.notifyToggleActive]} onPress={() => setNotify(v => !v)}>
                    <Text style={styles.notifyToggleEmoji}>{notify ? '🔔' : '🔕'}</Text>
                    <View>
                      <Text style={[styles.notifyToggleText, notify && { color: colors.brand }]}>{notify ? 'Erinnerung aktiv' : 'Keine Erinnerung'}</Text>
                      <Text style={styles.notifyToggleSub}>
                        {notify ? `Um ${remindTime} Uhr am Fälligkeitstag` : 'Keine Benachrichtigung'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                  {notify && <TimePickerDropdown value={remindTime} onChange={setRemindTime} />}
                </>
              )}

              {/* Standort-Link */}
              <Text style={styles.fieldLabel}>STANDORT (OPTIONAL)</Text>
              <TextInput
                style={styles.input}
                placeholder="Google-Maps-Link einfügen"
                placeholderTextColor={colors.textMuted}
                value={locationUrl}
                onChangeText={setLocationUrl}
                autoCapitalize="none"
                autoCorrect={false}
              />

              {/* Anhang */}
              <Text style={styles.fieldLabel}>ANHANG (OPTIONAL)</Text>
              {attachment ? (
                <View style={styles.attachmentRow}>
                  <Text style={styles.attachmentRowText} numberOfLines={1}>📎 {attachment.name}</Text>
                  <TouchableOpacity onPress={removeAttachment} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={styles.attachmentRemove}>✕</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.chipRow}>
                  <TouchableOpacity style={[styles.chip, { flex: 1 }]} onPress={pickPhoto} disabled={attachmentUploading}>
                    <Text style={styles.chipText}>📷 Foto</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.chip, { flex: 1 }]} onPress={pickDocument} disabled={attachmentUploading}>
                    <Text style={styles.chipText}>{attachmentUploading ? 'Lädt hoch…' : '📄 Dokument'}</Text>
                  </TouchableOpacity>
                </View>
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
                  <View style={styles.chipWrap}>
                    <TouchableOpacity style={[styles.chip, !assignedTo && { backgroundColor: colors.brand, borderColor: colors.brand }]} onPress={() => setAssignedTo(null)}>
                      <Text style={[styles.chipText, !assignedTo && { color: '#fff' }]}>👥 Alle</Text>
                    </TouchableOpacity>
                    {members.map(m => (
                      <TouchableOpacity key={m.id} style={[styles.chip, assignedTo === m.id && { backgroundColor: m.avatar_color, borderColor: m.avatar_color }]} onPress={() => setAssignedTo(m.id)}>
                        <Text style={[styles.chipText, assignedTo === m.id && { color: '#fff' }]}>{m.display_name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              {/* Wiederkehrend */}
              <Text style={styles.fieldLabel}>WIEDERKEHREND</Text>
              <View style={styles.chipWrap}>
                {RECURRENCE_OPTIONS.map(r => (
                  <TouchableOpacity key={String(r.key)} style={[styles.chip, recurrence === r.key && { backgroundColor: colors.brand, borderColor: colors.brand }]} onPress={() => setRecurrence(r.key)}>
                    <Text style={[styles.chipText, recurrence === r.key && { color: '#fff' }]}>{r.label}</Text>
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
                    {recurrence === 'daily' ? (recurrenceInterval === 1 ? 'Tag' : 'Tage')
                      : recurrence === 'weekly' ? (recurrenceInterval === 1 ? 'Woche' : 'Wochen')
                      : recurrence === 'monthly' ? (recurrenceInterval === 1 ? 'Monat' : 'Monate')
                      : (recurrenceInterval === 1 ? 'Jahr' : 'Jahre')}
                  </Text>
                </View>
              )}

              {/* Rotation – reihum zuweisen (nur bei Wiederholung & mehreren Mitgliedern) */}
              {recurrence && members.length > 1 && (
                <>
                  <Text style={styles.fieldLabel}>🔄 REIHUM (WER IST DRAN)</Text>
                  <Text style={styles.rotationHint}>
                    Tippe die Mitglieder in der gewünschten Reihenfolge an – die Aufgabe wandert bei jeder Wiederholung zum Nächsten.
                  </Text>
                  <View style={styles.chipWrap}>
                    {members.map(m => {
                      const idx = rotation.indexOf(m.id);
                      const active = idx >= 0;
                      return (
                        <TouchableOpacity
                          key={m.id}
                          style={[styles.chip, active && { backgroundColor: m.avatar_color, borderColor: m.avatar_color }]}
                          onPress={() => setRotation(r => active ? r.filter(x => x !== m.id) : [...r, m.id])}
                        >
                          <Text style={[styles.chipText, active && { color: '#fff' }]}>
                            {active ? `${idx + 1}. ` : ''}{m.display_name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}

              <TouchableOpacity style={[styles.saveBtn, !title.trim() && { opacity: 0.4 }]} onPress={handleSave} disabled={!title.trim()}>
                <Text style={styles.saveBtnText}>{editTask ? 'Änderungen speichern ✓' : 'Aufgabe erstellen ✓'}</Text>
              </TouchableOpacity>
              <View style={{ height: 20 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ─── QUICKSTART (manual switch from TimeTree / other apps) ────
// TimeTree has no export API, so instead of asking new users to jump through a technical
// hoop (third-party tool, their TimeTree password), this lets them rebuild the handful of
// recurring events that actually matter — usually done in well under two minutes.
export interface QuickstartEntry { title: string; date: string; recurrence: string | null }

function TimeTreeQuickstartModal({ visible, onClose, onSave }: {
  visible: boolean;
  onClose: () => void;
  onSave: (entries: QuickstartEntry[]) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [recurrence, setRecurrence] = useState<string | null>(null);
  const [queue, setQueue] = useState<QuickstartEntry[]>([]);
  const titleRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!visible) { setTitle(''); setDate(''); setRecurrence(null); setQueue([]); }
  }, [visible]);

  const addToQueue = () => {
    if (!title.trim()) return;
    setQueue(q => [...q, { title: title.trim(), date, recurrence }]);
    setTitle('');
    hapticImpact(Haptics.ImpactFeedbackStyle.Light);
    titleRef.current?.focus();
  };

  const removeFromQueue = (i: number) => setQueue(q => q.filter((_, idx) => idx !== i));

  const finish = () => {
    if (queue.length === 0) return;
    onSave(queue);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.modalOverlay, Platform.OS === 'web' && { justifyContent: 'flex-start' }]}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)' }]} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={Platform.OS === 'web' ? { width: '100%', flex: 1 } : undefined}>
          <View style={[styles.modalSheet, Platform.OS === 'web' && { maxHeight: '100%' }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>🔄 Schnellstart von TimeTree & Co.</Text>
            <Text style={[styles.fieldLabel, { textTransform: 'none', marginBottom: spacing.md }]}>
              TimeTree lässt sich leider nicht direkt exportieren. Trag stattdessen kurz deine wichtigsten
              wiederkehrenden Termine ein (Geburtstage, „Mülltonne raus" usw.) — meist unter 2 Minuten.
            </Text>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <TextInput
                ref={titleRef}
                style={styles.input}
                placeholder="z.B. Geburtstag Mama, Müll raus, …"
                placeholderTextColor={colors.textMuted}
                value={title}
                onChangeText={setTitle}
                returnKeyType="done"
                onSubmitEditing={addToQueue}
              />
              <Text style={styles.fieldLabel}>DATUM (ERSTER/NÄCHSTER TERMIN)</Text>
              <TextInput
                style={styles.input}
                placeholder="JJJJ-MM-TT"
                placeholderTextColor={colors.textMuted}
                value={date}
                onChangeText={setDate}
              />
              <Text style={styles.fieldLabel}>WIEDERHOLUNG</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md }}>
                {RECURRENCE_OPTIONS.map(r => (
                  <TouchableOpacity key={String(r.key)} style={[styles.chip, recurrence === r.key && { backgroundColor: colors.brand, borderColor: colors.brand }]} onPress={() => setRecurrence(r.key)}>
                    <Text style={[styles.chipText, recurrence === r.key && { color: '#fff' }]}>{r.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity style={[styles.saveBtn, !title.trim() && { opacity: 0.4 }]} onPress={addToQueue} disabled={!title.trim()}>
                <Text style={styles.saveBtnText}>+ Zur Liste hinzufügen</Text>
              </TouchableOpacity>

              {queue.length > 0 && (
                <>
                  <Text style={[styles.fieldLabel, { marginTop: spacing.lg }]}>BEREIT ZUM ÜBERNEHMEN ({queue.length})</Text>
                  {queue.map((e, i) => (
                    <View key={i} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderLight }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ ...typography.body, color: colors.text, fontWeight: '600' }}>{e.title}</Text>
                        <Text style={{ ...typography.xs, color: colors.textMuted }}>
                          {e.date || 'ohne Datum'}{e.recurrence ? ` · ${RECURRENCE_OPTIONS.find(r => r.key === e.recurrence)?.label}` : ''}
                        </Text>
                      </View>
                      <TouchableOpacity onPress={() => removeFromQueue(i)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Text style={{ fontSize: 18, color: colors.textMuted }}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                  <TouchableOpacity style={[styles.saveBtn, { marginTop: spacing.md }]} onPress={finish}>
                    <Text style={styles.saveBtnText}>{queue.length} Termine übernehmen ✓</Text>
                  </TouchableOpacity>
                </>
              )}
              <View style={{ height: 20 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ─── TIMETREE DIRECT IMPORT (gated: households.timetree_import_enabled) ────
// Uses TimeTree's unofficial web API (see supabase/functions/timetree-import) since there's
// no official export. Only shown for households explicitly flagged in the database — this
// isn't offered broadly because it means handling a third party's real credentials.
function TimeTreeLoginModal({ visible, onClose, onImport }: {
  visible: boolean;
  onClose: () => void;
  onImport: (email: string, password: string) => Promise<void>;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) { setEmail(''); setPassword(''); setLoading(false); }
  }, [visible]);

  const handleImport = async () => {
    if (!email.trim() || !password) return;
    setLoading(true);
    try {
      await onImport(email.trim(), password);
    } finally {
      setPassword(''); // never keep the password in memory longer than the request
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.modalOverlay, Platform.OS === 'web' && { justifyContent: 'flex-start' }]}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)' }]} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={Platform.OS === 'web' ? { width: '100%', flex: 1 } : undefined}>
          <View style={[styles.modalSheet, Platform.OS === 'web' && { maxHeight: '100%' }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>🔗 Mit TimeTree verbinden</Text>
            <Text style={[styles.fieldLabel, { textTransform: 'none', marginBottom: spacing.md }]}>
              Deine TimeTree-Zugangsdaten werden nur für diesen einen Import verwendet, nirgends gespeichert
              und laufen über TimeTrees inoffizielle Schnittstelle — kann jederzeit aufhören zu funktionieren.
            </Text>
            <TextInput
              style={styles.input}
              placeholder="TimeTree-E-Mail"
              placeholderTextColor={colors.textMuted}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <TextInput
              style={styles.input}
              placeholder="TimeTree-Passwort"
              placeholderTextColor={colors.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
            <TouchableOpacity
              style={[styles.saveBtn, (!email.trim() || !password || loading) && { opacity: 0.4 }]}
              onPress={handleImport}
              disabled={!email.trim() || !password || loading}
            >
              <Text style={styles.saveBtnText}>{loading ? 'Importiere …' : 'Termine importieren'}</Text>
            </TouchableOpacity>
            <View style={{ height: 20 }} />
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ─── TASK CARD ────────────────────────────────────────────────
function TaskCard({ task, onComplete, onDelete, members, showPoints, onOpen }: {
  task: Task & { due_time?: string }; onComplete: (id: string) => void;
  onDelete: (id: string) => void; members: any[]; showPoints?: boolean; onOpen?: (task: Task) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const isCompleted = !!task.completed_at;
  const isOverdue = task.due_date && !isCompleted && isBefore(parseISO(task.due_date), new Date()) && !isToday(parseISO(task.due_date));
  const assignedMember = members.find(m => m.id === task.assigned_to);
  const priorityColor = PRIORITY_COLORS[task.priority as Priority] || colors.brand;
  const isHouseholdCat = HOUSEHOLD_CATEGORIES.includes(task.category);
  const swipeRef = useRef<Swipeable>(null);

  const dueDateText = task.due_date
    ? isToday(parseISO(task.due_date)) ? 'Heute'
    : isSameDay(parseISO(task.due_date), addDays(new Date(), 1)) ? 'Morgen'
    : format(parseISO(task.due_date), 'dd. MMM', { locale: de })
    : null;

  // Swipe right → complete (skips the tap-to-confirm dialog, the swipe itself is the deliberate act).
  // Swipe left → delete (goes through onDelete, which already confirms via Alert).
  const renderLeftActions = () => (
    <TouchableOpacity
      style={[styles.swipeAction, { backgroundColor: '#2D9E57' }]}
      onPress={() => { swipeRef.current?.close(); hapticImpact(Haptics.ImpactFeedbackStyle.Medium); onComplete(task.id); }}
    >
      <Text style={styles.swipeActionText}>{isCompleted ? '↺' : '✓'}</Text>
    </TouchableOpacity>
  );
  const renderRightActions = () => (
    <TouchableOpacity
      style={[styles.swipeAction, { backgroundColor: '#E5573F' }]}
      onPress={() => { swipeRef.current?.close(); onDelete(task.id); }}
    >
      <Text style={styles.swipeActionText}>🗑</Text>
    </TouchableOpacity>
  );

  return (
    <Swipeable ref={swipeRef} renderLeftActions={renderLeftActions} renderRightActions={renderRightActions} overshootLeft={false} overshootRight={false}>
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
      <TouchableOpacity style={styles.taskInfo} activeOpacity={0.6} onPress={() => onOpen?.(task)}>
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
          <View style={[styles.taskCatChip, { backgroundColor: catColor(task.category) + '1A' }]}>
            <Text style={styles.taskCatEmoji}>{CATEGORY_EMOJIS[task.category] || '📋'}</Text>
            <Text style={[styles.taskCatLabel, { color: catColor(task.category) }]}>{task.category}</Text>
          </View>
          {dueDateText && (
            <View style={[styles.dueBadge, isOverdue && { backgroundColor: '#FEE2E2' }]}>
              <Text style={[styles.dueBadgeText, isOverdue && { color: colors.error }]}>
                {isOverdue ? '⚠️ ' : '📅 '}{dueDateText}{(task as any).due_time ? ` · 🕐 ${(task as any).due_time}` : ''}
              </Text>
            </View>
          )}
          {task.recurrence && (
            <View style={styles.recurrenceBadge}>
              <Text style={styles.recurrenceBadgeText}>🔄 {(task.recurrence_interval && task.recurrence_interval > 1)
                ? `Alle ${task.recurrence_interval} ${task.recurrence === 'daily' ? 'Tage' : task.recurrence === 'weekly' ? 'Wochen' : task.recurrence === 'monthly' ? 'Monate' : 'Jahre'}`
                : RECURRENCE_OPTIONS.find(r => r.key === task.recurrence)?.label}</Text>
            </View>
          )}
          {assignedMember && (
            <View style={[styles.assignBadge, { backgroundColor: assignedMember.avatar_color + '22' }]}>
              <Text style={[styles.assignBadgeText, { color: assignedMember.avatar_color }]}>{assignedMember.display_name[0]}</Text>
            </View>
          )}
          {task.location_url && <Text style={styles.taskMetaIcon}>📍</Text>}
          {task.attachment_path && <Text style={styles.taskMetaIcon}>📎</Text>}
        </View>
      </TouchableOpacity>
      <TouchableOpacity style={styles.deleteTaskBtn} onPress={() => onDelete(task.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Text style={styles.deleteTaskBtnText}>×</Text>
      </TouchableOpacity>
    </View>
    </Swipeable>
  );
}

// ─── TASK DETAIL MODAL ────────────────────────────────────────
function TaskDetailModal({ task, members, onClose, onComplete, onDelete, onEdit }: {
  task: (Task & { due_time?: string }) | null;
  members: any[];
  onClose: () => void;
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (task: Task) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  if (!task) return null;
  const isCompleted = !!task.completed_at;
  const assignedMember = members.find(m => m.id === task.assigned_to);
  const dateText = task.due_date ? format(parseISO(task.due_date), 'EEEE, d. MMMM yyyy', { locale: de }) : '—';
  const recurrenceText = task.recurrence
    ? (task.recurrence_interval && task.recurrence_interval > 1
        ? `Alle ${task.recurrence_interval} ${task.recurrence === 'daily' ? 'Tage' : task.recurrence === 'weekly' ? 'Wochen' : task.recurrence === 'monthly' ? 'Monate' : 'Jahre'}`
        : RECURRENCE_OPTIONS.find(r => r.key === task.recurrence)?.label)
    : null;

  const handleOpenAttachment = async () => {
    if (!task.attachment_path) return;
    const url = await getTaskAttachmentUrl(task.attachment_path);
    if (url) Linking.openURL(url);
    else Alert.alert('Fehler', 'Anhang konnte nicht geladen werden.');
  };

  return (
    <Modal visible={!!task} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)' }]} onPress={onClose} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.detailTitle}>{task.title}</Text>
            {task.description ? <Text style={styles.detailDesc}>{task.description}</Text> : null}

            <View style={styles.detailRow}><Text style={styles.detailLabel}>📂 Kategorie</Text><Text style={styles.detailValue}>{CATEGORY_EMOJIS[task.category] || '📋'} {task.category}</Text></View>
            <View style={styles.detailRow}><Text style={styles.detailLabel}>📅 Datum</Text><Text style={styles.detailValue}>{dateText}</Text></View>
            <View style={styles.detailRow}><Text style={styles.detailLabel}>🕐 Uhrzeit</Text><Text style={styles.detailValue}>{task.due_time ? `${task.due_time} Uhr` : 'Keine'}</Text></View>
            <View style={styles.detailRow}><Text style={styles.detailLabel}>⭐ Aufwand</Text><Text style={styles.detailValue}>{PRIORITY_LABELS[task.priority as Priority]} Pkt</Text></View>
            {recurrenceText && <View style={styles.detailRow}><Text style={styles.detailLabel}>🔄 Wiederholung</Text><Text style={styles.detailValue}>{recurrenceText}</Text></View>}
            {task.rotation && task.rotation.length > 1 && (
              <View style={styles.detailRow}><Text style={styles.detailLabel}>🔁 Reihum</Text><Text style={styles.detailValue}>{task.rotation.map(id => members.find(m => m.id === id)?.display_name ?? '?').join(' → ')}</Text></View>
            )}
            <View style={styles.detailRow}><Text style={styles.detailLabel}>👤 Zugewiesen</Text><Text style={styles.detailValue}>{assignedMember ? assignedMember.display_name : 'Alle'}</Text></View>

            {task.location_url && (
              <TouchableOpacity style={styles.attachmentBtn} onPress={() => Linking.openURL(task.location_url!)}>
                <Text style={styles.attachmentBtnText}>📍 Standort öffnen</Text>
              </TouchableOpacity>
            )}
            {task.attachment_path && (
              <TouchableOpacity style={styles.attachmentBtn} onPress={handleOpenAttachment}>
                <Text style={styles.attachmentBtnText} numberOfLines={1}>📎 {task.attachment_name || 'Anhang'} öffnen</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.saveBtn} onPress={() => { onComplete(task.id); onClose(); }}>
              <Text style={styles.saveBtnText}>{isCompleted ? 'Als offen markieren' : 'Erledigt ✓'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.detailEditBtn} onPress={() => onEdit(task)}>
              <Text style={styles.detailEditText}>✏️ Bearbeiten</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.detailDeleteBtn} onPress={() => { onClose(); onDelete(task.id); }}>
              <Text style={styles.detailDeleteText}>Löschen</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── CALENDAR VIEW ────────────────────────────────────────────
// ─── 7-DAY VIEW ───────────────────────────────────────────────
function WeekView({ tasks, onDayPress, selectedDate, mealPlans }: {
  tasks: Task[]; onDayPress: (date: Date) => void; selectedDate: Date | null; mealPlans: MealPlan[];
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const tasksByDate: Record<string, Task[]> = {};
  tasks.forEach(t => {
    if (t.due_date) {
      const key = t.due_date.substring(0, 10);
      if (!tasksByDate[key]) tasksByDate[key] = [];
      tasksByDate[key].push(t);
    }
  });

  const weekLabel = `${format(days[0], 'd. MMM', { locale: de })} – ${format(days[6], 'd. MMM yyyy', { locale: de })}`;

  return (
    <View style={styles.calendarContainer}>
      <View style={styles.monthNav}>
        <TouchableOpacity onPress={() => setWeekStart(d => addDays(d, -7))} style={styles.monthNavBtn}>
          <Text style={styles.monthNavIcon}>‹</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>
          <Text style={styles.monthTitle}>{weekLabel}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setWeekStart(d => addDays(d, 7))} style={styles.monthNavBtn}>
          <Text style={styles.monthNavIcon}>›</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.weekStrip}>
        {days.map(day => {
          const key = format(day, 'yyyy-MM-dd');
          const dayTasks = (tasksByDate[key] || []).filter(t => !t.completed_at);
          const hasMeal = mealPlans.some(m => m.planned_date === key);
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const isToday_ = isToday(day);

          const MAX_EMOJIS = 3;
          const allEvents: { emoji: string; color: string }[] = [
            ...dayTasks.map(t => ({ emoji: CATEGORY_EMOJIS[t.category || ''] || '📋', color: catColor(t.category) })),
            ...(hasMeal ? [{ emoji: '🍽️', color: '#FF6B35' }] : []),
          ];
          const visibleEvents = allEvents.slice(0, MAX_EMOJIS);
          const extraCount = allEvents.length - visibleEvents.length;

          return (
            <TouchableOpacity
              key={key}
              style={[styles.weekDayCol, isSelected && styles.weekDayColSelected]}
              onPress={() => onDayPress(day)}
              activeOpacity={0.7}
            >
              <Text style={[styles.weekDayName, isToday_ && { color: colors.brand }]}>
                {format(day, 'EEE', { locale: de }).slice(0, 2).toUpperCase()}
              </Text>
              <View style={[
                styles.weekDayNumWrap,
                isToday_ && !isSelected && styles.weekDayNumToday,
                isSelected && styles.weekDayNumSelected,
              ]}>
                <Text style={[
                  styles.weekDayNum,
                  isToday_ && !isSelected && { color: colors.brand },
                  isSelected && { color: '#fff' },
                ]}>
                  {format(day, 'd')}
                </Text>
              </View>
              <View style={styles.weekEmojiStack}>
                {visibleEvents.map((ev, i) => (
                  <View key={i} style={[styles.weekEmojiPill, { backgroundColor: ev.color + '26', borderColor: ev.color }]}>
                    <Text style={styles.weekTaskEmoji}>{ev.emoji}</Text>
                  </View>
                ))}
                {extraCount > 0 && (
                  <View style={styles.weekMoreBadge}>
                    <Text style={styles.weekMoreText}>+{extraCount}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ─── MONTH VIEW ───────────────────────────────────────────────
function CalendarView({ tasks, onDayPress, selectedDate, mealPlans }: {
  tasks: Task[]; onDayPress: (date: Date) => void; selectedDate: Date | null; mealPlans: MealPlan[];
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
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
          const barColors = [
            ...dayTasks.map(t => t.completed_at ? colors.textMuted : catColor(t.category)),
            ...(mealPlans.some(m => m.planned_date === key) ? ['#FF6B35'] : []),
          ];
          const visibleBars = barColors.slice(0, 3);
          const extraBars = barColors.length - visibleBars.length;
          return (
            <TouchableOpacity key={key} style={[styles.dayCell, isSelected && styles.dayCellSelected, isToday_ && !isSelected && styles.dayCellToday]} onPress={() => onDayPress(day)}>
              <Text style={[styles.dayNumber, !isCurrentMonth && { opacity: 0.3 }, isSelected && { color: '#fff' }, isToday_ && !isSelected && { color: colors.brand, fontWeight: '700' }]}>{format(day, 'd')}</Text>
              {barColors.length > 0 && (
                <View style={styles.dotRow}>
                  {visibleBars.map((c, i) => (
                    <View key={i} style={[styles.taskBarCal, { backgroundColor: c }, isSelected && { backgroundColor: 'rgba(255,255,255,0.85)' }]} />
                  ))}
                  {extraBars > 0 && <Text style={[styles.dayMoreText, isSelected && { color: '#fff' }]}>+{extraBars}</Text>}
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
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
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
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { household, currentMember, members, tasks, setTasks, completeTask, weekScores, loadWeekScores, items, setItems, themeId } = useStore();
  const activeTheme = APP_THEMES.find(t => t.id === themeId);
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [showModal, setShowModal] = useState(false);
  const [showQuickstart, setShowQuickstart] = useState(false);
  const [showTimeTreeLogin, setShowTimeTreeLogin] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [toastPoints, setToastPoints] = useState(0);
  const [showToast, setShowToast] = useState(false);
  const [showScoreboard, setShowScoreboard] = useState(false);
  const [showRewards, setShowRewards] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [monthScores, setMonthScores] = useState<Record<string, number>>({});

  // Deep-link from Home ("Anstehende Aufgaben"): jump to the task's date and open its
  // detail view, instead of completing it on a single tap. Handled once per taskId.
  const params = useLocalSearchParams<{ taskId?: string }>();
  const handledTaskParam = useRef<string | null>(null);
  useEffect(() => {
    if (!params.taskId || params.taskId === handledTaskParam.current) return;
    const found = tasks.find(t => t.id === params.taskId);
    if (!found) return;
    handledTaskParam.current = params.taskId;
    setSelectedTask(found);
    if (found.due_date) setSelectedDate(parseISO(found.due_date));
  }, [params.taskId, tasks]);

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
    const { data } = await supabase.from('tasks').insert({ ...rest, due_time: due_time || null, household_id: household.id, created_by: currentMember.id }).select().single();
    if (data) {
      setTasks([...tasks, data]);
      hapticNotification(Haptics.NotificationFeedbackType.Success);
      if (notify && data.due_date) await scheduleTaskNotification(data.id, data.title, data.due_date, due_time, data.remind_time);
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

  const handleSaveTask = async (taskData: Partial<Task> & { due_time?: string; notify?: boolean }) => {
    if (!editingTask) { await handleAddTask(taskData); return; }
    const { notify, due_time, ...rest } = taskData as any;
    const { data } = await supabase.from('tasks')
      .update({ ...rest, due_time: due_time || null })
      .eq('id', editingTask.id).select().single();
    if (data) setTasks(tasks.map(t => (t.id === editingTask.id ? data : t)));
    setEditingTask(null);
    hapticNotification(Haptics.NotificationFeedbackType.Success);
    if (notify && data?.due_date) await scheduleTaskNotification(data.id, data.title, data.due_date, due_time, data.remind_time);
  };

  // A recurring event's "date" is just its next upcoming occurrence, which shifts depending
  // on when you happen to (re-)import — so recurring events are matched by title+recurrence,
  // one-off events by title+date+time, to catch re-imports of the same .ics (or a repeated
  // Quickstart entry) as duplicates.
  const isDuplicateTask = (candidate: { title: string; date?: string; time?: string; recurrence?: string | null }): boolean => {
    const title = candidate.title.toLowerCase().trim();
    return tasks.some(t => {
      if (t.title.toLowerCase().trim() !== title) return false;
      if (candidate.recurrence) return t.recurrence === candidate.recurrence;
      return (t.due_date || null) === (candidate.date || null) && (t.due_time || null) === (candidate.time || null);
    });
  };

  const handleImportIcs = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      if (res.canceled || !res.assets?.[0]) return;
      const content = await new File(res.assets[0].uri).text();
      const parsed = parseICS(content);
      if (parsed.length === 0) { Alert.alert('Keine Termine', 'In der Datei wurden keine Termine gefunden. Erwartet wird eine .ics-Datei (z.B. Export aus Google Kalender).'); return; }

      const seen = new Set<string>();
      const events = parsed.filter(e => {
        if (isDuplicateTask(e)) return false;
        const key = `${e.title.toLowerCase().trim()}|${e.recurrence || e.date}|${e.time || ''}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      const skipped = parsed.length - events.length;

      if (events.length === 0) {
        Alert.alert('Schon importiert', `Alle ${parsed.length} Termine aus der Datei sind bereits im Kalender vorhanden — nichts Neues zu importieren.`);
        return;
      }

      const skippedNote = skipped > 0 ? ` (${skipped} bereits vorhanden, werden übersprungen)` : '';
      Alert.alert('Kalender importieren', `${events.length} neue Termine aus der Datei in den Heimlig-Kalender übernehmen?${skippedNote}`, [
        { text: 'Abbrechen', style: 'cancel' },
        { text: 'Importieren', onPress: async () => {
            if (!household || !currentMember) return;
            const rows = events.map(e => {
              const isBirthday = /geburtstag|glückwunsch/i.test(e.title);
              const desc = [e.location, e.description].filter(Boolean).join(' · ').slice(0, 300) || undefined;
              return {
                household_id: household.id,
                title: e.title,
                description: desc,
                category: isBirthday ? 'Geburtstag' : 'Sonstiges',
                priority: 'normal',
                points: 10,
                due_date: e.date,
                due_time: e.time || null,
                recurrence: e.recurrence || null,
                recurrence_interval: e.recurrence ? 1 : null,
                created_by: currentMember.id,
              };
            });
            const { data, error } = await supabase.from('tasks').insert(rows).select();
            if (error) { Alert.alert('Fehler', error.message); return; }
            if (data) setTasks([...tasks, ...data]);
            hapticNotification(Haptics.NotificationFeedbackType.Success);
            Alert.alert('✓ Importiert', `${data?.length ?? events.length} Termine wurden in den Kalender übernommen.`);
          } },
      ]);
    } catch (e: any) {
      Alert.alert('Fehler', e?.message ?? 'Import fehlgeschlagen.');
    }
  };

  const handleQuickstartSave = async (entries: QuickstartEntry[]) => {
    if (!household || !currentMember) return;
    const seen = new Set<string>();
    const fresh = entries.filter(e => {
      if (isDuplicateTask(e)) return false;
      const key = `${e.title.toLowerCase().trim()}|${e.recurrence || e.date}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const skipped = entries.length - fresh.length;
    if (fresh.length === 0) {
      setShowQuickstart(false);
      Alert.alert('Schon vorhanden', 'Alle eingegebenen Termine gibt es bereits im Kalender.');
      return;
    }
    const rows = fresh.map(e => {
      const isBirthday = /geburtstag|glückwunsch/i.test(e.title);
      return {
        household_id: household.id,
        title: e.title,
        category: isBirthday ? 'Geburtstag' : 'Sonstiges',
        priority: 'normal',
        points: 10,
        due_date: e.date || null,
        recurrence: e.recurrence || null,
        recurrence_interval: e.recurrence ? 1 : null,
        created_by: currentMember.id,
      };
    });
    const { data, error } = await supabase.from('tasks').insert(rows).select();
    if (error) { Alert.alert('Fehler', error.message); return; }
    if (data) setTasks([...tasks, ...data]);
    setShowQuickstart(false);
    hapticNotification(Haptics.NotificationFeedbackType.Success);
    const skippedNote = skipped > 0 ? ` (${skipped} gab es schon)` : '';
    Alert.alert('✓ Übernommen', `${data?.length ?? fresh.length} Termine wurden angelegt.${skippedNote}`);
  };

  const handleTimeTreeImport = async (email: string, password: string) => {
    if (!household || !currentMember) return;
    const { data, error } = await supabase.functions.invoke('timetree-import', {
      body: { household_id: household.id, email, password },
    });
    if (error) {
      let message = 'TimeTree-Import fehlgeschlagen.';
      try {
        const body = await (error as any).context?.json?.();
        if (body?.error) message = body.error;
      } catch { /* keep generic message */ }
      Alert.alert('Fehler', message);
      return;
    }

    const parsed: IcsEvent[] = data?.events || [];
    if (parsed.length === 0) {
      setShowTimeTreeLogin(false);
      Alert.alert('Keine Termine', 'In deinem TimeTree-Kalender wurden keine Termine gefunden.');
      return;
    }

    const seen = new Set<string>();
    const events = parsed.filter(e => {
      if (isDuplicateTask(e)) return false;
      const key = `${e.title.toLowerCase().trim()}|${e.recurrence || e.date}|${e.time || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const skipped = parsed.length - events.length;

    if (events.length === 0) {
      setShowTimeTreeLogin(false);
      Alert.alert('Schon importiert', `Alle ${parsed.length} Termine aus TimeTree sind bereits im Kalender vorhanden.`);
      return;
    }

    const rows = events.map(e => {
      const isBirthday = /geburtstag|glückwunsch/i.test(e.title);
      const desc = [e.location, e.description].filter(Boolean).join(' · ').slice(0, 300) || undefined;
      return {
        household_id: household.id,
        title: e.title,
        description: desc,
        category: isBirthday ? 'Geburtstag' : 'Sonstiges',
        priority: 'normal',
        points: 10,
        due_date: e.date,
        due_time: e.time || null,
        recurrence: e.recurrence || null,
        recurrence_interval: e.recurrence ? 1 : null,
        created_by: currentMember.id,
      };
    });
    const { data: inserted, error: insertError } = await supabase.from('tasks').insert(rows).select();
    if (insertError) { Alert.alert('Fehler', insertError.message); return; }
    if (inserted) setTasks([...tasks, ...inserted]);
    setShowTimeTreeLogin(false);
    hapticNotification(Haptics.NotificationFeedbackType.Success);
    const skippedNote = skipped > 0 ? ` (${skipped} bereits vorhanden)` : '';
    Alert.alert('✓ Importiert', `${inserted?.length ?? events.length} Termine aus TimeTree übernommen.${skippedNote}`);
  };

  const handleDelete = (id: string) => {
    const task = tasks.find(t => t.id === id);
    Alert.alert('Löschen', 'Aufgabe wirklich löschen?', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen', style: 'destructive', onPress: async () => {
          setTasks(tasks.filter(t => t.id !== id));
          await supabase.from('tasks').delete().eq('id', id);
          if (task?.attachment_path) deleteTaskAttachment(task.attachment_path);
        }
      }
    ]);
  };

  const availableYears = useMemo(() => {
    const years = new Set<number>([new Date().getFullYear()]);
    tasks.forEach(t => { if (t.due_date) years.add(parseISO(t.due_date).getFullYear()); });
    return Array.from(years).sort();
  }, [tasks]);

  const filteredTasks = tasks.filter(t => {
    if (!showCompleted && t.completed_at) return false;
    if (filterCategory && t.category !== filterCategory) return false;
    if (selectedDate && viewMode !== 'list') return t.due_date && isSameDay(parseISO(t.due_date), selectedDate);
    if (!selectedDate && t.due_date && parseISO(t.due_date).getFullYear() !== selectedYear) return false;
    return true;
  });

  const openTasks = filteredTasks.filter(t => !t.completed_at);
  const openTasksWithDate = openTasks.filter(t => t.due_date);
  const openTasksNoDate = openTasks.filter(t => !t.due_date);
  const completedTasks = filteredTasks.filter(t => !!t.completed_at);
  const overdueTasks = tasks.filter(t => t.due_date && !t.completed_at && isBefore(parseISO(t.due_date), new Date()) && !isToday(parseISO(t.due_date)));
  const myScore = monthScores[currentMember?.id ?? ''] || 0;
  const topScore = Math.max(0, ...members.map(m => monthScores[m.id] || 0));
  const isLeading = myScore > 0 && myScore >= topScore;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Text style={styles.headerTitle}>📋 Aufgaben</Text>
            <ThemeMotif />
          </View>
          <Text style={styles.headerSub}>{openTasks.length} offen{overdueTasks.length > 0 ? ` · ${overdueTasks.length} überfällig` : ''}</Text>
        </View>
        {gamificationOn && (
          <TouchableOpacity style={[styles.scoreBadge, isLeading && styles.scoreBadgeLeading]} onPress={() => setShowScoreboard(true)}>
            <Text style={styles.scoreBadgeText}>{isLeading ? '👑' : '🏆'} {myScore}</Text>
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.toolbarRow}>
        <View style={styles.toolbarLeft}>
          {gamificationOn && (
            <TouchableOpacity style={styles.importBtn} onPress={() => setShowRewards(true)}>
              <Text style={styles.viewToggleText}>🎁</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.importBtn} onPress={handleImportIcs}>
            <Text style={styles.viewToggleText}>📥</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.importBtn} onPress={() => setShowQuickstart(true)}>
            <Text style={styles.viewToggleText}>🔄</Text>
          </TouchableOpacity>
          {household?.timetree_import_enabled && (
            <TouchableOpacity style={styles.importBtn} onPress={() => setShowTimeTreeLogin(true)}>
              <Text style={styles.viewToggleText}>🔗</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.viewToggle}>
          <TouchableOpacity style={[styles.viewToggleBtn, viewMode === 'week' && styles.viewToggleBtnActive]} onPress={() => { setViewMode('week'); setSelectedDate(null); }}>
            <Text style={styles.viewToggleText}>📅</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.viewToggleBtn, viewMode === 'month' && styles.viewToggleBtnActive]} onPress={() => { setViewMode('month'); setSelectedDate(null); }}>
            <Text style={styles.viewToggleText}>📆</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.viewToggleBtn, viewMode === 'list' && styles.viewToggleBtnActive]} onPress={() => setViewMode('list')}>
            <Text style={styles.viewToggleText}>☰</Text>
          </TouchableOpacity>
        </View>
      </View>

      {overdueTasks.length > 0 && (
        <View style={styles.overdueBanner}>
          <Text style={styles.overdueBannerText}>⚠️ {overdueTasks.length} überfällige Aufgabe{overdueTasks.length > 1 ? 'n' : ''}</Text>
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false}>
        {viewMode === 'week' && (
          <WeekView tasks={tasks} selectedDate={selectedDate} mealPlans={mealPlans} onDayPress={(day) => setSelectedDate(isSameDay(day, selectedDate || new Date(-1)) ? null : day)} />
        )}
        {viewMode === 'month' && (
          <CalendarView tasks={tasks} selectedDate={selectedDate} mealPlans={mealPlans} onDayPress={(day) => setSelectedDate(isSameDay(day, selectedDate || new Date(-1)) ? null : day)} />
        )}

        {availableYears.length > 1 && !selectedDate && (
          <View style={styles.yearNav}>
            <TouchableOpacity onPress={() => { const i = availableYears.indexOf(selectedYear); if (i > 0) setSelectedYear(availableYears[i - 1]); }} style={styles.yearNavBtn}>
              <Text style={styles.yearNavArrow}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.yearNavText}>{selectedYear}</Text>
            <TouchableOpacity onPress={() => { const i = availableYears.indexOf(selectedYear); if (i < availableYears.length - 1) setSelectedYear(availableYears[i + 1]); }} style={styles.yearNavBtn}>
              <Text style={styles.yearNavArrow}>›</Text>
            </TouchableOpacity>
          </View>
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
              {!selectedDate && activeTheme?.illustrations?.tasksEmpty ? (
                <Image source={activeTheme.illustrations.tasksEmpty} style={styles.emptyIllustration} resizeMode="contain" />
              ) : (
                <Text style={styles.emptyEmoji}>{selectedDate ? '✨' : '🎉'}</Text>
              )}
              <Text style={styles.emptyTitle}>{selectedDate ? 'Kein Plan für diesen Tag' : 'Alles erledigt!'}</Text>
              <Text style={styles.emptyBody}>{selectedDate ? 'Tippe auf + Aufgabe.' : 'Genieß den freien Tag. 🌿'}</Text>
            </View>
          )}
          {selectedDate || openTasksNoDate.length === 0 || openTasksWithDate.length === 0 ? (
            openTasks.map(task => <TaskCard key={task.id} task={task as any} onComplete={handleComplete} onDelete={handleDelete} members={members} showPoints={gamificationOn} onOpen={setSelectedTask} />)
          ) : (
            <>
              <Text style={styles.taskSectionLabel}>Termine ({openTasksWithDate.length})</Text>
              {openTasksWithDate.map(task => <TaskCard key={task.id} task={task as any} onComplete={handleComplete} onDelete={handleDelete} members={members} showPoints={gamificationOn} onOpen={setSelectedTask} />)}
              <Text style={styles.taskSectionLabel}>Ohne Datum ({openTasksNoDate.length})</Text>
              {openTasksNoDate.map(task => <TaskCard key={task.id} task={task as any} onComplete={handleComplete} onDelete={handleDelete} members={members} showPoints={gamificationOn} onOpen={setSelectedTask} />)}
            </>
          )}
          {completedTasks.length > 0 && (
            <>
              <TouchableOpacity style={styles.completedHeader} onPress={() => setShowCompleted(v => !v)}>
                <Text style={styles.completedHeaderText}>✓ Erledigt ({completedTasks.length})</Text>
                <Text style={styles.completedToggle}>{showCompleted ? '▲' : '▼'}</Text>
              </TouchableOpacity>
              {showCompleted && completedTasks.map(task => <TaskCard key={task.id} task={task as any} onComplete={handleComplete} onDelete={handleDelete} members={members} showPoints={gamificationOn} onOpen={setSelectedTask} />)}
            </>
          )}
        </View>
        <View style={{ height: 100 }} />
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={() => setShowModal(true)}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <PointsToast points={toastPoints} visible={showToast} />

      <TaskDetailModal
        task={selectedTask as any}
        members={members}
        onClose={() => setSelectedTask(null)}
        onComplete={handleComplete}
        onDelete={handleDelete}
        onEdit={(t) => { setSelectedTask(null); setEditingTask(t); }}
      />

      {gamificationOn && household && (
        <Scoreboard
          visible={showScoreboard}
          onClose={() => setShowScoreboard(false)}
          householdId={household.id}
          members={members}
          currentMemberId={currentMember?.id}
        />
      )}

      <RewardsModal visible={showRewards} onClose={() => setShowRewards(false)} />

      <AddTaskModal
        visible={showModal || !!editingTask}
        onClose={() => { setShowModal(false); setEditingTask(null); }}
        onSave={handleSaveTask}
        members={members}
        preselectedDate={selectedDate}
        editTask={editingTask}
        householdId={household?.id}
      />
      <TimeTreeQuickstartModal
        visible={showQuickstart}
        onClose={() => setShowQuickstart(false)}
        onSave={handleQuickstartSave}
      />
      {household?.timetree_import_enabled && (
        <TimeTreeLoginModal
          visible={showTimeTreeLogin}
          onClose={() => setShowTimeTreeLogin(false)}
          onImport={handleTimeTreeImport}
        />
      )}
    </SafeAreaView>
  );
}

function makeStyles(colors: ColorPalette) { return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { ...typography.h2, color: colors.text },
  headerSub: { ...typography.sm, color: colors.textSecondary, marginTop: 2 },
  toolbarRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  toolbarLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  scoreBadge: { backgroundColor: colors.brandPale, borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  scoreBadgeLeading: { backgroundColor: '#FEF3C7' },
  scoreBadgeText: { ...typography.xs, color: colors.brand, fontWeight: '800' },
  importBtn: { backgroundColor: colors.background, borderRadius: radius.md, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, borderWidth: 1, borderColor: colors.border },
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
  weekStrip: { flexDirection: 'row' },
  weekDayCol: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radius.md, minHeight: 110 },
  weekDayColSelected: { backgroundColor: colors.brandPale },
  weekDayName: { ...typography.xs, color: colors.textMuted, fontWeight: '700', letterSpacing: 0.3, marginBottom: 3 },
  weekDayNumWrap: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs },
  weekDayNumToday: { backgroundColor: colors.brandPale },
  weekDayNumSelected: { backgroundColor: colors.brand },
  weekDayNum: { ...typography.sm, color: colors.text, fontWeight: '700' },
  weekEmojiStack: { alignItems: 'center', gap: 2 },
  weekEmojiPill: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 3, paddingVertical: 1, alignItems: 'center', minWidth: 26 },
  weekTaskEmoji: { fontSize: 17, lineHeight: 22 },
  weekMoreBadge: { backgroundColor: colors.border, borderRadius: radius.full, paddingHorizontal: 5, paddingVertical: 1, marginTop: 2 },
  weekMoreText: { ...typography.xs, color: colors.textSecondary, fontWeight: '700' },
  weekdayRow: { flexDirection: 'row', marginBottom: spacing.sm },
  weekdayLabel: { flex: 1, textAlign: 'center', ...typography.xs, color: colors.textMuted, fontWeight: '700', textTransform: 'uppercase' },
  daysGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: '14.28%', alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radius.sm },
  dayCellSelected: { backgroundColor: colors.brand },
  dayCellToday: { backgroundColor: colors.brandPale },
  dayNumber: { ...typography.sm, color: colors.text, fontWeight: '500' },
  dotRow: { width: '100%', alignItems: 'center', marginTop: 4, gap: 2 },
  taskBarCal: { width: '65%', height: 3, borderRadius: 1.5 },
  dayMoreText: { fontSize: 8, lineHeight: 10, color: colors.textMuted, fontWeight: '700', marginTop: 1 },
  yearNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.sm, gap: spacing.lg },
  yearNavBtn: { padding: spacing.sm },
  yearNavArrow: { fontSize: 22, color: colors.brand, fontWeight: '600', lineHeight: 24 },
  yearNavText: { ...typography.h3, color: colors.text, minWidth: 52, textAlign: 'center' },
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
  taskMetaIcon: { fontSize: 12 },
  taskCatChip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  taskCatEmoji: { fontSize: 13 },
  taskCatLabel: { ...typography.xs, fontWeight: '600' },
  dueBadge: { backgroundColor: '#F0FDF4', borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  dueBadgeText: { ...typography.xs, color: colors.brand, fontWeight: '600' },
  recurrenceBadge: { backgroundColor: colors.brandPale, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  recurrenceBadgeText: { ...typography.xs, color: colors.brand, fontWeight: '600' },
  assignBadge: { borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  assignBadgeText: { ...typography.xs, fontWeight: '700' },
  deleteTaskBtn: { padding: spacing.md },
  deleteTaskBtnText: { fontSize: 20, color: colors.textMuted },
  swipeAction: { justifyContent: 'center', alignItems: 'center', width: 68, marginBottom: spacing.sm, borderRadius: radius.md },
  swipeActionText: { fontSize: 22, color: '#fff' },
  taskSectionLabel: { ...typography.label, color: colors.textMuted, textTransform: 'uppercase', paddingHorizontal: spacing.sm, marginTop: spacing.md, marginBottom: spacing.xs },
  completedHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, marginTop: spacing.sm },
  completedHeaderText: { ...typography.label, color: colors.textSecondary },
  completedToggle: { ...typography.xs, color: colors.textMuted },
  emptyState: { alignItems: 'center', paddingTop: 48, paddingBottom: 24 },
  emptyEmoji: { fontSize: 52, marginBottom: spacing.md },
  emptyIllustration: { width: 240, height: 160, marginBottom: spacing.md },
  emptyTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.sm },
  emptyBody: { ...typography.sm, color: colors.textSecondary, textAlign: 'center' },
  fab: { position: 'absolute', right: spacing.lg, bottom: spacing.xl, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', ...shadow.lg },
  fabText: { color: '#fff', fontSize: 28, lineHeight: 30, fontWeight: '300' },
  pointsToast: { position: 'absolute', bottom: 100, alignSelf: 'center', backgroundColor: colors.brand, borderRadius: radius.full, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, ...shadow.lg },
  pointsToastText: { color: '#fff', fontWeight: '800', fontSize: 18 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
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
  timeDropdownCol: { flex: 1, maxHeight: 220 },
  timeDropdownDivider: { width: 1, backgroundColor: colors.borderLight },
  timeDropdownItem: { alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  timeDropdownItemActive: { backgroundColor: colors.brand },
  timeDropdownText: { ...typography.body, color: colors.text },
  timeDropdownDone: { padding: spacing.sm, alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.borderLight },
  timeDropdownDoneText: { ...typography.sm, color: colors.brand, fontWeight: '700' },
  notifyToggle: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, marginBottom: spacing.md, backgroundColor: colors.surface },
  notifyToggleActive: { borderColor: colors.brand, backgroundColor: colors.brandPale },
  notifyToggleEmoji: { fontSize: 24 },
  notifyToggleText: { ...typography.sm, color: colors.textSecondary, fontWeight: '600' },
  notifyToggleSub: { ...typography.xs, color: colors.textMuted, marginTop: 2 },
  fieldLabel: { ...typography.label, color: colors.textMuted, marginBottom: spacing.sm },
  rotationHint: { ...typography.xs, color: colors.textSecondary, marginBottom: spacing.sm, marginTop: -spacing.xs },
  detailTitle: { ...typography.h2, color: colors.text, marginBottom: spacing.sm },
  detailDesc: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.lg },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  detailLabel: { ...typography.sm, color: colors.textSecondary, fontWeight: '600' },
  detailValue: { ...typography.body, color: colors.text, fontWeight: '600', flexShrink: 1, textAlign: 'right', marginLeft: spacing.md },
  detailEditBtn: { padding: spacing.md, alignItems: 'center', marginTop: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  detailEditText: { ...typography.body, color: colors.text, fontWeight: '600' },
  attachmentBtn: { padding: spacing.md, alignItems: 'center', marginTop: spacing.sm, borderRadius: radius.md, backgroundColor: colors.brandPale },
  attachmentBtnText: { ...typography.body, color: colors.brand, fontWeight: '700' },
  attachmentRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.background, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  attachmentRowText: { ...typography.body, color: colors.text, flex: 1, marginRight: spacing.sm },
  attachmentRemove: { ...typography.body, color: colors.textMuted, fontWeight: '700' },
  detailDeleteBtn: { padding: spacing.md, alignItems: 'center', marginTop: spacing.xs },
  detailDeleteText: { ...typography.body, color: colors.error, fontWeight: '600' },
  chipRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  intervalRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
  intervalLabel: { ...typography.sm, color: colors.textSecondary, fontWeight: '600' },
  intervalBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  intervalBtnText: { fontSize: 20, color: colors.brand, fontWeight: '800' },
  intervalValue: { ...typography.body, color: colors.text, fontWeight: '800', minWidth: 28, textAlign: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.border, marginRight: spacing.sm, backgroundColor: colors.surface },
  chipEmoji: { fontSize: 14 },
  chipText: { ...typography.sm, color: colors.textSecondary, fontWeight: '600' },
  saveBtn: { backgroundColor: colors.brand, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', marginTop: spacing.sm },
  saveBtnText: { ...typography.body, color: '#fff', fontWeight: '700' },
}); }
