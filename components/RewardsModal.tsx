// components/RewardsModal.tsx — reward shop: spend earned points on family-defined rewards.
import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity, TextInput, Pressable, Alert,
} from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { spacing, radius, typography, shadow, type ColorPalette } from '../constants/theme';
import { useStore } from '../store/useStore';
import type { Reward } from '../lib/supabase';

const REWARD_EMOJIS = ['🎁', '🍕', '🍦', '🎮', '📺', '🎬', '💸', '🛍️', '⚽', '🏖️', '🍫', '😴'];

export default function RewardsModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { currentMember, members, rewards, redemptions, loadRewards, addReward, deleteReward, redeemReward, rewardBalance } = useStore();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [emoji, setEmoji] = useState('🎁');
  const [cost, setCost] = useState(20);

  useEffect(() => { if (visible) loadRewards(); }, [visible]);

  const myBalance = currentMember ? rewardBalance(currentMember.id) : 0;
  const memberName = (id: string) => members.find(m => m.id === id)?.display_name ?? '?';

  const handleAdd = async () => {
    if (!title.trim()) return;
    await addReward(title.trim(), emoji, cost);
    setTitle(''); setEmoji('🎁'); setCost(20); setAdding(false);
  };

  const handleRedeem = (reward: Reward) => {
    if (!currentMember) return;
    if (myBalance < reward.cost) { Alert.alert('Nicht genug Punkte', `Du brauchst ${reward.cost} Punkte, hast aber ${myBalance}.`); return; }
    Alert.alert(`${reward.emoji ?? '🎁'} ${reward.title} einlösen?`, `Das kostet ${reward.cost} Punkte. Du hast ${myBalance}.`, [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Einlösen', onPress: async () => {
        const ok = await redeemReward(reward, currentMember.id);
        if (ok) Alert.alert('🎉 Eingelöst!', `Viel Spaß mit „${reward.title}"!`);
      } },
    ]);
  };

  const confirmDeleteReward = (reward: Reward) => {
    Alert.alert('Belohnung löschen?', reward.title, [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Löschen', style: 'destructive', onPress: () => deleteReward(reward.id) },
    ]);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>🎁 Belohnungen</Text>

          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>Dein Guthaben</Text>
            <Text style={styles.balanceValue}>{myBalance} <Text style={styles.balanceUnit}>Punkte</Text></Text>
          </View>

          <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
            {rewards.length === 0 && !adding && (
              <Text style={styles.empty}>Noch keine Belohnungen. Legt welche an – z. B. „Pizza-Abend" oder „1h Bildschirmzeit".</Text>
            )}

            {rewards.map(r => {
              const affordable = myBalance >= r.cost;
              return (
                <View key={r.id} style={styles.rewardRow}>
                  <Text style={styles.rewardEmoji}>{r.emoji ?? '🎁'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rewardTitle}>{r.title}</Text>
                    <Text style={styles.rewardCost}>{r.cost} Punkte</Text>
                  </View>
                  <TouchableOpacity onPress={() => confirmDeleteReward(r)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={styles.trash}>🗑</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.redeemBtn, !affordable && styles.redeemBtnOff]}
                    onPress={() => handleRedeem(r)}
                    disabled={!affordable}
                  >
                    <Text style={[styles.redeemBtnText, !affordable && { color: colors.textMuted }]}>Einlösen</Text>
                  </TouchableOpacity>
                </View>
              );
            })}

            {adding ? (
              <View style={styles.addBox}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.sm }}>
                  <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                    {REWARD_EMOJIS.map(e => (
                      <TouchableOpacity key={e} style={[styles.emojiChip, emoji === e && styles.emojiChipActive]} onPress={() => setEmoji(e)}>
                        <Text style={{ fontSize: 20 }}>{e}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
                <TextInput
                  style={styles.input}
                  placeholder="Belohnung (z. B. Pizza-Abend)"
                  placeholderTextColor={colors.textMuted}
                  value={title}
                  onChangeText={setTitle}
                />
                <View style={styles.costRow}>
                  <Text style={styles.costLabel}>Kosten</Text>
                  <TouchableOpacity style={styles.stepBtn} onPress={() => setCost(c => Math.max(5, c - 5))}><Text style={styles.stepBtnText}>−</Text></TouchableOpacity>
                  <Text style={styles.costValue}>{cost}</Text>
                  <TouchableOpacity style={styles.stepBtn} onPress={() => setCost(c => c + 5)}><Text style={styles.stepBtnText}>+</Text></TouchableOpacity>
                  <Text style={styles.costLabel}>Punkte</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.border, flex: 1 }]} onPress={() => setAdding(false)}>
                    <Text style={[styles.addBtnText, { color: colors.text }]}>Abbrechen</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.addBtn, { flex: 1 }, !title.trim() && { opacity: 0.5 }]} onPress={handleAdd} disabled={!title.trim()}>
                    <Text style={styles.addBtnText}>Hinzufügen</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity style={styles.newBtn} onPress={() => setAdding(true)}>
                <Text style={styles.newBtnText}>+ Neue Belohnung</Text>
              </TouchableOpacity>
            )}

            {redemptions.length > 0 && (
              <>
                <Text style={styles.histLabel}>VERLAUF</Text>
                {redemptions.slice(0, 15).map(rd => (
                  <View key={rd.id} style={styles.histRow}>
                    <Text style={styles.histText}>{rd.emoji ?? '🎁'} {rd.title}</Text>
                    <Text style={styles.histMeta}>{memberName(rd.member_id)} · −{rd.cost}</Text>
                  </View>
                ))}
              </>
            )}
          </ScrollView>

          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>Schließen</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function makeStyles(colors: ColorPalette) { return StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, paddingBottom: spacing.xl },
  handle: { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.md },
  title: { ...typography.h2, color: colors.text, marginBottom: spacing.md },
  balanceCard: { backgroundColor: colors.brandPale, borderRadius: radius.lg, padding: spacing.md, alignItems: 'center', marginBottom: spacing.md },
  balanceLabel: { ...typography.sm, color: colors.brand, fontWeight: '600' },
  balanceValue: { ...typography.h1, color: colors.brand },
  balanceUnit: { ...typography.body, color: colors.brand },
  empty: { ...typography.sm, color: colors.textSecondary, textAlign: 'center', paddingVertical: spacing.lg },
  rewardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  rewardEmoji: { fontSize: 26 },
  rewardTitle: { ...typography.body, color: colors.text, fontWeight: '600' },
  rewardCost: { ...typography.xs, color: colors.textSecondary, marginTop: 1 },
  trash: { fontSize: 16, paddingHorizontal: spacing.xs },
  redeemBtn: { backgroundColor: colors.brand, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  redeemBtnOff: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  redeemBtnText: { ...typography.sm, color: '#fff', fontWeight: '700' },
  addBox: { marginTop: spacing.md, backgroundColor: colors.background, borderRadius: radius.lg, padding: spacing.md },
  emojiChip: { width: 40, height: 40, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  emojiChipActive: { borderColor: colors.brand, backgroundColor: colors.brandPale },
  input: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, ...typography.body, color: colors.text, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  costRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  costLabel: { ...typography.sm, color: colors.textSecondary },
  stepBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.brandPale, alignItems: 'center', justifyContent: 'center' },
  stepBtnText: { ...typography.h3, color: colors.brand },
  costValue: { ...typography.h3, color: colors.text, minWidth: 36, textAlign: 'center' },
  addBtn: { backgroundColor: colors.brand, borderRadius: radius.md, padding: spacing.md, alignItems: 'center' },
  addBtnText: { ...typography.body, color: '#fff', fontWeight: '700' },
  newBtn: { marginTop: spacing.md, borderWidth: 1.5, borderColor: colors.brand, borderStyle: 'dashed', borderRadius: radius.md, padding: spacing.md, alignItems: 'center' },
  newBtnText: { ...typography.body, color: colors.brand, fontWeight: '600' },
  histLabel: { ...typography.label, color: colors.textMuted, marginTop: spacing.lg, marginBottom: spacing.sm, textTransform: 'uppercase' },
  histRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs },
  histText: { ...typography.sm, color: colors.text },
  histMeta: { ...typography.xs, color: colors.textSecondary },
  closeBtn: { padding: spacing.md, alignItems: 'center', marginTop: spacing.sm },
  closeBtnText: { ...typography.body, color: colors.textSecondary },
}); }
