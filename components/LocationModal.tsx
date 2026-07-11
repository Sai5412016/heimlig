// components/LocationModal.tsx — opt-in location sharing within the household (manual, no tracking).
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity, Pressable, ActivityIndicator, Linking } from 'react-native';
import { Alert } from '../lib/alert';
import * as Location from 'expo-location';
import { useTheme } from '../hooks/useTheme';
import { spacing, radius, typography, type ColorPalette } from '../constants/theme';
import { useStore } from '../store/useStore';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';

export default function LocationModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { members, currentMember, locations, loadLocations, shareLocation, stopSharingLocation } = useStore();
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (visible) loadLocations(); }, [visible]);

  const locOf = (memberId: string) => locations.find(l => l.member_id === memberId);
  const myLoc = currentMember ? locOf(currentMember.id) : undefined;

  const handleShare = async () => {
    setBusy(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Kein Zugriff', 'Standort-Berechtigung wurde nicht erteilt.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      await shareLocation(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy ?? undefined);
      Alert.alert('✓ Geteilt', 'Dein aktueller Standort ist jetzt für deinen Haushalt sichtbar.');
    } catch {
      Alert.alert('Fehler', 'Standort konnte nicht ermittelt werden.');
    } finally { setBusy(false); }
  };

  const handleStop = () => {
    Alert.alert('Teilen beenden?', 'Dein Standort wird für den Haushalt nicht mehr angezeigt.', [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Beenden', style: 'destructive', onPress: () => stopSharingLocation() },
    ]);
  };

  const openMap = (lat: number, lng: number) => Linking.openURL(`https://www.google.com/maps?q=${lat},${lng}`);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>📍 Standort</Text>
          <Text style={styles.body}>Teile deinen aktuellen Standort einmalig mit deinem Haushalt. Es läuft kein Hintergrund-Tracking – nur wenn du tippst.</Text>

          <TouchableOpacity style={styles.shareBtn} onPress={handleShare} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.shareBtnText}>📍 {myLoc ? 'Standort aktualisieren' : 'Meinen Standort teilen'}</Text>}
          </TouchableOpacity>
          {myLoc && (
            <TouchableOpacity style={styles.stopBtn} onPress={handleStop} disabled={busy}>
              <Text style={styles.stopBtnText}>Teilen beenden</Text>
            </TouchableOpacity>
          )}

          <Text style={styles.sectionLabel}>HAUSHALT</Text>
          <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
            {members.map(m => {
              const loc = locOf(m.id);
              return (
                <View key={m.id} style={styles.row}>
                  <View style={[styles.avatar, { backgroundColor: m.avatar_color }]}>
                    <Text style={styles.avatarText}>{m.display_name[0]?.toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{m.display_name}{m.id === currentMember?.id ? ' (du)' : ''}</Text>
                    {loc ? (
                      <Text style={styles.meta}>geteilt {formatDistanceToNow(parseISO(loc.updated_at), { locale: de, addSuffix: true })}</Text>
                    ) : (
                      <Text style={styles.metaMuted}>noch nicht geteilt</Text>
                    )}
                  </View>
                  {loc && (
                    <TouchableOpacity style={styles.mapBtn} onPress={() => openMap(loc.lat, loc.lng)}>
                      <Text style={styles.mapBtnText}>Karte ›</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </ScrollView>

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
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingBottom: spacing.xl },
  handle: { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.md },
  title: { ...typography.h2, color: colors.text, marginBottom: spacing.sm },
  body: { ...typography.sm, color: colors.textSecondary, marginBottom: spacing.md },
  shareBtn: { backgroundColor: colors.brand, borderRadius: radius.md, padding: spacing.md, alignItems: 'center' },
  shareBtnText: { ...typography.body, color: '#fff', fontWeight: '700' },
  stopBtn: { padding: spacing.sm, alignItems: 'center', marginTop: spacing.xs },
  stopBtnText: { ...typography.sm, color: colors.error, fontWeight: '600' },
  sectionLabel: { ...typography.label, color: colors.textMuted, marginTop: spacing.lg, marginBottom: spacing.sm, textTransform: 'uppercase' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '700' },
  name: { ...typography.body, color: colors.text, fontWeight: '600' },
  meta: { ...typography.xs, color: colors.textSecondary, marginTop: 1 },
  metaMuted: { ...typography.xs, color: colors.textMuted, marginTop: 1 },
  mapBtn: { backgroundColor: colors.brandPale, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  mapBtnText: { ...typography.sm, color: colors.brand, fontWeight: '700' },
  closeBtn: { padding: spacing.md, alignItems: 'center', marginTop: spacing.sm },
  closeBtnText: { ...typography.body, color: colors.textSecondary },
}); }
