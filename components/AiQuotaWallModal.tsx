// components/AiQuotaWallModal.tsx — what a user sees when the shared monthly AI quota is spent.
//
// This replaces an Alert.alert() with two buttons. Two reasons it had to stop being an alert:
//
//   1. On web, lib/alert.ts maps a multi-button alert onto window.confirm(), which only ever
//      renders OK and Cancel. "Premium ansehen" became "OK" — the one moment a user is thinking
//      about paying, and the button did not say what it did.
//   2. An alert cannot show structure. This is the only screen in the app where somebody decides
//      whether Heimlig is worth money, and it needs to say concretely where they stand: how many
//      actions they used, and when they get more for free.
//
// The reset date is deliberately given as much weight as the upgrade button. Somebody who learns
// their quota returns in three days will wait, and that is a fine outcome — better than an
// unexplained wall that reads as the app being broken.
import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { de, enUS } from 'date-fns/locale';
import { spacing, radius, typography, type ColorPalette } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { useStore } from '../store/useStore';
import { nextQuotaReset, daysUntilQuotaReset } from '../lib/aiUsage';
import { logPaywallEvent, type PaywallSource } from '../lib/paywallEvents';

export default function AiQuotaWallModal({ visible, used, limit, source, onClose, onUpgrade }: {
  visible: boolean;
  used: number;
  limit: number;
  source: PaywallSource;
  onClose: () => void;
  onUpgrade: () => void;
}) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const language = useStore(s => s.language);
  const household = useStore(s => s.household);
  const dateLocale = language === 'en' ? enUS : de;
  const s = useMemo(() => makeStyles(colors), [colors]);

  // One wall_shown per time it opens, not one per render. Without the ref a re-render caused by
  // anything else on screen would log again and inflate the number the conversion rate divides by.
  const loggedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!visible) { loggedFor.current = null; return; }
    const key = `${source}:${household?.id ?? ''}`;
    if (loggedFor.current === key) return;
    loggedFor.current = key;
    logPaywallEvent('wall_shown', source, household?.id);
  }, [visible, source, household?.id]);

  const days = daysUntilQuotaReset();
  const resetDate = format(nextQuotaReset(), 'd. MMMM', { locale: dateLocale });

  const handleUpgrade = () => {
    logPaywallEvent('upgrade_clicked', source, household?.id);
    onUpgrade();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose}>
        {/* Inner Pressable with no onPress swallows taps so they don't close the sheet. */}
        <Pressable style={s.sheet}>
          <View style={s.handle} />
          <Text style={s.emoji}>✨</Text>
          <Text style={s.title}>{t('aiQuota.limitReachedTitle')}</Text>

          <Text style={s.body}>{t('aiQuota.wallBody', { used, limit })}</Text>

          {/* The concrete "you get more on X, in N days" — the part that turns a dead end into
              a wait. Given its own box so it isn't skimmed past as body text. */}
          <View style={s.resetBox}>
            <Text style={s.resetText}>{t('aiQuota.wallReset', { count: days, date: resetDate })}</Text>
          </View>

          <Text style={s.premiumHint}>{t('aiQuota.wallPremiumBenefit')}</Text>

          <TouchableOpacity style={s.primaryBtn} onPress={handleUpgrade}>
            <Text style={s.primaryBtnText}>{t('aiQuota.upgradeButton')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.secondaryBtn} onPress={onClose}>
            <Text style={s.secondaryBtnText}>{t('aiQuota.wallLaterButton')}</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function makeStyles(colors: ColorPalette) { return StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingBottom: spacing.xxl },
  handle: { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.lg },
  emoji: { fontSize: 40, textAlign: 'center', marginBottom: spacing.sm },
  title: { ...typography.h2, color: colors.text, textAlign: 'center' },
  body: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm, lineHeight: 22 },
  resetBox: { backgroundColor: colors.brandPale, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.lg },
  // colors.text, not brandDark: in the dark palette brandPale (#1B3D28) and brandDark (#1B4332)
  // are both dark greens, so that pairing is unreadable. text flips with the theme and stays
  // legible on brandPale in both.
  resetText: { ...typography.body, color: colors.text, textAlign: 'center', fontWeight: '700' },
  premiumHint: { ...typography.sm, color: colors.textMuted, textAlign: 'center', marginTop: spacing.lg, marginBottom: spacing.md },
  primaryBtn: { backgroundColor: colors.brand, borderRadius: radius.md, padding: spacing.md, alignItems: 'center' },
  primaryBtnText: { ...typography.body, color: colors.textInverse, fontWeight: '700' },
  secondaryBtn: { padding: spacing.md, alignItems: 'center', marginTop: spacing.xs },
  secondaryBtnText: { ...typography.body, color: colors.textSecondary, fontWeight: '600' },
}); }
