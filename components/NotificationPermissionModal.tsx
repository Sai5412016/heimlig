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
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, TouchableOpacity, Linking, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { spacing, radius, typography, shadow, type ColorPalette } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { requestNotificationPermission } from '../lib/notifications';

export default function NotificationPermissionModal({
  visible, onClose, onResult, deniedForever = false,
}: {
  visible: boolean;
  onClose: () => void;
  // Called with whether permission ended up granted. The caller decides what to do next (e.g.
  // schedule the reminder that triggered this).
  onResult?: (granted: boolean) => void;
  // True when the OS will no longer show a dialog — the only remaining route is system settings.
  deniedForever?: boolean;
}) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [busy, setBusy] = useState(false);

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
