// components/AiQuotaHint.tsx — "3 of 5 AI actions left this month", shown right above the
// button that would spend one.
//
// The point is that the user sees where they stand BEFORE hitting the wall, not only in the
// rejection alert afterwards. Renders nothing at all for Premium households (nothing to count)
// or when the number can't be read — showing a wrong count would be worse than showing none.
import React, { useEffect, useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useStore } from '../store/useStore';
import { useTheme } from '../hooks/useTheme';
import { spacing, typography, type ColorPalette } from '../constants/theme';
import { hasPremiumAccess, FREE_MONTHLY_AI_ACTIONS } from '../lib/premium';
import { fetchAiActionsUsed } from '../lib/aiUsage';

export default function AiQuotaHint({ refreshKey }: { refreshKey?: unknown }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const household = useStore(state => state.household);
  const [used, setUsed] = useState<number | null>(null);
  const s = React.useMemo(() => makeStyles(colors), [colors]);

  const premium = hasPremiumAccess(household);

  // refreshKey lets the host re-read the count when its modal opens, so a user who spent an
  // action, closed the modal and came back doesn't see a stale number.
  useEffect(() => {
    if (premium) return;
    fetchAiActionsUsed(household?.id).then(setUsed);
  }, [household?.id, premium, refreshKey]);

  if (premium || used === null) return null;

  const remaining = Math.max(0, FREE_MONTHLY_AI_ACTIONS - used);
  return (
    <Text style={[s.hint, remaining === 0 && s.hintEmpty]}>
      {remaining === 0
        ? t('aiQuota.modalRemainingNone')
        : t('aiQuota.modalRemaining', { remaining, limit: FREE_MONTHLY_AI_ACTIONS })}
    </Text>
  );
}

function makeStyles(colors: ColorPalette) { return StyleSheet.create({
  hint: { ...typography.xs, color: colors.textMuted, textAlign: 'center', marginBottom: spacing.sm },
  hintEmpty: { color: colors.error, fontWeight: '600' },
}); }
