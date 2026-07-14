// components/GoogleCalendarModal.tsx — connect a Google account and sync tasks ⇄ Google Calendar.
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Pressable, ActivityIndicator, Platform } from 'react-native';
import { Alert } from '../lib/alert';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../hooks/useTheme';
import { spacing, radius, typography, type ColorPalette } from '../constants/theme';
import { useStore } from '../store/useStore';
import { GOOGLE_OAUTH } from '../constants/google';
import { listUpcomingEvents } from '../lib/googleCalendar';

WebBrowser.maybeCompleteAuthSession();

export default function GoogleCalendarModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { importGoogleEvents, exportTasksToGoogle } = useStore();
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | 'import' | 'export'>(null);

  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: GOOGLE_OAUTH.webClientId,
    androidClientId: GOOGLE_OAUTH.androidClientId,
    scopes: GOOGLE_OAUTH.scopes,
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const t = response.authentication?.accessToken;
      if (t) setToken(t);
    } else if (response?.type === 'error') {
      Alert.alert(t('gcal.connectFailedTitle'), t('gcal.tryAgain'));
    }
  }, [response]);

  const connect = () => promptAsync();

  const handleImport = async () => {
    if (!token) return;
    setBusy('import');
    try {
      const events = await listUpcomingEvents(token, 60);
      const n = await importGoogleEvents(events);
      Alert.alert(t('gcal.importedTitle'), n > 0 ? t(n === 1 ? 'gcal.importedBody_one' : 'gcal.importedBody_other', { count: n }) : t('gcal.noNewEvents'));
    } catch {
      Alert.alert(t('common.error'), t('gcal.importFailedBody'));
      setToken(null);
    } finally { setBusy(null); }
  };

  const handleExport = async () => {
    if (!token) return;
    setBusy('export');
    try {
      const n = await exportTasksToGoogle(token);
      Alert.alert(t('gcal.exportedTitle'), n > 0 ? t(n === 1 ? 'gcal.exportedBody_one' : 'gcal.exportedBody_other', { count: n }) : t('gcal.noNewTasks'));
    } catch {
      Alert.alert(t('common.error'), t('gcal.exportFailedBody'));
      setToken(null);
    } finally { setBusy(null); }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>{t('gcal.title')}</Text>

          {Platform.OS !== 'web' ? (
            <Text style={styles.body}>{t('gcal.webOnlyBody')}</Text>
          ) : !token ? (
            <>
              <Text style={styles.body}>{t('gcal.connectBody')}</Text>
              <TouchableOpacity style={[styles.primaryBtn, !request && { opacity: 0.5 }]} onPress={connect} disabled={!request}>
                <Text style={styles.primaryBtnText}>{t('gcal.connectButton')}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.connected}>{t('gcal.connectedLabel')}</Text>
              <Text style={styles.body}>{t('gcal.whatToSync')}</Text>

              <TouchableOpacity style={styles.primaryBtn} onPress={handleImport} disabled={busy !== null}>
                {busy === 'import' ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>{t('gcal.importButton')}</Text>}
              </TouchableOpacity>
              <Text style={styles.hint}>{t('gcal.importHint')}</Text>

              <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.accent }]} onPress={handleExport} disabled={busy !== null}>
                {busy === 'export' ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>{t('gcal.exportButton')}</Text>}
              </TouchableOpacity>
              <Text style={styles.hint}>{t('gcal.exportHint')}</Text>
            </>
          )}

          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>{t('common.close')}</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function makeStyles(colors: ColorPalette) { return StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingBottom: spacing.xl },
  handle: { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.md },
  title: { ...typography.h2, color: colors.text, marginBottom: spacing.sm },
  body: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.md },
  connected: { ...typography.body, color: '#2D9E57', fontWeight: '700', marginBottom: spacing.sm },
  primaryBtn: { backgroundColor: colors.brand, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', marginTop: spacing.sm },
  primaryBtnText: { ...typography.body, color: '#fff', fontWeight: '700' },
  hint: { ...typography.xs, color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.sm },
  closeBtn: { padding: spacing.md, alignItems: 'center', marginTop: spacing.md },
  closeBtnText: { ...typography.body, color: colors.textSecondary },
}); }
