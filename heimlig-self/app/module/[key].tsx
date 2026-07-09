// app/module/[key].tsx — generic stub route for modules without their own tab yet
// (Body, Growth, Purpose, Habits, Focus). Dashboard tiles route here.
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';
import { useStore } from '../../store/useStore';
import { useT } from '../../lib/i18n';
import ModuleStub from '../../components/ModuleStub';
import { MODULES, spacing, typography } from '../../constants/theme';

export default function ModuleScreen() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const language = useStore((s) => s.language);
  const t = useT();

  const mod = MODULES.find((m) => m.key === key) ?? MODULES[0];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[styles.back, { color: colors.brand }]}>{t('stub.back')}</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>{language === 'de' ? mod.labelDe : mod.labelEn}</Text>
      </View>
      <ModuleStub emoji={mod.emoji} color={mod.color} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1 },
  back: { ...typography.body, fontWeight: '600' },
  title: { ...typography.h3 },
});
