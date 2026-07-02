// components/BudgetSplitModal.tsx — "who owes whom" for shared household expenses (Splitwise-style).
// Splits all logged expenses equally among members based on who entered each one, then nets out
// recorded settlements and suggests the fewest payments to balance everyone.
import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity, Pressable, Alert } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { spacing, radius, typography, type ColorPalette } from '../constants/theme';
import { useStore } from '../store/useStore';

const eur = (n: number) => `€${n.toFixed(2).replace('.', ',')}`;

export default function BudgetSplitModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { transactions, members, settlements, loadSettlements, addSettlement } = useStore();

  useEffect(() => { if (visible) loadSettlements(); }, [visible]);

  const { net, suggestions } = useMemo(() => {
    const expenses = transactions.filter(t => t.type === 'expense' && (t as any).member_id);
    const total = expenses.reduce((s, t) => s + Number(t.amount), 0);
    const N = members.length || 1;
    const share = total / N;

    const net: Record<string, number> = {};
    members.forEach(m => { net[m.id] = -share; });
    expenses.forEach(t => { const mid = (t as any).member_id; if (net[mid] !== undefined) net[mid] += Number(t.amount); });
    settlements.forEach(s => {
      if (net[s.from_member] !== undefined) net[s.from_member] += Number(s.amount);
      if (net[s.to_member] !== undefined) net[s.to_member] -= Number(s.amount);
    });

    // Greedy minimal settlements
    const debt = members.map(m => ({ id: m.id, amt: net[m.id] })).filter(x => x.amt < -0.01).sort((a, b) => a.amt - b.amt);
    const cred = members.map(m => ({ id: m.id, amt: net[m.id] })).filter(x => x.amt > 0.01).sort((a, b) => b.amt - a.amt);
    const suggestions: { from: string; to: string; amount: number }[] = [];
    let di = 0, ci = 0;
    while (di < debt.length && ci < cred.length) {
      const pay = Math.min(-debt[di].amt, cred[ci].amt);
      suggestions.push({ from: debt[di].id, to: cred[ci].id, amount: Math.round(pay * 100) / 100 });
      debt[di].amt += pay; cred[ci].amt -= pay;
      if (Math.abs(debt[di].amt) < 0.01) di++;
      if (cred[ci].amt < 0.01) ci++;
    }
    return { net, suggestions };
  }, [transactions, members, settlements]);

  const name = (id: string) => members.find(m => m.id === id)?.display_name ?? '?';

  const settle = (from: string, to: string, amount: number) => {
    Alert.alert('Als ausgeglichen markieren?', `${name(from)} zahlt ${name(to)} ${eur(amount)}.`, [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Ausgeglichen', onPress: () => addSettlement(from, to, amount) },
    ]);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)' }]} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>💸 Ausgleich</Text>
          <Text style={styles.subtitle}>Alle Ausgaben gleichmäßig geteilt – je nachdem, wer sie eingetragen hat.</Text>

          <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
            <Text style={styles.sectionLabel}>SALDO</Text>
            {members.map(m => {
              const v = net[m.id] ?? 0;
              const settled = Math.abs(v) < 0.01;
              return (
                <View key={m.id} style={styles.balanceRow}>
                  <Text style={styles.balanceName}>{m.display_name}</Text>
                  <Text style={[styles.balanceVal, { color: settled ? colors.textMuted : v > 0 ? '#2D9E57' : '#E5573F' }]}>
                    {settled ? 'ausgeglichen' : v > 0 ? `bekommt ${eur(v)}` : `schuldet ${eur(-v)}`}
                  </Text>
                </View>
              );
            })}

            {suggestions.length > 0 ? (
              <>
                <Text style={styles.sectionLabel}>VORSCHLAG ZUM AUSGLEICHEN</Text>
                {suggestions.map((s, i) => (
                  <View key={i} style={styles.suggRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.suggText}>{name(s.from)} → {name(s.to)}</Text>
                      <Text style={styles.suggAmount}>{eur(s.amount)}</Text>
                    </View>
                    <TouchableOpacity style={styles.settleBtn} onPress={() => settle(s.from, s.to, s.amount)}>
                      <Text style={styles.settleBtnText}>Ausgeglichen</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </>
            ) : (
              <Text style={styles.allEven}>🎉 Alles ausgeglichen!</Text>
            )}

            {settlements.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>LETZTE AUSGLEICHE</Text>
                {settlements.slice(0, 8).map(s => (
                  <View key={s.id} style={styles.histRow}>
                    <Text style={styles.histText}>{name(s.from_member)} → {name(s.to_member)}</Text>
                    <Text style={styles.histAmount}>{eur(Number(s.amount))}</Text>
                  </View>
                ))}
              </>
            )}
          </ScrollView>

          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>Schließen</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(colors: ColorPalette) { return StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, paddingBottom: spacing.xl },
  handle: { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.md },
  title: { ...typography.h2, color: colors.text },
  subtitle: { ...typography.sm, color: colors.textSecondary, marginTop: 2, marginBottom: spacing.md },
  sectionLabel: { ...typography.label, color: colors.textMuted, marginTop: spacing.lg, marginBottom: spacing.sm, textTransform: 'uppercase' },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  balanceName: { ...typography.body, color: colors.text, fontWeight: '600' },
  balanceVal: { ...typography.body, fontWeight: '700' },
  suggRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm },
  suggText: { ...typography.body, color: colors.text, fontWeight: '600' },
  suggAmount: { ...typography.sm, color: colors.textSecondary, marginTop: 1 },
  settleBtn: { backgroundColor: colors.brand, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  settleBtnText: { ...typography.sm, color: '#fff', fontWeight: '700' },
  allEven: { ...typography.body, color: colors.textSecondary, textAlign: 'center', paddingVertical: spacing.lg },
  histRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs },
  histText: { ...typography.sm, color: colors.text },
  histAmount: { ...typography.sm, color: colors.textSecondary, fontWeight: '600' },
  closeBtn: { padding: spacing.md, alignItems: 'center', marginTop: spacing.sm },
  closeBtnText: { ...typography.body, color: colors.textSecondary },
}); }
