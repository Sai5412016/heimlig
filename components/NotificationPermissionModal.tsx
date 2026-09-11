// components/NotificationPermissionModal.tsx — explains what notifications are for BEFORE the
// Android system dialog appears.
//
// Why this exists: registerPushToken used to trigger the system dialog from activateHousehold(),
// i.e. in the middle of the launch sequence, with nothing on screen saying what it was for.
// 7 members across 6 households denied it, and on Android a denial is effectively permanent —
// the dialog never comes back, only system settings can undo it. So the ask now happens once, at
// a moment the user has just asked to be reminded about something, and it says why first.
//
// Two modes:
//   - can still ask  → primary button opens the system dialog
//   - already denied → no dialog is possible any more, so the button goes to system settings
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, TouchableOpacity, Linking, ActivityIndicator, AppState } from 'react-native';
import { useTranslation } from 'react-i18next';
import { spacing, radius, typography, shadow, type ColorPalette } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { requestNotificationPermission, hasNotificationPermission, canAskForNotificationPermission } from '../lib/notifications';

export default function NotificationPermissionModal({
  visible, onClose, onResult, deniedForever: initialDeniedForever = false,
}: {
  visible: boolean;
  onClose: () => void;
  // Called with whether permission ended up granted. The caller decides what to do next (e.g.
  // schedule the reminder that triggered this).
  onResult?: (granted: boolean) => void;
  // Only an initial hint from the caller, read before this modal opened — re-verified inside the
  // modal itself too, see refreshPermissionStatus below (same reasoning as DeviceCalendarModal).
  deniedForever?: boolean;
}) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [busy, setBusy] = useState(false);
  const [deniedForever, setDeniedForever] = useState(initialDeniedForever);

  // Reads the OS permission directly rather than trusting a value from before the modal opened
  // or from before the user left for Settings. If it turns out already granted — most likely the
  // user just enabled it from Settings while this modal sat open — there is nothing left to ask,
  // so this closes the modal exactly like a successful in-app tap on "Enable" does below.
  const refreshPermissionStatus = useCallback(async () => {
    const granted = await hasNotificationPermission();
    if (granted) {
      onResult?.(true);
      onClose();
      return;
    }
    setDeniedForever(!(await canAskForNotificationPermission()));
  }, [onResult, onClose]);

  // Fixes a dead end: leaving this modal open, granting the permission from Android Settings and
  // coming back never used to update anything here — `visible` doesn't toggle (the modal was
  // never closed) and the caller's prop is stale, so "denied forever, open settings" could stick
  // around until a full app restart. AppState 'active' fires exactly on that return.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active' && visible) refreshPermissionStatus();
    });
    return () => sub.remove();
  }, [visible, refreshPermissionStatus]);

  // Re-checks every time the modal opens instead of trusting what the caller remembered from
  // before — the prop still seeds state synchronously so the right screen shows immediately.
  useEffect(() => {
    if (!visible) return;
    setDeniedForever(initialDeniedForever);
    refreshPermissionStatus();
  }, [visible, initialDeniedForever, refreshPermissionStatus]);

  const handleEnable = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const granted = await requestNotificationPermission();
      onResult?.(granted);
    } finally {
      setBusy(false);
      onClose();
    }
  };

  const handleOpenSettings = async () => {
    try { await Linking.openSettings(); } catch { /* nothing sensible to do if the OS refuses */ }
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.emoji}>🔔</Text>
          <Text style={styles.title}>{t('notifPermission.title')}</Text>
          <Text style={styles.body}>{t('notifPermission.body')}</Text>

          <View style={styles.reasons}>
            <View style={styles.reasonRow}>
              <Text style={styles.reasonEmoji}>💬</Text>
              <Text style={styles.reasonText}>{t('notifPermission.reasonPinboard')}</Text>
            </View>
            <View style={styles.reasonRow}>
              <Text style={styles.reasonEmoji}>⏰</Text>
              <Text style={styles.reasonText}>{t('notifPermission.reasonReminders')}</Text>
            </View>
          </View>

          {deniedForever ? (
            <>
              <Text style={styles.deniedHint}>{t('notifPermission.deniedHint')}</Text>
              <TouchableOpacity style={styles.primaryBtn} onPress={handleOpenSettings}>
                <Text style={styles.primaryBtnText}>{t('notifPermission.openSettingsButton')}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity style={[styles.primaryBtn, busy && styles.primaryBtnBusy]} onPress={handleEnable} disabled={busy}>
              {busy
                ? <ActivityIndicator color={colors.textInverse} />
                : <Text style={styles.primaryBtnText}>{t('notifPermission.enableButton')}</Text>}
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.secondaryBtn} onPress={onClose}>
            <Text style={styles.secondaryBtnText}>{t('notifPermission.laterButton')}</Text>
          </TouchableOpacity>
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
  handle: { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.lg },
  emoji: { fontSize: 44, textAlign: 'center', marginBottom: spacing.sm },
  title: { ...typography.h2, color: colors.text, textAlign: 'center' },
  body: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xs, marginBottom: spacing.lg },
  reasons: { marginBottom: spacing.lg, gap: spacing.md },
  reasonRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  reasonEmoji: { fontSize: 22, width: 30, textAlign: 'center' },
  reasonText: { flex: 1, ...typography.body, color: colors.text },
  deniedHint: { ...typography.sm, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.md },
  primaryBtn: { backgroundColor: colors.brand, borderRadius: radius.md, padding: spacing.md, alignItems: 'center' },
  primaryBtnBusy: { opacity: 0.7 },
  primaryBtnText: { ...typography.body, color: colors.textInverse, fontWeight: '700' },
  secondaryBtn: { padding: spacing.md, alignItems: 'center', marginTop: spacing.xs },
  secondaryBtnText: { ...typography.body, color: colors.textSecondary },
}); }
