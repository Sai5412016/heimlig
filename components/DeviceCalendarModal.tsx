// components/DeviceCalendarModal.tsx — import events from the OS Calendar app (expo-calendar),
// read-only. Counterpart to GoogleCalendarModal, but native-only and without an export/write
// direction (see app.json: WRITE_CALENDAR is deliberately blocked).
//
// Two screens in one modal, same "explain before the system dialog" shape as
// NotificationPermissionModal: `granted` starts as whatever the caller already knows (household.tsx
// checks it BEFORE opening this modal, without prompting) — if that's false, the user sees why
// Heimlig wants this and taps a button themselves before anything native happens. Only that tap
// calls requestCalendarPermission(), which is the only place the system dialog can appear from.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, TouchableOpacity, Linking, ActivityIndicator, ScrollView, AppState } from 'react-native';
import { Alert } from '../lib/alert';
import { useTranslation } from 'react-i18next';
import { spacing, radius, typography, shadow, type ColorPalette } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { useStore } from '../store/useStore';
import {
  hasCalendarPermission, canAskForCalendarPermission, requestCalendarPermission,
  getDeviceCalendars, listDeviceCalendarEvents, type DeviceCalendarInfo,
} from '../lib/deviceCalendar';

export default function DeviceCalendarModal({
  visible, onClose, granted: initialGranted, deniedForever: initialDeniedForever,
}: {
  visible: boolean;
  onClose: () => void;
  // Read (not requested) by the caller right before opening — see household.tsx's
  // handleDeviceCalendarRow(). Only an initial hint: the OS permission can change under us at
  // any time (the user can leave for Settings and back without ever closing this modal), so it's
  // re-verified inside the modal itself too — see refreshPermissionStatus below.
  granted: boolean;
  deniedForever: boolean;
}) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { importDeviceCalendarEvents } = useStore();

  const [granted, setGranted] = useState(initialGranted);
  const [deniedForever, setDeniedForever] = useState(initialDeniedForever);
  const [requesting, setRequesting] = useState(false);
  const [calendars, setCalendars] = useState<DeviceCalendarInfo[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loadingCalendars, setLoadingCalendars] = useState(false);
  const [importing, setImporting] = useState(false);

  // The actual source of truth — reads the OS permission directly rather than trusting whatever
  // was last known (a prop from before this modal opened, or state from before the user left for
  // Settings). Never opens the system dialog itself, so it's safe to call as often as needed.
  const refreshPermissionStatus = useCallback(async () => {
    const has = await hasCalendarPermission();
    setGranted(has);
    setDeniedForever(has ? false : !(await canAskForCalendarPermission()));
  }, []);

  // Fixes a dead end: if the user leaves this modal open, grants calendar access from Android
  // Settings (e.g. via the "Einstellungen öffnen" button below) and comes back, nothing before
  // this listener ever told the app the permission changed — `visible` never toggles (the modal
  // was never closed) and the caller's props are stale, so the "access denied" screen used to
  // stick around until a full app restart. AppState 'active' fires exactly on that return.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active' && visible) refreshPermissionStatus();
    });
    return () => sub.remove();
  }, [visible, refreshPermissionStatus]);

  // Re-checks every time the modal opens rather than trusting a value the caller remembered from
  // before — same freshness reasoning as the AppState listener above, just for the "closed this
  // modal, changed the permission elsewhere, reopened it" path instead of the "left and came
  // back without closing it" path. The props still seed state synchronously so the correct
  // screen shows immediately, before this async check resolves.
  useEffect(() => {
    if (!visible) return;
    setGranted(initialGranted);
    setDeniedForever(initialDeniedForever);
    refreshPermissionStatus();
  }, [visible, initialGranted, initialDeniedForever, refreshPermissionStatus]);

  useEffect(() => {
    if (!visible || !granted) return;
    setLoadingCalendars(true);
    getDeviceCalendars().then(cals => {
      setCalendars(cals);
      setSelected(new Set(cals.map(c => c.id)));
    }).finally(() => setLoadingCalendars(false));
  }, [visible, granted]);

  const handleAllow = async () => {
    if (requesting) return;
    setRequesting(true);
    try {
      const ok = await requestCalendarPermission();
      setGranted(ok);
    } finally {
      setRequesting(false);
    }
  };

  const handleOpenSettings = async () => {
    try { await Linking.openSettings(); } catch { /* nothing sensible to do if the OS refuses */ }
    onClose();
  };

  const toggleCalendar = (id: string) => {
    setSelected(s => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleImport = async () => {
    if (importing || selected.size === 0) return;
    setImporting(true);
    try {
      const events = await listDeviceCalendarEvents(Array.from(selected), 60);
      const n = await importDeviceCalendarEvents(events);
      Alert.alert(t('deviceCal.importedTitle'), n > 0 ? t(n === 1 ? 'deviceCal.importedBody_one' : 'deviceCal.importedBody_other', { count: n }) : t('deviceCal.noNewEvents'));
      onClose();
    } catch {
      Alert.alert(t('common.error'), t('deviceCal.importFailedBody'));
    } finally {
      setImporting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.emoji}>{t('deviceCal.permissionEmoji')}</Text>

          {!granted ? (
            <>
              <Text style={styles.title}>{t('deviceCal.permissionTitle')}</Text>
              <Text style={styles.body}>{t('deviceCal.permissionBody')}</Text>

              <View style={styles.reasons}>
                <View style={styles.reasonRow}>
                  <Text style={styles.reasonEmoji}>🔒</Text>
                  <Text style={styles.reasonText}>{t('deviceCal.reasonReadOnly')}</Text>
                </View>
                <View style={styles.reasonRow}>
                  <Text style={styles.reasonEmoji}>♻️</Text>
                  <Text style={styles.reasonText}>{t('deviceCal.reasonNoDuplicates')}</Text>
                </View>
              </View>

              {deniedForever ? (
                <>
                  <Text style={styles.deniedHint}>{t('deviceCal.deniedHint')}</Text>
                  <TouchableOpacity style={styles.primaryBtn} onPress={handleOpenSettings}>
                    <Text style={styles.primaryBtnText}>{t('deviceCal.openSettingsButton')}</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity style={[styles.primaryBtn, requesting && styles.primaryBtnBusy]} onPress={handleAllow} disabled={requesting}>
                  {requesting
                    ? <ActivityIndicator color={colors.textInverse} />
                    : <Text style={styles.primaryBtnText}>{t('deviceCal.allowButton')}</Text>}
                </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.secondaryBtn} onPress={onClose}>
                <Text style={styles.secondaryBtnText}>{t('deviceCal.laterButton')}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.title}>{t('deviceCal.pickTitle')}</Text>
              <Text style={styles.body}>{t('deviceCal.pickBody')}</Text>

              {loadingCalendars ? (
                <ActivityIndicator color={colors.brand} style={{ marginVertical: spacing.lg }} />
              ) : calendars.length === 0 ? (
                <Text style={styles.body}>{t('deviceCal.noCalendars')}</Text>
              ) : (
                <ScrollView style={styles.calendarList}>
                  {calendars.map(cal => {
                    const checked = selected.has(cal.id);
                    return (
                      <TouchableOpacity key={cal.id} style={styles.calendarRow} onPress={() => toggleCalendar(cal.id)}>
                        <View style={[styles.checkbox, checked && { backgroundColor: cal.color || colors.brand, borderColor: cal.color || colors.brand }]}>
                          {checked && <Text style={styles.checkmark}>✓</Text>}
                        </View>
                        <Text style={styles.calendarTitle} numberOfLines={1}>{cal.title}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}

              <TouchableOpacity
                style={[styles.primaryBtn, (importing || selected.size === 0) && styles.primaryBtnBusy]}
                onPress={handleImport}
                disabled={importing || selected.size === 0}
              >
                {importing
                  ? <ActivityIndicator color={colors.textInverse} />
                  : <Text style={styles.primaryBtnText}>{t('deviceCal.importButton')}</Text>}
              </TouchableOpacity>
              <Text style={styles.hint}>{t('deviceCal.importHint')}</Text>

              <TouchableOpacity style={styles.secondaryBtn} onPress={onClose}>
                <Text style={styles.secondaryBtnText}>{t('common.close')}</Text>
              </TouchableOpacity>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function makeStyles(colors: ColorPalette) { return StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    padding: spacing.lg, paddingBottom: spacing.xxl, ...shadow.lg,
  },
  handle: { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.md },
  emoji: { fontSize: 44, textAlign: 'center', marginBottom: spacing.sm },
  title: { ...typography.h2, color: colors.text, textAlign: 'center' },
  body: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xs, marginBottom: spacing.md },
  reasons: { marginBottom: spacing.lg, gap: spacing.md },
  reasonRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  reasonEmoji: { fontSize: 22, width: 30, textAlign: 'center' },
  reasonText: { flex: 1, ...typography.body, color: colors.text },
  deniedHint: { ...typography.sm, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.md },
  primaryBtn: { backgroundColor: colors.brand, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', marginTop: spacing.sm },
  primaryBtnBusy: { opacity: 0.6 },
  primaryBtnText: { ...typography.body, color: colors.textInverse, fontWeight: '700' },
  hint: { ...typography.xs, color: colors.textMuted, marginTop: spacing.xs, textAlign: 'center' },
  secondaryBtn: { padding: spacing.md, alignItems: 'center', marginTop: spacing.xs },
  secondaryBtnText: { ...typography.body, color: colors.textSecondary },
  calendarList: { maxHeight: 260, marginBottom: spacing.sm },
  calendarRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, gap: spacing.md },
  checkbox: { width: 22, height: 22, borderRadius: radius.sm, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  checkmark: { color: '#fff', fontSize: 14, fontWeight: '700' },
  calendarTitle: { flex: 1, ...typography.body, color: colors.text },
}); }
