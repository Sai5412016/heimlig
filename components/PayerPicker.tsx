// components/PayerPicker.tsx — "Bezahlt von" chip row, shared by the budget entry sheet and the
// receipt scan sheet so the two can't drift apart.
//
// Two deliberate layout decisions, both from the finding that 0 of 86 logged expenses ever used
// the shared mode:
//
// 1. The 🤝 "Gemeinsam" chip comes FIRST, before the member chips. It used to be last.
// 2. The row WRAPS instead of scrolling horizontally. The previous horizontal ScrollView had
//    `showsHorizontalScrollIndicator={false}`, so on a narrow viewport the last chip sat off the
//    right edge with no visual hint that anything was there — and with a mouse on the web PWA
//    there is no swipe gesture to reach it either. Wrapping is safe here because the number of
//    chips is hard-capped: at most 6 members (MEMBER_LIMIT_PREMIUM) plus the shared chip, so the
//    row can never grow beyond ~3 lines.
//
// `value === null` means "gemeinsam" (stored as transactions.member_id IS NULL).
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { spacing, radius, typography, type ColorPalette } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import type { Member } from '../lib/supabase';

export default function PayerPicker({ members, value, onChange }: {
  members: Member[];
  value: string | null;
  onChange: (memberId: string | null) => void;
}) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const s = useMemo(() => makeStyles(colors), [colors]);

  // "Shared" is only offered when there is actually more than one person to share with. With a
  // single member it would also be actively misleading: the split is computed live from the
  // current member count, so a row saved as "shared" while alone would be retroactively split
  // with whoever joins the household later.
  const showShared = members.length > 1;

  return (
    <View>
      <Text style={s.fieldLabel}>{t('budget.paidByLabel')}</Text>
      <View style={s.row}>
        {showShared && (
          <TouchableOpacity
            style={[s.chip, value === null && { backgroundColor: colors.brand, borderColor: colors.brand }]}
            onPress={() => onChange(null)}
          >
            <Text style={{ fontSize: 14 }}>🤝</Text>
            <Text style={[s.chipText, value === null && { color: colors.textInverse }]}>{t('common.shared')}</Text>
          </TouchableOpacity>
        )}
        {members.map(m => (
          <TouchableOpacity
            key={m.id}
            style={[s.chip, value === m.id && { backgroundColor: m.avatar_color, borderColor: m.avatar_color }]}
            onPress={() => onChange(m.id)}
          >
            <View style={[s.avatar, { backgroundColor: value === m.id ? 'rgba(255,255,255,0.3)' : m.avatar_color }]}>
              <Text style={s.avatarText}>{m.display_name[0]}</Text>
            </View>
            <Text style={[s.chipText, value === m.id && { color: colors.textInverse }]}>{m.display_name}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {showShared && <Text style={s.hint}>{t('budget.paidBySharedHint')}</Text>}
    </View>
  );
}

function makeStyles(colors: ColorPalette) { return StyleSheet.create({
  fieldLabel: { ...typography.xs, color: colors.textMuted, fontWeight: '700', letterSpacing: 0.5, marginBottom: spacing.xs, marginTop: spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  avatar: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.textInverse, fontSize: 11, fontWeight: '800' },
  chipText: { ...typography.sm, color: colors.textSecondary, fontWeight: '600' },
  hint: { ...typography.xs, color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.md },
}); }
