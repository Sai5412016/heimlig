// app/(tabs)/profile.tsx — Profil & Einstellungen
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';
import { useStore } from '../../store/useStore';
import { useT } from '../../lib/i18n';
import { supabase } from '../../lib/supabase';
import { spacing, radius, typography, shadow, AVATAR_COLORS } from '../../constants/theme';

export default function ProfileScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const t = useT();
  const { profile, darkMode, language, setDarkMode, setLanguage, signOut, userId } = useStore();

  const handleDarkMode = (v: boolean) => {
    setDarkMode(v);
    if (userId) supabase.from('profiles').update({ dark_mode: v }).eq('id', userId).then(() => {});
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace('/onboarding');
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      t('settings.deleteAccount'),
      language === 'de'
        ? 'Bitte schreib uns an heimlig.app@gmail.com, um dein Konto endgültig löschen zu lassen.'
        : 'Please email heimlig.app@gmail.com to have your account permanently deleted.',
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.profileHeader}>
          <View style={[styles.avatar, { backgroundColor: profile?.avatar_color || AVATAR_COLORS[0] }]}>
            <Text style={styles.avatarText}>{(profile?.display_name || '?').slice(0, 1).toUpperCase()}</Text>
          </View>
          <Text style={[styles.name, { color: colors.text }]}>{profile?.display_name}</Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, ...shadow.sm }]}>
          <Text style={[styles.rowLabel, { color: colors.text }]}>{t('settings.language')}</Text>
          <View style={styles.langRow}>
            {(['de', 'en'] as const).map((l) => (
              <TouchableOpacity
                key={l}
                style={[styles.langPill, { borderColor: colors.border }, language === l && { backgroundColor: colors.brand, borderColor: colors.brand }]}
                onPress={() => setLanguage(l)}
              >
                <Text style={[styles.langPillText, { color: language === l ? colors.textInverse : colors.textSecondary }]}>{l.toUpperCase()}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={[styles.card, styles.rowCard, { backgroundColor: colors.surface, borderColor: colors.border, ...shadow.sm }]}>
          <Text style={[styles.rowLabel, { color: colors.text }]}>{t('settings.darkMode')}</Text>
          <Switch value={darkMode} onValueChange={handleDarkMode} trackColor={{ true: colors.brand }} />
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, ...shadow.sm }]}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{t('settings.legal')}</Text>
          <TouchableOpacity style={styles.linkRow} onPress={() => router.push('/impressum')}>
            <Text style={[styles.linkText, { color: colors.text }]}>{t('settings.imprint')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.linkRow} onPress={() => router.push('/datenschutz')}>
            <Text style={[styles.linkText, { color: colors.text }]}>{t('settings.privacy')}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={[styles.dangerBtn, { borderColor: colors.border }]} onPress={handleSignOut}>
          <Text style={[styles.dangerBtnText, { color: colors.text }]}>{t('settings.logout')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteAccount}>
          <Text style={[styles.deleteBtnText, { color: colors.error }]}>{t('settings.deleteAccount')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  profileHeader: { alignItems: 'center', marginBottom: spacing.xl },
  avatar: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  avatarText: { fontSize: 28, fontWeight: '800', color: '#fff' },
  name: { ...typography.h2 },
  card: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.lg, marginBottom: spacing.md },
  rowCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowLabel: { ...typography.body, fontWeight: '600' },
  sectionLabel: { ...typography.label, marginBottom: spacing.sm },
  langRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  langPill: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full, borderWidth: 1 },
  langPillText: { ...typography.sm, fontWeight: '700' },
  linkRow: { paddingVertical: spacing.sm + 2 },
  linkText: { ...typography.body },
  dangerBtn: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.md, alignItems: 'center', marginBottom: spacing.sm },
  dangerBtnText: { ...typography.body, fontWeight: '600' },
  deleteBtn: { alignItems: 'center', padding: spacing.md },
  deleteBtnText: { ...typography.sm, fontWeight: '600' },
});
