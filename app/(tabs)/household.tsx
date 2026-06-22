// app/(tabs)/household.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, Share, Modal, Pressable, TextInput, Platform, KeyboardAvoidingView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
const hapticNotification = (type: Haptics.NotificationFeedbackType) => { if (Platform.OS !== 'web') Haptics.notificationAsync(type); };
import { colors, spacing, radius, typography, shadow, AVATAR_COLORS } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { useStore } from '../../store/useStore';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { de } from 'date-fns/locale';

// ─── AVATAR ───────────────────────────────────────────────────
function Avatar({ name, color, size = 48 }: { name: string; color: string; size?: number }) {
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.38 }]}>{name[0].toUpperCase()}</Text>
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
  const handleShare = async () => {
    const message = `🏡 Ich lade dich zu unserem Haushalt "${householdName}" in Heimlig ein!\n\n👉 Einfach hier tippen, um beizutreten:\nhttps://heimlig.vercel.app/join/${inviteCode}\n\nFalls der Link nicht klappt, gib in der App diesen Code ein:\n🔑 ${inviteCode}`;
    if (Platform.OS === 'web') {
      try { await navigator.clipboard.writeText(message); Alert.alert('Kopiert! ✓', 'Einladungstext in die Zwischenablage kopiert.'); }
      catch { Alert.alert('Einladungscode', message); }
    } else {
      try { await Share.share({ message, title: 'Heimlig Einladung' }); }
      catch { Alert.alert('Fehler', 'Teilen fehlgeschlagen.'); }
    }
  };

  const handleCopy = () => {
    hapticNotification(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Kopiert! ✓', `Code "${inviteCode}" wurde kopiert.`);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Mitglied einladen</Text>
          <Text style={styles.modalSub}>Teile diesen Code mit deiner Freundin oder Familie.</Text>

          {/* Invite Code Display */}
          <TouchableOpacity style={styles.codeBox} onPress={handleCopy} activeOpacity={0.8}>
            <Text style={styles.codeText}>{inviteCode}</Text>
            <Text style={styles.codeCopyHint}>Tippen zum Kopieren</Text>
          </TouchableOpacity>

          {/* Share Button */}
          <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
            <Text style={styles.shareBtnText}>📤 Einladung teilen</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>Schließen</Text>
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
            <Text style={styles.modalTitle}>Haushalt beitreten</Text>
            <Text style={styles.modalSub}>Gib den Einladungscode ein den du erhalten hast.</Text>
            <TextInput
              style={styles.codeInput}
              placeholder="z.B. AB12CD34"
              placeholderTextColor={colors.textMuted}
              value={code}
              onChangeText={t => setCode(t.toUpperCase())}
              autoCapitalize="characters"
              autoFocus
            />
            <TouchableOpacity
              style={[styles.shareBtn, (!code || loading) && { opacity: 0.4 }]}
              onPress={handleJoin}
              disabled={!code || loading}
            >
              <Text style={styles.shareBtnText}>{loading ? 'Suche...' : '🏡 Beitreten'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>Abbrechen</Text>
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
              <Text style={styles.shareBtnText}>{loading ? 'Speichert...' : (saveLabel ?? 'Speichern')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>Abbrechen</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── MAIN SCREEN ──────────────────────────────────────────────
export default function HouseholdScreen() {
  const { household, currentMember, members, setMembers, setHousehold, tasks, transactions,
    myHouseholds, loadMyHouseholds, switchHousehold, leaveHousehold } = useStore();
  const [showInvite, setShowInvite] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [showEditName, setShowEditName] = useState(false);
  const [showChangePw, setShowChangePw] = useState(false);
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
    Alert.alert('Haushalt verlassen?', `Möchtest du „${household.name}" wirklich verlassen?`, [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Verlassen', style: 'destructive', onPress: async () => {
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
    if (error) { Alert.alert('Fehler', error.message); return; }
    setHousehold({ ...household, name });
    setShowEditName(false);
  };

  const handleToggleGamification = async () => {
    if (!household) return;
    if (currentMember?.role !== 'admin') { Alert.alert('Keine Berechtigung', 'Nur Admins können das ändern.'); return; }
    const next = household.gamification_enabled === false; // currently off → turn on
    const { error } = await supabase.from('households').update({ gamification_enabled: next }).eq('id', household.id);
    if (error) { Alert.alert('Fehler', error.message); return; }
    setHousehold({ ...household, gamification_enabled: next });
  };

  const handleChangePassword = async (password: string) => {
    if (password.length < 6) { Alert.alert('Zu kurz', 'Das Passwort muss mindestens 6 Zeichen haben.'); return; }
    const { error } = await supabase.auth.updateUser({ password });
    if (error) { Alert.alert('Fehler', error.message); return; }
    setShowChangePw(false);
    Alert.alert('✓ Geändert', 'Dein Passwort wurde aktualisiert.');
  };

  // Calculate this week's scores from completed tasks
  useEffect(() => {
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
    const scores: Record<string, number> = {};

    tasks.forEach(t => {
      if (t.completed_at && t.completed_by) {
        const completedDate = new Date(t.completed_at);
        if (completedDate >= weekStart && completedDate <= weekEnd) {
          scores[t.completed_by] = (scores[t.completed_by] || 0) + (t.points || 10);
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
      Alert.alert('Fehler', error.message || 'Beitreten fehlgeschlagen.');
      return;
    }

    if (result?.error) {
      Alert.alert('Nicht gefunden', result.error);
      return;
    }

    Alert.alert('Willkommen! 🎉', `Du bist jetzt Mitglied von "${result.household_name}".`);
    setShowJoin(false);
  };

  const handleRemoveMember = (memberId: string, memberName: string) => {
    if (currentMember?.role !== 'admin') {
      Alert.alert('Keine Berechtigung', 'Nur Admins können Mitglieder entfernen.');
      return;
    }
    if (memberId === currentMember?.id) {
      Alert.alert('Nicht möglich', 'Du kannst dich nicht selbst entfernen.');
      return;
    }
    Alert.alert('Mitglied entfernen', `${memberName} aus dem Haushalt entfernen?`, [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Entfernen', style: 'destructive', onPress: async () => {
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
          <Text style={styles.headerTitle}>👥 Haushalt</Text>
          <Text style={styles.headerSub}>
            {household?.name ?? 'Mein Haushalt'}{myHouseholds.length > 1 ? '  ▾' : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.inviteBtn} onPress={() => setShowInvite(true)}>
          <Text style={styles.inviteBtnText}>+ Einladen</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

        {/* Invite Banner */}
        <TouchableOpacity style={styles.inviteBanner} onPress={() => setShowInvite(true)} activeOpacity={0.85}>
          <View style={styles.inviteBannerLeft}>
            <Text style={styles.inviteBannerEmoji}>📨</Text>
            <View>
              <Text style={styles.inviteBannerTitle}>Jemanden einladen</Text>
              <Text style={styles.inviteBannerSub}>Code teilen: <Text style={styles.inviteBannerCode}>{household?.invite_code}</Text></Text>
            </View>
          </View>
          <Text style={styles.inviteBannerArrow}>›</Text>
        </TouchableOpacity>

        {/* Weekly Score */}
        {household?.gamification_enabled !== false && members.length > 1 && totalWeekPoints > 0 && (
          <View style={styles.scoreCard}>
            <Text style={styles.scoreTitle}>🏆 Diese Woche</Text>
            <Text style={styles.scoreWeek}>{format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'dd. MMM', { locale: de })} – {format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'dd. MMM', { locale: de })}</Text>
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
                  <Text style={styles.scorePoints}>{score} Pkt</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Members */}
        <Text style={styles.sectionTitle}>Mitglieder ({members.length})</Text>
        {members.map(m => {
          const isMe = m.id === currentMember?.id;
          const expense = memberExpenses[m.id] || 0;
          const tasksCompleted = tasks.filter(t => t.completed_by === m.id).length;

          return (
            <View key={m.id} style={styles.memberCard}>
              <Avatar name={m.display_name} color={m.avatar_color} size={48} />
              <View style={styles.memberInfo}>
                <View style={styles.memberNameRow}>
                  <Text style={styles.memberName}>{m.display_name}</Text>
                  {isMe && <View style={styles.meBadge}><Text style={styles.meBadgeText}>Du</Text></View>}
                  {m.role === 'admin' && <View style={styles.adminBadge}><Text style={styles.adminBadgeText}>Admin</Text></View>}
                </View>
                <View style={styles.memberStats}>
                  <Text style={styles.memberStat}>✅ {tasksCompleted} erledigt</Text>
                  {expense > 0 && <Text style={styles.memberStat}>💶 € {expense.toFixed(0)} diesen Monat</Text>}
                </View>
              </View>
              {!isMe && currentMember?.role === 'admin' && (
                <TouchableOpacity onPress={() => handleRemoveMember(m.id, m.display_name)} style={styles.removeMemberBtn}>
                  <Text style={styles.removeMemberBtnText}>×</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}

        {/* Join another household */}
        <TouchableOpacity style={styles.joinBtn} onPress={() => setShowJoin(true)}>
          <Text style={styles.joinBtnText}>🔑 Anderem Haushalt beitreten</Text>
        </TouchableOpacity>

        {/* Household Info */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Haushalt-Info</Text>
          <TouchableOpacity
            style={styles.infoRow}
            onPress={() => currentMember?.role === 'admin' ? setShowEditName(true) : Alert.alert('Keine Berechtigung', 'Nur Admins können den Haushaltsnamen ändern.')}
            activeOpacity={0.6}
          >
            <Text style={styles.infoLabel}>Name</Text>
            <Text style={styles.infoValue}>{household?.name}{currentMember?.role === 'admin' ? '  ✏️' : ''}</Text>
          </TouchableOpacity>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Plan</Text>
            <Text style={styles.infoValue}>{household?.plan_tier === 'free' ? 'Kostenlos' : 'Premium'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Mitglieder</Text>
            <Text style={styles.infoValue}>{members.length} / {household?.plan_tier === 'free' ? '3' : '6'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Einladungscode</Text>
            <Text style={[styles.infoValue, { fontFamily: 'monospace', color: colors.brand }]}>{household?.invite_code}</Text>
          </View>
        </View>

        {/* Gamification toggle */}
        <TouchableOpacity style={styles.settingsBtn} onPress={handleToggleGamification}>
          <Text style={styles.settingsBtnText}>
            🏆 Punkte & Scoreboard: {household?.gamification_enabled === false ? 'Aus' : 'An'}
          </Text>
        </TouchableOpacity>

        {/* Change password */}
        <TouchableOpacity style={styles.settingsBtn} onPress={() => setShowChangePw(true)}>
          <Text style={styles.settingsBtnText}>🔑 Passwort ändern</Text>
        </TouchableOpacity>

        {/* Leave household */}
        <TouchableOpacity style={styles.settingsBtn} onPress={handleLeave}>
          <Text style={[styles.settingsBtnText, { color: colors.error }]}>🚪 Haushalt verlassen</Text>
        </TouchableOpacity>

        {/* Sign out */}
        <TouchableOpacity
          style={styles.signOutBtn}
          onPress={() => Alert.alert('Abmelden', 'Wirklich abmelden?', [
            { text: 'Abbrechen', style: 'cancel' },
            { text: 'Abmelden', style: 'destructive', onPress: () => supabase.auth.signOut() }
          ])}
        >
          <Text style={styles.signOutBtnText}>Abmelden</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

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
        title="Haushalt umbenennen"
        label="Neuer Name für euren Haushalt"
        placeholder="z.B. Unser Zuhause"
        initialValue={household?.name}
        onClose={() => setShowEditName(false)}
        onSave={handleRenameHousehold}
      />
      <Modal visible={showSwitcher} transparent animationType="slide" onRequestClose={() => setShowSwitcher(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowSwitcher(false)}>
          <Pressable style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Haushalt wechseln</Text>
            {myHouseholds.map(h => (
              <TouchableOpacity key={h.id} style={styles.switchRow} onPress={() => handleSwitch(h.id)}>
                <Text style={styles.switchName}>{h.name}</Text>
                {h.id === household?.id && <Text style={styles.switchActive}>✓ Aktiv</Text>}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.closeBtn} onPress={() => setShowSwitcher(false)}>
              <Text style={styles.closeBtnText}>Schließen</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <EditModal
        visible={showChangePw}
        title="Passwort ändern"
        label="Gib dein neues Passwort ein (mind. 6 Zeichen)"
        placeholder="Neues Passwort"
        secure
        saveLabel="Passwort speichern"
        onClose={() => setShowChangePw(false)}
        onSave={handleChangePassword}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  inviteBtnText: { ...typography.sm, color: '#fff', fontWeight: '700' },

  inviteBanner: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.brandDark, borderRadius: radius.lg, padding: spacing.lg,
    marginBottom: spacing.md, ...shadow.md,
  },
  inviteBannerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  inviteBannerEmoji: { fontSize: 32 },
  inviteBannerTitle: { ...typography.body, color: '#fff', fontWeight: '700' },
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
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.md, paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  switchName: { ...typography.body, color: colors.text, fontWeight: '600' },
  switchActive: { ...typography.sm, color: colors.brand, fontWeight: '700' },
  signOutBtn: { padding: spacing.md, alignItems: 'center', marginTop: spacing.sm },
  signOutBtnText: { ...typography.body, color: colors.error, fontWeight: '600' },

  avatar: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '800' },

  // Modal
  modalOverlay: { flex: 1, justifyContent: Platform.OS === 'web' ? 'flex-start' : 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: {
    backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
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
  shareBtnText: { ...typography.body, color: '#fff', fontWeight: '700' },
  closeBtn: { padding: spacing.md, alignItems: 'center' },
  closeBtnText: { ...typography.body, color: colors.textSecondary },
});
