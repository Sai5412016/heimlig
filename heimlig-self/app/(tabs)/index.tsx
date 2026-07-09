// app/(tabs)/index.tsx — Dashboard: "Wie geht es mir heute?"
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';
import { useStore } from '../../store/useStore';
import { useT } from '../../lib/i18n';
import { spacing, radius, typography, shadow, MODULES } from '../../constants/theme';

const TAB_ROUTES = new Set(['energy', 'mind', 'coach']);

export default function DashboardScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const profile = useStore((s) => s.profile);
  const language = useStore((s) => s.language);
  const t = useT();

  const openModule = (key: string) => {
    if (TAB_ROUTES.has(key)) router.push(`/(tabs)/${key}` as any);
    else router.push(`/module/${key}` as any);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.greeting, { color: colors.text }]}>
          {t('dashboard.greeting')}{profile ? `, ${profile.display_name}` : ''}
        </Text>

        <View style={[styles.energyCard, { backgroundColor: colors.surface, borderColor: colors.border, ...shadow.md }]}>
          <View style={[styles.energyRing, { borderColor: colors.brand }]}>
            <Text style={[styles.energyValue, { color: colors.text }]}>--</Text>
          </View>
          <View style={styles.energyTextCol}>
            <Text style={[styles.energyLabel, { color: colors.textSecondary }]}>{t('dashboard.energyScore')}</Text>
            <Text style={[styles.energyHint, { color: colors.textMuted }]}>
              {language === 'de' ? 'Trackt Schlaf, Stimmung & Aktivität, sobald verfügbar' : 'Tracks sleep, mood & activity once available'}
            </Text>
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('dashboard.modules')}</Text>
        <View style={styles.grid}>
          {MODULES.map((m) => (
            <TouchableOpacity
              key={m.key}
              style={[styles.tile, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => openModule(m.key)}
            >
              <View style={[styles.tileIcon, { backgroundColor: m.color + '30' }]}>
                <Text style={{ fontSize: 22 }}>{m.emoji}</Text>
              </View>
              <Text style={[styles.tileLabel, { color: colors.text }]}>{language === 'de' ? m.labelDe : m.labelEn}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('dashboard.aiTip')}</Text>
        <View style={[styles.tipCard, { backgroundColor: colors.brandPale, borderColor: colors.border }]}>
          <Text style={{ fontSize: 20, marginBottom: spacing.xs }}>✨</Text>
          <Text style={[styles.tipText, { color: colors.text }]}>{t('dashboard.aiTipPlaceholder')}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  greeting: { ...typography.h1, marginBottom: spacing.lg },
  energyCard: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.lg, borderWidth: 1, padding: spacing.lg, marginBottom: spacing.xl, gap: spacing.md },
  energyRing: { width: 64, height: 64, borderRadius: 32, borderWidth: 4, alignItems: 'center', justifyContent: 'center' },
  energyValue: { ...typography.h3, fontWeight: '800' },
  energyTextCol: { flex: 1 },
  energyLabel: { ...typography.body, fontWeight: '700' },
  energyHint: { ...typography.xs, marginTop: 2 },
  sectionTitle: { ...typography.h3, marginBottom: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.xl },
  tile: { width: '31%', borderRadius: radius.lg, borderWidth: 1, padding: spacing.md, alignItems: 'center', gap: spacing.xs },
  tileIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  tileLabel: { ...typography.xs, fontWeight: '700', textAlign: 'center' },
  tipCard: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.lg },
  tipText: { ...typography.body, lineHeight: 21 },
});
