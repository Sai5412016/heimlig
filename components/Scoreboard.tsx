// components/Scoreboard.tsx — monthly household scoreboard with fun titles
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { colors, spacing, radius, typography, shadow, type ColorPalette } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { supabase, Member } from '../lib/supabase';
import { taskPoints, titleForPoints } from '../lib/gamification';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { de } from 'date-fns/locale';

interface Row { member: Member; points: number; done: number }

// Sum points of tasks completed in [start, end] grouped by member
export async function monthlyScores(householdId: string, members: Member[], monthDate: Date): Promise<Row[]> {
  const start = startOfMonth(monthDate).toISOString();
  const end = endOfMonth(monthDate).toISOString();
  const { data } = await supabase
    .from('tasks')
    .select('points, priority, category, completed_by, completed_at')
    .eq('household_id', householdId)
    .not('completed_at', 'is', null)
    .gte('completed_at', start)
    .lte('completed_at', end);

  const byMember: Record<string, { points: number; done: number }> = {};
  (data || []).forEach(t => {
    if (!t.completed_by || t.category === 'Geburtstag') return;
    const p = taskPoints(t as any);
    const cur = byMember[t.completed_by] || { points: 0, done: 0 };
    byMember[t.completed_by] = { points: cur.points + p, done: cur.done + 1 };
  });

  return members
    .map(m => ({ member: m, points: byMember[m.id]?.points || 0, done: byMember[m.id]?.done || 0 }))
    .sort((a, b) => b.points - a.points);
}

const MEDALS = ['🥇', '🥈', '🥉'];

export default function Scoreboard({ visible, onClose, householdId, members, currentMemberId }: {
  visible: boolean;
  onClose: () => void;
  householdId: string;
  members: Member[];
  currentMemberId?: string;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const now = new Date();

  const load = useCallback(async () => {
    setLoading(true);
    const r = await monthlyScores(householdId, members, now);
    setRows(r);
    setLoading(false);
  }, [householdId, members]);

  useEffect(() => { if (visible) load(); }, [visible, load]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>🏆 Scoreboard</Text>
          <Text style={styles.sub}>{format(now, 'MMMM yyyy', { locale: de })}</Text>

          {loading ? (
            <ActivityIndicator color={colors.brand} style={{ marginVertical: spacing.xl }} />
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              {rows.map((r, i) => {
                const isMe = r.member.id === currentMemberId;
                return (
                  <View key={r.member.id} style={[styles.row, isMe && styles.rowMe]}>
                    <Text style={styles.rank}>{MEDALS[i] || `${i + 1}.`}</Text>
                    <View style={[styles.avatar, { backgroundColor: r.member.avatar_color }]}>
                      <Text style={styles.avatarText}>{r.member.display_name[0]?.toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>{r.member.display_name}{isMe ? ' (Du)' : ''}</Text>
                      <Text style={styles.memberTitle}>{titleForPoints(r.points)}</Text>
                    </View>
                    <View style={styles.pointsWrap}>
                      <Text style={styles.points}>{r.points}</Text>
                      <Text style={styles.pointsLabel}>Pkt · {r.done}✓</Text>
                    </View>
                  </View>
                );
              })}
              <Text style={styles.footnote}>Punkte werden jeden Monat zurückgesetzt. Am Monatsende wird der/die Heimlig-Haushälter:in des Monats gekürt! 🎉</Text>
            </ScrollView>
          )}

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
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, paddingBottom: spacing.xxl, maxHeight: '85%' },
  handle: { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.lg },
  title: { ...typography.h2, color: colors.text, textAlign: 'center' },
  sub: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, borderRadius: radius.md, marginBottom: spacing.xs },
  rowMe: { backgroundColor: colors.brandPale },
  rank: { fontSize: 20, width: 32, textAlign: 'center', fontWeight: '800', color: colors.textSecondary },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  name: { ...typography.body, color: colors.text, fontWeight: '700' },
  memberTitle: { ...typography.sm, color: colors.brand, fontWeight: '600' },
  pointsWrap: { alignItems: 'flex-end' },
  points: { ...typography.h3, color: colors.text, fontWeight: '800' },
  pointsLabel: { ...typography.xs, color: colors.textMuted },
  footnote: { ...typography.xs, color: colors.textMuted, textAlign: 'center', marginTop: spacing.lg, marginHorizontal: spacing.md },
  closeBtn: { padding: spacing.md, alignItems: 'center', marginTop: spacing.sm },
  closeBtnText: { ...typography.body, color: colors.textSecondary },
}); }
