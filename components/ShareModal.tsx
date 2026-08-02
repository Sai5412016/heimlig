// components/ShareModal.tsx — share the app on social media, earn a point per platform per day.
// The native Share sheet doesn't reliably report whether the user actually completed the share
// (especially on Android, where the promise resolves as soon as the chooser opens, not once
// something was actually sent) — so, same as the task brief for this feature calls for, the
// point is awarded right after the share sheet was successfully invoked, not gated on
// confirmation. That's a deliberate, documented tradeoff, not an oversight.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable, Share, Platform, Animated } from 'react-native';
import { Alert } from '../lib/alert';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { colors, spacing, radius, typography, type ColorPalette } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { useStore } from '../store/useStore';
import { supabase } from '../lib/supabase';
import { randomShareText } from '../lib/shareTemplates';
import { SHARE_POINTS } from '../lib/gamification';
import { format } from 'date-fns';

const hapticNotification = (type: Haptics.NotificationFeedbackType) => { if (Platform.OS !== 'web') Haptics.notificationAsync(type); };

type Platform_ = 'instagram' | 'facebook' | 'twitter' | 'tiktok' | 'other';

const PLATFORMS: { key: Platform_; emoji: string }[] = [
  { key: 'instagram', emoji: '📸' },
  { key: 'facebook', emoji: '👍' },
  { key: 'twitter', emoji: '𝕏' },
  { key: 'tiktok', emoji: '🎵' },
  { key: 'other', emoji: '📤' },
];

export default function ShareModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const { household, currentMember, language } = useStore();
  const [sharedToday, setSharedToday] = useState<Set<Platform_>>(new Set());
  const [busy, setBusy] = useState<Platform_ | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;

  const loadSharedToday = async () => {
    if (!household || !currentMember) return;
    const today = format(new Date(), 'yyyy-MM-dd');
    const { data } = await supabase
      .from('share_events')
      .select('platform')
      .eq('household_id', household.id)
      .eq('user_id', currentMember.user_id)
      .eq('shared_date', today);
    setSharedToday(new Set((data || []).map(r => r.platform as Platform_)));
  };

  useEffect(() => { if (visible) loadSharedToday(); }, [visible]);

  const showToast = () => {
    setToastVisible(true);
    anim.setValue(0);
    Animated.sequence([
      Animated.spring(anim, { toValue: 1, useNativeDriver: true, speed: 20 }),
      Animated.delay(900),
      Animated.timing(anim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => setToastVisible(false));
  };

  const recordShare = async (platform: Platform_) => {
    if (!household || !currentMember) return;
    const { error } = await supabase.from('share_events').insert({
      household_id: household.id, user_id: currentMember.user_id, platform,
    });
    // A unique-constraint hit (23505) just means this platform was already logged today —
    // treat it the same as success rather than surfacing an error the user can't act on.
    if (error && error.code !== '23505') return;
    setSharedToday(prev => new Set(prev).add(platform));
    hapticNotification(Haptics.NotificationFeedbackType.Success);
    showToast();
  };

  const handleShare = async (platform: Platform_) => {
    if (sharedToday.has(platform) || busy) return;
    setBusy(platform);
    try {
      const message = randomShareText(language);
      if (Platform.OS === 'web') {
        try {
          await navigator.clipboard.writeText(message);
          Alert.alert(t('household.copiedTitle'), t('household.copiedClipboardBody'));
          await recordShare(platform);
        } catch {
          Alert.alert(t('shareModal.failedTitle'), message);
        }
      } else {
        await Share.share({ message });
        await recordShare(platform);
      }
    } catch {
      Alert.alert(t('common.error'), t('shareModal.failedBody'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose}>
        <Pressable style={s.sheet}>
          <View style={s.handle} />
          <Text style={s.title}>{t('shareModal.title')}</Text>
          <Text style={s.sub}>{t('shareModal.subtitle', { points: SHARE_POINTS })}</Text>

          <View style={s.platformGrid}>
            {PLATFORMS.map(p => {
              const done = sharedToday.has(p.key);
              return (
                <TouchableOpacity
                  key={p.key}
                  style={[s.platformBtn, done && s.platformBtnDone]}
                  onPress={() => handleShare(p.key)}
                  disabled={done || busy === p.key}
                >
                  <Text style={s.platformEmoji}>{p.emoji}</Text>
                  <Text style={[s.platformLabel, done && s.platformLabelDone]}>{t(`shareModal.platform.${p.key}`)}</Text>
                  <Text style={[s.platformHint, done && s.platformHintDone]}>{done ? t('shareModal.sharedToday') : `+${SHARE_POINTS} ${t('shareModal.pointAbbrev')}`}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {toastVisible && (
            <Animated.View style={[s.toast, {
              opacity: anim,
              transform: [{ scale: anim }],
            }]}>
              <Text style={s.toastText}>{t('shareModal.toast', { points: SHARE_POINTS })}</Text>
            </Animated.View>
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
  platformGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' },
  platformBtn: { width: '30%', minWidth: 90, alignItems: 'center', backgroundColor: colors.background, borderRadius: radius.md, paddingVertical: spacing.md, borderWidth: 1.5, borderColor: colors.border },
  platformBtnDone: { opacity: 0.5 },
  platformEmoji: { fontSize: 28, marginBottom: spacing.xs },
  platformLabel: { ...typography.sm, color: colors.text, fontWeight: '700' },
  platformLabelDone: { color: colors.textMuted },
  platformHint: { ...typography.xs, color: colors.brand, fontWeight: '600', marginTop: 2 },
  platformHintDone: { color: colors.textMuted },
  toast: { alignSelf: 'center', backgroundColor: colors.brand, borderRadius: radius.full, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, marginTop: spacing.lg },
  toastText: { ...typography.body, color: colors.textInverse, fontWeight: '700' },
  closeBtn: { padding: spacing.md, alignItems: 'center', marginTop: spacing.lg },
  closeBtnText: { ...typography.body, color: colors.textSecondary },
}); }
