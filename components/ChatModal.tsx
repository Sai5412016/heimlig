// components/ChatModal.tsx — shared household pinboard / chat (realtime).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, ScrollView, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { spacing, radius, typography, type ColorPalette } from '../constants/theme';
import { useStore } from '../store/useStore';
import { supabase } from '../lib/supabase';
import { format, parseISO, isToday } from 'date-fns';
import { de } from 'date-fns/locale';

export default function ChatModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { household, currentMember, members, messages, loadMessages, sendMessage } = useStore();
  const [text, setText] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  // Load + live-subscribe while open.
  useEffect(() => {
    if (!visible || !household) return;
    loadMessages();
    const channel = supabase
      .channel(`household_messages:${household.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'household_messages',
        filter: `household_id=eq.${household.id}`,
      }, () => loadMessages())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [visible, household?.id]);

  useEffect(() => {
    if (visible) setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
  }, [messages.length, visible]);

  const memberOf = (id?: string) => members.find(m => m.id === id);

  const handleSend = async () => {
    const t = text.trim();
    if (!t) return;
    setText('');
    await sendMessage(t);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <Text style={styles.topTitle}>💬 Pinnwand</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.closeX}>✕</Text>
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            {messages.length === 0 && (
              <Text style={styles.empty}>Noch keine Nachrichten. Schreibt hier, was alle im Haushalt sehen sollen – Einkaufswünsche, Erinnerungen, kurze Absprachen.</Text>
            )}
            {messages.map(m => {
              const mine = m.member_id === currentMember?.id;
              const mem = memberOf(m.member_id);
              const time = format(parseISO(m.created_at), isToday(parseISO(m.created_at)) ? 'HH:mm' : 'dd.MM. HH:mm', { locale: de });
              return (
                <View key={m.id} style={[styles.row, mine ? styles.rowMine : styles.rowOther]}>
                  <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
                    {!mine && (
                      <Text style={[styles.author, { color: mem?.avatar_color ?? colors.brand }]}>{mem?.display_name ?? 'Jemand'}</Text>
                    )}
                    <Text style={[styles.msgText, mine && { color: '#fff' }]}>{m.text}</Text>
                    <Text style={[styles.time, mine && { color: 'rgba(255,255,255,0.7)' }]}>{time}</Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>

          <View style={styles.inputBar}>
            <TextInput
              style={styles.input}
              placeholder="Nachricht schreiben…"
              placeholderTextColor={colors.textMuted}
              value={text}
              onChangeText={setText}
              multiline
              returnKeyType="send"
              onSubmitEditing={handleSend}
            />
            <TouchableOpacity style={[styles.sendBtn, !text.trim() && { opacity: 0.5 }]} onPress={handleSend} disabled={!text.trim()}>
              <Text style={styles.sendBtnText}>➤</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

function makeStyles(colors: ColorPalette) { return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  topTitle: { ...typography.h3, color: colors.text },
  closeX: { fontSize: 22, color: colors.textSecondary, fontWeight: '600' },
  scroll: { padding: spacing.md, gap: spacing.xs },
  empty: { ...typography.sm, color: colors.textSecondary, textAlign: 'center', paddingVertical: spacing.xxl, paddingHorizontal: spacing.lg },
  row: { flexDirection: 'row', marginBottom: spacing.xs },
  rowMine: { justifyContent: 'flex-end' },
  rowOther: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '80%', borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  bubbleMine: { backgroundColor: colors.brand, borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: colors.surface, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: colors.border },
  author: { ...typography.xs, fontWeight: '800', marginBottom: 2 },
  msgText: { ...typography.body, color: colors.text },
  time: { ...typography.xs, color: colors.textMuted, marginTop: 2, alignSelf: 'flex-end' },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, padding: spacing.sm, paddingHorizontal: spacing.md, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  input: { flex: 1, maxHeight: 120, backgroundColor: colors.background, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, ...typography.body, color: colors.text, borderWidth: 1, borderColor: colors.border },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  sendBtnText: { color: '#fff', fontSize: 18 },
}); }
