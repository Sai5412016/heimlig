// components/PremiumModal.tsx — Heimlig Premium upsell + purchase flow.
// The actual purchase only works on Android (Play Billing) — see lib/billing.ts.
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable, Platform, ActivityIndicator } from 'react-native';
import { Alert } from '../lib/alert';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { colors, spacing, radius, typography, type ColorPalette } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { useStore } from '../store/useStore';
import { supabase } from '../lib/supabase';
import { purchasePremium, restorePurchases } from '../lib/billing';

const hapticNotification = (type: Haptics.NotificationFeedbackType) => { if (Platform.OS !== 'web') Haptics.notificationAsync(type); };

// Matches the exact perks advertised in the Play Store listing — keep in sync with it.
const BENEFIT_KEYS = ['members', 'unlimitedImports', 'csvExport'] as const;

export default function PremiumModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const s = React.useMemo(() => makeStyles(colors), [colors]);
  const { household, setHousehold } = useStore();
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);

  // The edge function updates households.plan_tier server-side — pull the fresh row instead
  // of guessing the new value locally, so we show exactly what actually got saved.
  const refreshHousehold = async () => {
    if (!household) return;
    const { data } = await supabase.from('households').select('*').eq('id', household.id).single();
    if (data) setHousehold(data);
  };

  const handlePurchase = async () => {
    if (!household || purchasing) return;
    setPurchasing(true);
    try {
      const result = await purchasePremium(household.id);
      if (result.success) {
        await refreshHousehold();
        hapticNotification(Haptics.NotificationFeedbackType.Success);
        Alert.alert(t('premiumModal.successTitle'), t('premiumModal.successBody'));
        onClose();
      } else {
        Alert.alert(t('premiumModal.failedTitle'), result.error || t('premiumModal.purchaseFailed'));
      }
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    if (!household || restoring) return;
    setRestoring(true);
    try {
      const restored = await restorePurchases(household.id);
      if (restored > 0) {
        await refreshHousehold();
        hapticNotification(Haptics.NotificationFeedbackType.Success);
        Alert.alert(t('premiumModal.restoredTitle'), t('premiumModal.restoredBody', { count: restored }));
      } else {
        Alert.alert(t('premiumModal.nothingToRestoreTitle'), t('premiumModal.nothingToRestoreBody'));
      }
    } finally {
      setRestoring(false);
    }
  };

  const alreadyPremium = household?.plan_tier !== 'free';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose}>
        <Pressable style={s.sheet}>
          <View style={s.handle} />
          <Text style={s.title}>{t('premiumModal.title')}</Text>
          <Text style={s.sub}>{t('premiumModal.subtitle')}</Text>

          <View style={s.benefits}>
            {BENEFIT_KEYS.map(key => (
              <View key={key} style={s.benefitRow}>
                <Text style={s.benefitEmoji}>{t(`premiumModal.benefit.${key}.emoji`)}</Text>
                <Text style={s.benefitText}>{t(`premiumModal.benefit.${key}.text`)}</Text>
              </View>
            ))}
          </View>

          {alreadyPremium ? (
            <View style={s.alreadyBox}>
              <Text style={s.alreadyText}>{t('premiumModal.alreadyPremium')}</Text>
            </View>
          ) : Platform.OS !== 'android' ? (
            <Text style={s.platformHint}>{t('premiumModal.androidOnly')}</Text>
          ) : (
            <>
              <TouchableOpacity style={[s.purchaseBtn, purchasing && s.purchaseBtnDisabled]} onPress={handlePurchase} disabled={purchasing}>
                {purchasing ? <ActivityIndicator color={colors.textInverse} /> : <Text style={s.purchaseBtnText}>{t('premiumModal.unlockButton')}</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={s.restoreBtn} onPress={handleRestore} disabled={restoring}>
                <Text style={s.restoreBtnText}>{restoring ? t('premiumModal.restoring') : t('premiumModal.restoreButton')}</Text>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity style={s.closeBtn} onPress={onClose}>
            <Text style={s.closeBtnText}>{t('common.close')}</Text>
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
  title: { ...typography.h2, color: colors.text, textAlign: 'center' },
  sub: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xs, marginBottom: spacing.lg },
  benefits: { marginBottom: spacing.lg },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  benefitEmoji: { fontSize: 24, width: 32, textAlign: 'center' },
  benefitText: { flex: 1, ...typography.body, color: colors.text },
  alreadyBox: { backgroundColor: colors.brandPale, borderRadius: radius.md, padding: spacing.md, alignItems: 'center' },
  alreadyText: { ...typography.body, color: colors.brand, fontWeight: '700' },
  platformHint: { ...typography.sm, color: colors.textMuted, textAlign: 'center', marginBottom: spacing.sm },
  purchaseBtn: { backgroundColor: colors.brand, borderRadius: radius.md, padding: spacing.md, alignItems: 'center' },
  purchaseBtnDisabled: { opacity: 0.6 },
  purchaseBtnText: { ...typography.body, color: colors.textInverse, fontWeight: '700' },
  restoreBtn: { padding: spacing.md, alignItems: 'center' },
  restoreBtnText: { ...typography.sm, color: colors.brand, fontWeight: '600' },
  closeBtn: { padding: spacing.md, alignItems: 'center', marginTop: spacing.sm },
  closeBtnText: { ...typography.body, color: colors.textSecondary },
}); }
