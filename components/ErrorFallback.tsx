// components/ErrorFallback.tsx — shown instead of a white/red crash screen when the
// Sentry ErrorBoundary in app/_layout.tsx catches a render error.
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { colors, spacing, radius, typography } from '../constants/theme';

export default function ErrorFallback({ resetError }: { resetError: () => void }) {
  const { t } = useTranslation();
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.emoji}>😵</Text>
        <Text style={styles.title}>{t('errorFallback.title')}</Text>
        <Text style={styles.body}>{t('errorFallback.body')}</Text>
        <TouchableOpacity style={styles.button} onPress={resetError} activeOpacity={0.85}>
          <Text style={styles.buttonText}>{t('errorFallback.retryButton')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  emoji: { fontSize: 56, marginBottom: spacing.lg },
  title: { ...typography.h2, color: colors.text, marginBottom: spacing.sm, textAlign: 'center' },
  body: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.xl, lineHeight: 22 },
  button: { backgroundColor: colors.brand, borderRadius: radius.full, paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  buttonText: { ...typography.body, color: colors.textInverse, fontWeight: '700' },
});
