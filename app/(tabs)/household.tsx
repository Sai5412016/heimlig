// app/(tabs)/household.tsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Share, Modal, Pressable, TextInput, Platform, KeyboardAvoidingView
} from 'react-native';
import { Alert } from '../../lib/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
const hapticNotification = (type: Haptics.NotificationFeedbackType) => { if (Platform.OS !== 'web') Haptics.notificationAsync(type); };
import { colors, spacing, radius, typography, shadow, APP_THEMES, type ColorPalette } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { CURRENCIES, formatCurrency } from '../../lib/currency';
import { TIMEZONES, timezoneLabel } from '../../lib/timezones';
import { SUPPORTED_COUNTRIES } from '../../lib/holidays';
import { useStore } from '../../store/useStore';
import { useTheme } from '../../hooks/useTheme';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { de, enUS } from 'date-fns/locale';
import NotesModal from '../../components/NotesModal';
import GoogleCalendarModal from '../../components/GoogleCalendarModal';
import LocationModal from '../../components/LocationModal';
import ThemeMotif from '../../components/ThemeMotif';

// ─── AVATAR ───────────────────────────────────────────────────
function Avatar({ name, color, size = 48 }: { name: string; color: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: colors.textInverse, fontWeight: '800', fontSize: size * 0.38 }}>{name[0].toUpperCase()}</Text>
    </View>
  );
}

