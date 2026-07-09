// components/ModuleStub.tsx — shared "coming soon" body used by every module screen
// until its real tracking UI is built.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { useT } from '../lib/i18n';
import { spacing, radius, typography } from '../constants/theme';

export default function ModuleStub({ emoji, color }: { emoji: string; color: string }) {
  const { colors } = useTheme();
  const t = useT();
  return (
    <View style={styles.wrap}>
      <View style={[styles.iconCircle, { backgroundColor: color + '30' }]}>
        <Text style={{ fontSize: 40 }}>{emoji}</Text>
      </View>
      <Text style={[styles.title, { color: colors.text }]}>{t('stub.comingSoon')}</Text>
      <Text style={[styles.body, { color: colors.textSecondary }]}>{t('stub.body')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  iconCircle: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  title: { ...typography.h2, marginBottom: spacing.sm },
  body: { ...typography.body, textAlign: 'center', lineHeight: 22, maxWidth: 320 },
});
