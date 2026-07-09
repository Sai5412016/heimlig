// app/(tabs)/coach.tsx — AI Coach shell (no LLM wired up yet, this is the future home
// of the long-memory personal coach described in the vision).
import React from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../hooks/useTheme';
import { useT } from '../../lib/i18n';
import { spacing, radius, typography } from '../../constants/theme';

export default function CoachScreen() {
  const { colors } = useTheme();
  const t = useT();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text }]}>✨ {t('coach.title')}</Text>
      </View>
      <View style={styles.body}>
        <View style={[styles.bubble, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.bubbleText, { color: colors.textSecondary }]}>{t('coach.placeholder')}</Text>
        </View>
      </View>
      <View style={[styles.inputRow, { borderTopColor: colors.border, backgroundColor: colors.surface }]}>
        <TextInput
          style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          placeholder={t('coach.inputPlaceholder')}
          placeholderTextColor={colors.textMuted}
          editable={false}
        />
        <TouchableOpacity style={[styles.sendBtn, { backgroundColor: colors.brand }]} disabled>
          <Text style={styles.sendBtnText}>→</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1 },
  title: { ...typography.h2 },
  body: { flex: 1, padding: spacing.lg, justifyContent: 'flex-end' },
  bubble: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.lg, alignSelf: 'flex-start' },
  bubbleText: { ...typography.body, lineHeight: 21 },
  inputRow: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, borderTopWidth: 1, alignItems: 'center' },
  input: { flex: 1, borderWidth: 1, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, ...typography.body },
  sendBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', opacity: 0.5 },
  sendBtnText: { color: '#fff', fontSize: 18, fontWeight: '700' },
});