// ─── INVITE MODAL ─────────────────────────────────────────────
function InviteModal({ visible, onClose, inviteCode, householdName }: {
  visible: boolean;
  onClose: () => void;
  inviteCode: string;
  householdName: string;
}) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const handleShare = async () => {
    const message = t('household.inviteMessage', { name: householdName, code: inviteCode });
    if (Platform.OS === 'web') {
      try { await navigator.clipboard.writeText(message); Alert.alert(t('household.copiedTitle'), t('household.copiedClipboardBody')); }
      catch { Alert.alert(t('household.inviteCodeFallbackTitle'), message); }
    } else {
      try { await Share.share({ message, title: t('household.shareTitle') }); }
      catch { Alert.alert(t('common.error'), t('household.shareFailedBody')); }
    }
  };

  const handleCopy = () => {
    hapticNotification(Haptics.NotificationFeedbackType.Success);
    Alert.alert(t('household.copiedTitle'), t('household.copiedCodeBody', { code: inviteCode }));
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>{t('household.inviteModalTitle')}</Text>
          <Text style={styles.modalSub}>{t('household.inviteModalSub')}</Text>

          {/* Invite Code Display */}
          <TouchableOpacity style={styles.codeBox} onPress={handleCopy} activeOpacity={0.8}>
            <Text style={styles.codeText}>{inviteCode}</Text>
            <Text style={styles.codeCopyHint}>{t('household.tapToCopy')}</Text>
          </TouchableOpacity>

          {/* Share Button */}
          <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
            <Text style={styles.shareBtnText}>{t('household.shareInvite')}</Text>
          </TouchableOpacity>

          <Text style={styles.webHint}>{t('household.webHint')}</Text>

          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>{t('common.close')}</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── JOIN MODAL ───────────────────────────────────────────────
function JoinModal({ visible, onClose, onJoin }: {
  visible: boolean;
  onClose: () => void;
  onJoin: (code: string) => void;
}) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleJoin = async () => {
    if (!code.trim()) return;
    setLoading(true);
    await onJoin(code.trim().toUpperCase());
    setLoading(false);
    setCode('');
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <Pressable style={styles.modalOverlay} onPress={onClose}>
          <Pressable style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{t('household.joinModalTitle')}</Text>
            <Text style={styles.modalSub}>{t('household.joinModalSub')}</Text>
            <TextInput
              style={styles.codeInput}
              placeholder={t('household.joinCodePlaceholder')}
              placeholderTextColor={colors.textMuted}
              value={code}
              onChangeText={val => setCode(val.toUpperCase())}
              autoCapitalize="characters"
              autoFocus
            />
            <TouchableOpacity
              style={[styles.shareBtn, (!code || loading) && { opacity: 0.4 }]}
              onPress={handleJoin}
              disabled={!code || loading}
            >
              <Text style={styles.shareBtnText}>{loading ? t('household.searching') : t('household.joinButton')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── EDIT FIELD MODAL ─────────────────────────────────────────
function EditModal({ visible, title, label, initialValue, secure, placeholder, saveLabel, onClose, onSave }: {
  visible: boolean;
  title: string;
  label: string;
  initialValue?: string;
  secure?: boolean;
  placeholder?: string;
  saveLabel?: string;
  onClose: () => void;
  onSave: (value: string) => Promise<void>;
}) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [value, setValue] = useState(initialValue ?? '');
  const [loading, setLoading] = useState(false);
  useEffect(() => { if (visible) setValue(initialValue ?? ''); }, [visible]);

  const handleSave = async () => {
    if (!value.trim()) return;
    setLoading(true);
    await onSave(value.trim());
    setLoading(false);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <Pressable style={styles.modalOverlay} onPress={onClose}>
          <Pressable style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{title}</Text>
            <Text style={styles.modalSub}>{label}</Text>
            <TextInput
              style={styles.codeInput}
              placeholder={placeholder}
              placeholderTextColor={colors.textMuted}
              value={value}
              onChangeText={setValue}
              secureTextEntry={secure}
              autoCapitalize="none"
              autoFocus
            />
            <TouchableOpacity style={[styles.shareBtn, (!value.trim() || loading) && { opacity: 0.4 }]} onPress={handleSave} disabled={!value.trim() || loading}>
              <Text style={styles.shareBtnText}>{loading ? t('household.savingButton') : (saveLabel ?? t('common.save'))}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── MAIN SCREEN ──────────────────────────────────────────────
export default function HouseholdScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { household, currentMember, members, setMembers, setHousehold, tasks, transactions,
    myHouseholds, loadMyHouseholds, switchHousehold, leaveHousehold, toggleDarkMode, themeId, selectTheme,
    language, selectLanguage } = useStore();
  const { t } = useTranslation();
  const dateLocale = language === 'en' ? enUS : de;
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [showInvite, setShowInvite] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [showEditName, setShowEditName] = useState(false);
  const [showChangePw, setShowChangePw] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [showGCal, setShowGCal] = useState(false);
  const [showLocation, setShowLocation] = useState(false);
  const [showSwitcher, setShowSwitcher] = useState(false);
  const [weekScores, setWeekScores] = useState<Record<string, number>>({});

  useEffect(() => { loadMyHouseholds(); }, [household?.id]);

  const handleSwitch = async (id: string) => {
    setShowSwitcher(false);
    if (id === household?.id) return;
    await switchHousehold(id);
  };

  const handleLeave = () => {
    if (!household) return;
    Alert.alert(t('household.leaveConfirmTitle'), t('household.leaveConfirmBody', { name: household.name }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('household.leaveButton'), style: 'destructive', onPress: async () => {
          const remaining = await leaveHousehold(household.id);
          if (remaining.length > 0) {
            await switchHousehold(remaining[0].id);
          } else {
            setHousehold(null);
            await supabase.auth.signOut();
          }
      }},
    ]);
  };

  const handleRenameHousehold = async (name: string) => {
    if (!household) return;
    const { error } = await supabase.from('households').update({ name }).eq('id', household.id);
    if (error) { Alert.alert(t('common.error'), error.message); return; }
    setHousehold({ ...household, name });
    setShowEditName(false);
  };

  const handleToggleGamification = async () => {
    if (!household) return;
    if (currentMember?.role !== 'admin') { Alert.alert(t('household.noPermissionTitle'), t('household.noPermissionChangeSetting')); return; }
    const next = household.gamification_enabled === false; // currently off → turn on
    const { error } = await supabase.from('households').update({ gamification_enabled: next }).eq('id', household.id);
    if (error) { Alert.alert(t('common.error'), error.message); return; }
    setHousehold({ ...household, gamification_enabled: next });
  };

  const handleToggleDigest = async () => {
    if (!household) return;
    if (currentMember?.role !== 'admin') { Alert.alert(t('household.noPermissionTitle'), t('household.noPermissionChangeSetting')); return; }
    const next = !household.digest_enabled;
    const { error } = await supabase.from('households').update({ digest_enabled: next }).eq('id', household.id);
    if (error) { Alert.alert(t('common.error'), error.message); return; }
    setHousehold({ ...household, digest_enabled: next });
  };

  // Shared by the currency/timezone/country pickers — each just sets one household-wide text
  // column, admin-gated like the toggle handlers above.
  const handleSetHouseholdField = async (field: 'currency' | 'timezone' | 'country', value: string) => {
    if (!household) return;
    if (currentMember?.role !== 'admin') { Alert.alert(t('household.noPermissionTitle'), t('household.noPermissionChangeSetting')); return; }
    const { error } = await supabase.from('households').update({ [field]: value }).eq('id', household.id);
    if (error) { Alert.alert(t('common.error'), error.message); return; }
    setHousehold({ ...household, [field]: value });
  };

  const handleChangePassword = async (password: string) => {
    if (password.length < 6) { Alert.alert(t('household.passwordTooShortTitle'), t('household.passwordTooShortBody')); return; }
    const { error } = await supabase.auth.updateUser({ password });
    if (error) { Alert.alert(t('common.error'), error.message); return; }
    setShowChangePw(false);
    Alert.alert(t('household.passwordChangedTitle'), t('household.passwordChangedBody'));
  };

  // Calculate this week's scores from completed tasks
  useEffect(() => {
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
    const scores: Record<string, number> = {};

    tasks.forEach(task => {
      if (task.completed_at && task.completed_by && task.category !== 'Geburtstag') {
        const completedDate = new Date(task.completed_at);
        if (completedDate >= weekStart && completedDate <= weekEnd) {
          scores[task.completed_by] = (scores[task.completed_by] || 0) + (task.points || 10);
        }
      }
    });
    setWeekScores(scores);
  }, [tasks]);

  const handleJoinHousehold = async (code: string) => {
    if (!currentMember) return;

    const { data: result, error } = await supabase.rpc('join_household_by_code', {
      p_invite_code: code,
      p_display_name: currentMember.display_name,
      p_avatar_color: currentMember.avatar_color,
    });

    if (error) {
      Alert.alert(t('common.error'), error.message || t('household.joinFailed'));
      return;
    }

    if (result?.error) {
      Alert.alert(t('household.notFoundTitle'), result.error);
      return;
    }

    Alert.alert(t('household.welcomeTitle'), t('household.welcomeBody', { name: result.household_name }));
    setShowJoin(false);
  };

  const handleRemoveMember = (memberId: string, memberName: string) => {
    if (currentMember?.role !== 'admin') {
      Alert.alert(t('household.noPermissionTitle'), t('household.noPermissionRemoveMember'));
      return;
    }
    if (memberId === currentMember?.id) {
      Alert.alert(t('household.cantRemoveSelfTitle'), t('household.cantRemoveSelfBody'));
      return;
    }
    Alert.alert(t('household.removeMemberTitle'), t('household.removeMemberBody', { name: memberName }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('household.removeButton'), style: 'destructive', onPress: async () => {
          await supabase.from('members').delete().eq('id', memberId);
          setMembers(members.filter(m => m.id !== memberId));
          hapticNotification(Haptics.NotificationFeedbackType.Warning);
        }
      }
    ]);
  };

  // This month's expenses per member
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const memberExpenses: Record<string, number> = {};
  transactions
    .filter(t => t.type === 'expense' && t.transaction_date?.startsWith(monthKey))
    .forEach(t => {
      if (t.member_id) memberExpenses[t.member_id] = (memberExpenses[t.member_id] || 0) + Number(t.amount);
    });

  // Top scorer this week
  const topScorer = members.reduce((top, m) => {
    const score = weekScores[m.id] || 0;
    return score > (weekScores[top?.id || ''] || 0) ? m : top;
  }, members[0]);

  const totalWeekPoints = Object.values(weekScores).reduce((s, v) => s + v, 0);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity disabled={myHouseholds.length <= 1} onPress={() => setShowSwitcher(true)} activeOpacity={0.7}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Text style={styles.headerTitle}>👥 {t('household.headerTitle')}</Text>
            <ThemeMotif />
          </View>
          <Text style={styles.headerSub}>
            {household?.name ?? t('shopping.defaultHouseholdName')}{myHouseholds.length > 1 ? '  ▾' : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.inviteBtn} onPress={() => setShowInvite(true)}>
          <Text style={styles.inviteBtnText}>{t('household.inviteButton')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

        {/* Invite Banner */}
        <TouchableOpacity style={styles.inviteBanner} onPress={() => setShowInvite(true)} activeOpacity={0.85}>
          <View style={styles.inviteBannerLeft}>
            <Text style={styles.inviteBannerEmoji}>📨</Text>
            <View>
              <Text style={styles.inviteBannerTitle}>{t('household.inviteBannerTitle')}</Text>
              <Text style={styles.inviteBannerSub}>{t('household.inviteBannerSub')}<Text style={styles.inviteBannerCode}>{household?.invite_code}</Text></Text>
            </View>
          </View>
          <Text style={styles.inviteBannerArrow}>›</Text>
        </TouchableOpacity>

        {/* Weekly Score */}
        {household?.gamification_enabled !== false && members.length > 1 && totalWeekPoints > 0 && (
          <View style={styles.scoreCard}>
            <Text style={styles.scoreTitle}>{t('household.thisWeek')}</Text>
            <Text style={styles.scoreWeek}>{format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'dd. MMM', { locale: dateLocale })} – {format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'dd. MMM', { locale: dateLocale })}</Text>
            {members.map((m, i) => {
              const score = weekScores[m.id] || 0;
              const maxScore = Math.max(...members.map(mem => weekScores[mem.id] || 0));
              const isLeader = m.id === topScorer?.id && score > 0;
              return (
                <View key={m.id} style={styles.scoreRow}>
                  <Text style={styles.scoreRank}>{isLeader ? '🥇' : i === 1 ? '🥈' : '🥉'}</Text>
                  <Avatar name={m.display_name} color={m.avatar_color} size={32} />
                  <Text style={styles.scoreName}>{m.display_name}</Text>
                  <View style={styles.scoreBarWrap}>
                    <View style={[styles.scoreBarFill, { width: maxScore > 0 ? `${(score / maxScore) * 100}%` : '0%', backgroundColor: m.avatar_color }]} />
                  </View>
                  <Text style={styles.scorePoints}>{t('household.points', { count: score })}</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Members */}
        <Text style={styles.sectionTitle}>{t('household.membersCount', { count: members.length })}</Text>
        {members.map(m => {
          const isMe = m.id === currentMember?.id;
          const expense = memberExpenses[m.id] || 0;
          const tasksCompleted = tasks.filter(task => task.completed_by === m.id).length;

          return (
            <View key={m.id} style={styles.memberCard}>
              <Avatar name={m.display_name} color={m.avatar_color} size={48} />
              <View style={styles.memberInfo}>
                <View style={styles.memberNameRow}>
                  <Text style={styles.memberName}>{m.display_name}</Text>
                  {isMe && <View style={styles.meBadge}><Text style={styles.meBadgeText}>{t('household.youBadge')}</Text></View>}
                  {m.role === 'admin' && <View style={styles.adminBadge}><Text style={styles.adminBadgeText}>{t('household.adminBadge')}</Text></View>}
                </View>
                <View style={styles.memberStats}>
                  <Text style={styles.memberStat}>{t('household.tasksCompleted', { count: tasksCompleted })}</Text>
                  {expense > 0 && <Text style={styles.memberStat}>{t('household.thisMonth', { amount: formatCurrency(expense, household?.currency, language, 0) })}</Text>}
                </View>
              </View>
              {!isMe && currentMember?.role === 'admin' && (
                <TouchableOpacity onPress={() => handleRemoveMember(m.id, m.display_name)} style={styles.removeMemberBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Text style={styles.removeMemberBtnText}>×</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}

        {/* Join another household */}
        <TouchableOpacity style={styles.joinBtn} onPress={() => setShowJoin(true)}>
          <Text style={styles.joinBtnText}>{t('household.joinOtherHousehold')}</Text>
        </TouchableOpacity>

        {/* Household Info */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>{t('household.infoTitle')}</Text>
          <TouchableOpacity
            style={styles.infoRow}
            onPress={() => currentMember?.role === 'admin' ? setShowEditName(true) : Alert.alert(t('household.noPermissionTitle'), t('household.noPermissionRenameHousehold'))}
            activeOpacity={0.6}
          >
            <Text style={styles.infoLabel}>{t('household.infoName')}</Text>
            <Text style={styles.infoValue}>{household?.name}{currentMember?.role === 'admin' ? '  ✏️' : ''}</Text>
          </TouchableOpacity>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('household.infoPlan')}</Text>
            <Text style={styles.infoValue}>{household?.plan_tier === 'free' ? t('household.planFree') : t('household.planPremium')}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('household.infoMembers')}</Text>
            <Text style={styles.infoValue}>{members.length} / {household?.plan_tier === 'free' ? '3' : '6'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('household.infoInviteCode')}</Text>
            <Text style={[styles.infoValue, { fontFamily: 'monospace', color: colors.brand }]}>{household?.invite_code}</Text>
          </View>
        </View>

        {/* Dark mode toggle */}
        <TouchableOpacity style={styles.settingsBtn} onPress={toggleDarkMode}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <Text style={styles.settingsBtnText}>{isDark ? '☀️' : '🌙'} {t('household.darkMode')}</Text>
            <View style={[styles.toggle, isDark && styles.toggleOn]}>
              <View style={[styles.toggleThumb, isDark && styles.toggleThumbOn]} />
            </View>
          </View>
        </TouchableOpacity>

        {/* Accent theme picker */}
        <View style={styles.settingsBtn}>
          <Text style={[styles.settingsBtnText, { alignSelf: 'flex-start' }]}>{t('household.designLabel')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: spacing.sm, width: '100%' }} contentContainerStyle={{ gap: spacing.sm }}>
            {APP_THEMES.map(theme => (
              <TouchableOpacity
                key={theme.id}
                style={[styles.themeChip, themeId === theme.id && { borderColor: theme.brand, backgroundColor: theme.brand + '15' }]}
                onPress={() => selectTheme(theme.id)}
              >
                <View style={[styles.themeSwatch, { backgroundColor: theme.brand }]}>
                  <Text style={styles.themeSwatchEmoji}>{theme.emoji}</Text>
                </View>
                <Text style={[styles.themeChipText, themeId === theme.id && { color: theme.brand, fontWeight: '700' }]}>{theme.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Language switcher — auto-detected from the device on first launch, manual choice
            persists from here on (see store/useStore.ts selectLanguage). */}
        <View style={styles.settingsBtn}>
          <Text style={[styles.settingsBtnText, { alignSelf: 'flex-start' }]}>🌐 {t('settings.language')}</Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, width: '100%' }}>
            <TouchableOpacity
              style={[styles.themeChip, { width: undefined, flex: 1 }, language === 'de' && { borderColor: colors.brand, backgroundColor: colors.brand + '15' }]}
              onPress={() => selectLanguage('de')}
            >
              <Text style={[styles.themeChipText, language === 'de' && { color: colors.brand, fontWeight: '700' }]}>🇩🇪 {t('settings.languageGerman')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.themeChip, { width: undefined, flex: 1 }, language === 'en' && { borderColor: colors.brand, backgroundColor: colors.brand + '15' }]}
              onPress={() => selectLanguage('en')}
            >
              <Text style={[styles.themeChipText, language === 'en' && { color: colors.brand, fontWeight: '700' }]}>🇬🇧 {t('settings.languageEnglish')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Currency picker — household-wide (not per-device like language/darkMode), since
            budget totals/splits are pooled math across members and can't mix currencies. */}
        <View style={styles.settingsBtn}>
          <Text style={[styles.settingsBtnText, { alignSelf: 'flex-start' }]}>💱 {t('settings.currency')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: spacing.sm, width: '100%' }} contentContainerStyle={{ gap: spacing.sm }}>
            {CURRENCIES.map(cur => {
              const active = (household?.currency || 'EUR') === cur.code;
              return (
                <TouchableOpacity
                  key={cur.code}
                  style={[styles.themeChip, { width: undefined, paddingHorizontal: spacing.md }, active && { borderColor: colors.brand, backgroundColor: colors.brand + '15' }]}
                  onPress={() => handleSetHouseholdField('currency', cur.code)}
                >
                  <Text style={[styles.themeChipText, active && { color: colors.brand, fontWeight: '700' }]}>{cur.symbol} {cur.code}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Timezone picker — used by send_daily_digest() to fire at 8am in the household's own
            zone instead of a hardcoded Europe/Berlin (also household-wide, same reasoning as
            currency: one shared digest push per household, not per member). */}
        <View style={styles.settingsBtn}>
          <Text style={[styles.settingsBtnText, { alignSelf: 'flex-start' }]}>🕐 {t('settings.timezone')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: spacing.sm, width: '100%' }} contentContainerStyle={{ gap: spacing.sm }}>
            {TIMEZONES.map(tz => {
              const active = (household?.timezone || 'Europe/Berlin') === tz;
              return (
                <TouchableOpacity
                  key={tz}
                  style={[styles.themeChip, { width: undefined, paddingHorizontal: spacing.md }, active && { borderColor: colors.brand, backgroundColor: colors.brand + '15' }]}
                  onPress={() => handleSetHouseholdField('timezone', tz)}
                >
                  <Text style={[styles.themeChipText, active && { color: colors.brand, fontWeight: '700' }]}>{timezoneLabel(tz)}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Country picker — drives which public holidays show up in the calendar
            (lib/holidays.ts, tasks.tsx). Household-wide for the same reason as currency/timezone. */}
        <View style={styles.settingsBtn}>
          <Text style={[styles.settingsBtnText, { alignSelf: 'flex-start' }]}>🎉 {t('settings.country')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: spacing.sm, width: '100%' }} contentContainerStyle={{ gap: spacing.sm }}>
            {SUPPORTED_COUNTRIES.map(c => {
              const active = (household?.country || 'DE') === c.code;
              return (
                <TouchableOpacity
                  key={c.code}
                  style={[styles.themeChip, { width: undefined, paddingHorizontal: spacing.md }, active && { borderColor: colors.brand, backgroundColor: colors.brand + '15' }]}
                  onPress={() => handleSetHouseholdField('country', c.code)}
                >
                  <Text style={[styles.themeChipText, active && { color: colors.brand, fontWeight: '700' }]}>{c.flag} {c.code}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Gamification toggle */}
        <TouchableOpacity style={styles.settingsBtn} onPress={handleToggleGamification}>
          <Text style={styles.settingsBtnText}>
            {t('household.scoreboardLabel', { state: household?.gamification_enabled === false ? t('household.off') : t('household.on') })}
          </Text>
        </TouchableOpacity>

        {/* Daily digest push toggle */}
        <TouchableOpacity style={styles.settingsBtn} onPress={handleToggleDigest}>
          <Text style={styles.settingsBtnText}>
            {t('household.dailyDigestLabel', { state: household?.digest_enabled ? t('household.on') : t('household.off') })}
          </Text>
        </TouchableOpacity>

        {/* Household notes */}
        <TouchableOpacity style={styles.settingsBtn} onPress={() => setShowNotes(true)}>
          <Text style={styles.settingsBtnText}>{t('household.notesLabel')}</Text>
        </TouchableOpacity>

        {/* Google Calendar */}
        <TouchableOpacity style={styles.settingsBtn} onPress={() => setShowGCal(true)}>
          <Text style={styles.settingsBtnText}>{t('household.googleCalendarLabel')}</Text>
        </TouchableOpacity>

        {/* Location sharing */}
        <TouchableOpacity style={styles.settingsBtn} onPress={() => setShowLocation(true)}>
          <Text style={styles.settingsBtnText}>{t('household.locationLabel')}</Text>
        </TouchableOpacity>

        {/* Change password */}
        <TouchableOpacity style={styles.settingsBtn} onPress={() => setShowChangePw(true)}>
          <Text style={styles.settingsBtnText}>{t('household.changePasswordLabel')}</Text>
        </TouchableOpacity>

        {/* Legal */}
        <TouchableOpacity style={styles.settingsBtn} onPress={() => router.push('/impressum')}>
          <Text style={styles.settingsBtnText}>{t('household.imprintLabel')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.settingsBtn} onPress={() => router.push('/datenschutz')}>
          <Text style={styles.settingsBtnText}>{t('household.privacyLabel')}</Text>
        </TouchableOpacity>

        {/* Leave household */}
        <TouchableOpacity style={styles.settingsBtn} onPress={handleLeave}>
          <Text style={[styles.settingsBtnText, { color: colors.error }]}>{t('household.leaveHouseholdLabel')}</Text>
        </TouchableOpacity>

        {/* Sign out */}
        <TouchableOpacity
          style={styles.signOutBtn}
          onPress={() => Alert.alert(t('household.signOutConfirmTitle'), t('household.signOutConfirmBody'), [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('household.signOutButton'), style: 'destructive', onPress: () => supabase.auth.signOut() }
          ])}
        >
          <Text style={styles.signOutBtnText}>{t('household.signOutButton')}</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      <NotesModal visible={showNotes} onClose={() => setShowNotes(false)} />
      <GoogleCalendarModal visible={showGCal} onClose={() => setShowGCal(false)} />
      <LocationModal visible={showLocation} onClose={() => setShowLocation(false)} />
      <InviteModal
        visible={showInvite}
        onClose={() => setShowInvite(false)}
        inviteCode={household?.invite_code ?? ''}
        householdName={household?.name ?? ''}
      />
      <JoinModal
        visible={showJoin}
        onClose={() => setShowJoin(false)}
        onJoin={handleJoinHousehold}
      />
      <EditModal
        visible={showEditName}
        title={t('household.renameTitle')}
        label={t('household.renameLabel')}
        placeholder={t('household.renamePlaceholder')}
        initialValue={household?.name}
        onClose={() => setShowEditName(false)}
        onSave={handleRenameHousehold}
      />
      <Modal visible={showSwitcher} transparent animationType="slide" onRequestClose={() => setShowSwitcher(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowSwitcher(false)}>
          <Pressable style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{t('household.switchHouseholdTitle')}</Text>
            {myHouseholds.map(h => (
              <TouchableOpacity key={h.id} style={styles.switchRow} onPress={() => handleSwitch(h.id)}>
                <Text style={styles.switchName}>{h.name}</Text>
                {h.id === household?.id && <Text style={styles.switchActive}>{t('household.activeLabel')}</Text>}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.closeBtn} onPress={() => setShowSwitcher(false)}>
              <Text style={styles.closeBtnText}>{t('common.close')}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <EditModal
        visible={showChangePw}
        title={t('household.changePasswordTitle')}
        label={t('household.changePasswordLabelText')}
        placeholder={t('household.newPasswordPlaceholder')}
        secure
        saveLabel={t('household.savePasswordButton')}
        onClose={() => setShowChangePw(false)}
        onSave={handleChangePassword}
      />
    </SafeAreaView>
  );
}

function makeStyles(colors: ColorPalette) { return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerTitle: { ...typography.h2, color: colors.text },
  headerSub: { ...typography.sm, color: colors.textSecondary, marginTop: 2 },
  inviteBtn: { backgroundColor: colors.brand, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  inviteBtnText: { ...typography.sm, color: colors.textInverse, fontWeight: '700' },

  inviteBanner: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.brandDark, borderRadius: radius.lg, padding: spacing.lg,
    marginBottom: spacing.md, ...shadow.md,
  },
  inviteBannerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  inviteBannerEmoji: { fontSize: 32 },
  inviteBannerTitle: { ...typography.body, color: colors.textInverse, fontWeight: '700' },
  inviteBannerSub: { ...typography.sm, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  inviteBannerCode: { color: colors.brandLight, fontWeight: '800', fontFamily: 'monospace' },
  inviteBannerArrow: { fontSize: 28, color: 'rgba(255,255,255,0.5)' },

  scoreCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg,
    marginBottom: spacing.md, ...shadow.sm,
  },
  scoreTitle: { ...typography.h3, color: colors.text, marginBottom: 4 },
  scoreWeek: { ...typography.xs, color: colors.textMuted, marginBottom: spacing.md },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  scoreRank: { fontSize: 20, width: 28 },
  scoreName: { ...typography.sm, color: colors.text, fontWeight: '600', width: 60 },
  scoreBarWrap: { flex: 1, height: 8, backgroundColor: colors.border, borderRadius: 4, overflow: 'hidden' },
  scoreBarFill: { height: '100%', borderRadius: 4 },
  scorePoints: { ...typography.sm, color: colors.textSecondary, fontWeight: '700', width: 50, textAlign: 'right' },

  sectionTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.md, marginTop: spacing.sm },

  memberCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.md, marginBottom: spacing.sm, ...shadow.sm,
  },
  memberInfo: { flex: 1, marginLeft: spacing.md },
  memberNameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 4 },
  memberName: { ...typography.body, color: colors.text, fontWeight: '600' },
  meBadge: { backgroundColor: colors.brandPale, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  meBadgeText: { ...typography.xs, color: colors.brand, fontWeight: '700' },
  adminBadge: { backgroundColor: '#FEF3C7', borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  adminBadgeText: { ...typography.xs, color: '#D97706', fontWeight: '700' },
  memberStats: { flexDirection: 'row', gap: spacing.md },
  memberStat: { ...typography.xs, color: colors.textSecondary },
  removeMemberBtn: { padding: spacing.sm },
  removeMemberBtnText: { fontSize: 22, color: colors.textMuted },

  joinBtn: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg,
    alignItems: 'center', marginBottom: spacing.md, borderWidth: 1.5,
    borderColor: colors.border, borderStyle: 'dashed',
  },
  joinBtnText: { ...typography.body, color: colors.textSecondary, fontWeight: '600' },

  infoCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg,
    marginBottom: spacing.md, ...shadow.sm,
  },
  infoTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.md },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  infoLabel: { ...typography.sm, color: colors.textSecondary },
  infoValue: { ...typography.sm, color: colors.text, fontWeight: '600' },

  settingsBtn: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, alignItems: 'center', marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  settingsBtnText: { ...typography.body, color: colors.text, fontWeight: '600' },
  themeChip: { alignItems: 'center', width: 84, paddingVertical: spacing.sm, paddingHorizontal: spacing.xs, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border },
  themeSwatch: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  themeSwatchEmoji: { fontSize: 18 },
  themeChipText: { ...typography.xs, color: colors.textSecondary, textAlign: 'center' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.md, paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  switchName: { ...typography.body, color: colors.text, fontWeight: '600' },
  switchActive: { ...typography.sm, color: colors.brand, fontWeight: '700' },
  signOutBtn: { padding: spacing.md, alignItems: 'center', marginTop: spacing.sm },
  signOutBtnText: { ...typography.body, color: colors.error, fontWeight: '600' },

  // Modal
  modalOverlay: { flex: 1, justifyContent: Platform.OS === 'web' ? 'flex-start' : 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: {
    backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    padding: spacing.lg, paddingBottom: spacing.xxl,
    maxHeight: Platform.OS === 'web' ? '100%' : undefined,
  },
  modalHandle: { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.lg },
  modalTitle: { ...typography.h2, color: colors.text, marginBottom: spacing.sm },
  modalSub: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.xl },
  codeBox: {
    backgroundColor: colors.brandPale, borderRadius: radius.lg, padding: spacing.xl,
    alignItems: 'center', marginBottom: spacing.lg, borderWidth: 2, borderColor: colors.brand,
  },
  codeText: { fontSize: 36, fontWeight: '800', color: colors.brand, letterSpacing: 6, fontFamily: 'monospace' },
  codeCopyHint: { ...typography.xs, color: colors.textSecondary, marginTop: spacing.sm },
  codeInput: {
    backgroundColor: colors.background, borderRadius: radius.md, padding: spacing.lg,
    fontSize: 28, fontWeight: '800', color: colors.text, textAlign: 'center',
    letterSpacing: 6, borderWidth: 2, borderColor: colors.border, marginBottom: spacing.lg,
  },
  shareBtn: {
    backgroundColor: colors.brand, borderRadius: radius.md, padding: spacing.md,
    alignItems: 'center', marginBottom: spacing.sm,
  },
  shareBtnText: { ...typography.body, color: colors.textInverse, fontWeight: '700' },
  webHint: { ...typography.xs, color: colors.textMuted, textAlign: 'center', marginBottom: spacing.sm },
  closeBtn: { padding: spacing.md, alignItems: 'center' },
  closeBtnText: { ...typography.body, color: colors.textSecondary },

  // Dark mode toggle switch
  toggle: { width: 48, height: 28, borderRadius: 14, backgroundColor: colors.border, justifyContent: 'center', paddingHorizontal: 3 },
  toggleOn: { backgroundColor: colors.brand },
  toggleThumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', alignSelf: 'flex-start' },
  toggleThumbOn: { alignSelf: 'flex-end' },
}); }
