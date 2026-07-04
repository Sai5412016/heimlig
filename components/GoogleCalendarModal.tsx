// components/GoogleCalendarModal.tsx — connect a Google account and sync tasks ⇄ Google Calendar.
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Pressable, ActivityIndicator, Platform } from 'react-native';
import { Alert } from '../lib/alert';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useTheme } from '../hooks/useTheme';
import { spacing, radius, typography, type ColorPalette } from '../constants/theme';
import { useStore } from '../store/useStore';
import { GOOGLE_OAUTH } from '../constants/google';
import { listUpcomingEvents } from '../lib/googleCalendar';

WebBrowser.maybeCompleteAuthSession();

export default function GoogleCalendarModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors } = useTheme();
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
      Alert.alert('Verbindung fehlgeschlagen', 'Bitte versuche es erneut.');
    }
  }, [response]);

  const connect = () => promptAsync();

  const handleImport = async () => {
    if (!token) return;
    setBusy('import');
    try {
      const events = await listUpcomingEvents(token, 60);
      const n = await importGoogleEvents(events);
      Alert.alert('✓ Importiert', n > 0 ? `${n} Termin${n === 1 ? '' : 'e'} aus Google Kalender übernommen.` : 'Keine neuen Termine gefunden.');
    } catch {
      Alert.alert('Fehler', 'Import fehlgeschlagen. Verbinde dich ggf. neu (Zugriff abgelaufen).');
      setToken(null);
    } finally { setBusy(null); }
  };

  const handleExport = async () => {
    if (!token) return;
    setBusy('export');
    try {
      const n = await exportTasksToGoogle(token);
      Alert.alert('✓ Exportiert', n > 0 ? `${n} Aufgabe${n === 1 ? '' : 'n'} in Google Kalender eingetragen.` : 'Keine neuen Aufgaben zum Exportieren.');
    } catch {
      Alert.alert('Fehler', 'Export fehlgeschlagen. Verbinde dich ggf. neu (Zugriff abgelaufen).');
      setToken(null);
    } finally { setBusy(null); }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>📅 Google Kalender</Text>

          {Platform.OS !== 'web' ? (
            <Text style={styles.body}>
              Die Google-Kalender-Verbindung funktioniert aktuell nur in der Web-Version von Heimlig (heimlig.vercel.app) — Google lässt die Anmeldung auf Android in der App momentan nicht zu. Eine native Lösung ist in Arbeit.
            </Text>
          ) : !token ? (
            <>
              <Text style={styles.body}>Verbinde dein Google-Konto, um Termine zwischen Heimlig und Google Kalender abzugleichen.</Text>
              <TouchableOpacity style={[styles.primaryBtn, !request && { opacity: 0.5 }]} onPress={connect} disabled={!request}>
                <Text style={styles.primaryBtnText}>Mit Google verbinden</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.connected}>✓ Verbunden</Text>
              <Text style={styles.body}>Was möchtest du abgleichen?</Text>

              <TouchableOpacity style={styles.primaryBtn} onPress={handleImport} disabled={busy !== null}>
                {busy === 'import' ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>⬇️ Google-Termine importieren</Text>}
              </TouchableOpacity>
              <Text style={styles.hint}>Holt die nächsten 60 Tage aus Google als Aufgaben (ohne Duplikate).</Text>

              <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.accent }]} onPress={handleExport} disabled={busy !== null}>
                {busy === 'export' ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>⬆️ Aufgaben exportieren</Text>}
              </TouchableOpacity>
              <Text style={styles.hint}>Trägt deine Heimlig-Aufgaben mit Datum in den Google Kalender ein.</Text>
            </>
          )}

          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>Schließen</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function makeStyles(colors: ColorPalette) { return StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, paddingBottom: spacing.xl },
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
