// components/NotesModal.tsx — shared household notes/documents (WLAN, insurance, info …).
import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity, TextInput, Pressable, Alert,
} from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { spacing, radius, typography, type ColorPalette } from '../constants/theme';
import { useStore } from '../store/useStore';
import type { HouseholdNote } from '../lib/supabase';

export default function NotesModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { notes, loadNotes, saveNote, deleteNote } = useStore();
  const [editing, setEditing] = useState<HouseholdNote | 'new' | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  useEffect(() => { if (visible) loadNotes(); }, [visible]);

  const openEditor = (note: HouseholdNote | 'new') => {
    setEditing(note);
    setTitle(note === 'new' ? '' : note.title);
    setContent(note === 'new' ? '' : (note.content ?? ''));
  };

  const handleSave = async () => {
    if (!title.trim()) return;
    await saveNote({ id: editing && editing !== 'new' ? editing.id : undefined, title: title.trim(), content });
    setEditing(null);
  };

  const confirmDelete = (note: HouseholdNote) => {
    Alert.alert('Notiz löschen?', note.title, [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Löschen', style: 'destructive', onPress: () => { deleteNote(note.id); setEditing(null); } },
    ]);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet}>
          <View style={styles.handle} />

          {editing ? (
            <>
              <Text style={styles.title}>{editing === 'new' ? '📝 Neue Notiz' : '✏️ Notiz bearbeiten'}</Text>
              <TextInput
                style={styles.input}
                placeholder="Titel (z. B. WLAN-Passwort)"
                placeholderTextColor={colors.textMuted}
                value={title}
                onChangeText={setTitle}
              />
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                placeholder="Inhalt / Notiz …"
                placeholderTextColor={colors.textMuted}
                value={content}
                onChangeText={setContent}
                multiline
                textAlignVertical="top"
              />
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <TouchableOpacity style={[styles.btn, { backgroundColor: colors.border, flex: 1 }]} onPress={() => setEditing(null)}>
                  <Text style={[styles.btnText, { color: colors.text }]}>Zurück</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btn, { flex: 1 }, !title.trim() && { opacity: 0.5 }]} onPress={handleSave} disabled={!title.trim()}>
                  <Text style={styles.btnText}>Speichern</Text>
                </TouchableOpacity>
              </View>
              {editing !== 'new' && (
                <TouchableOpacity style={styles.deleteLink} onPress={() => confirmDelete(editing)}>
                  <Text style={styles.deleteLinkText}>Löschen</Text>
                </TouchableOpacity>
              )}
            </>
          ) : (
            <>
              <Text style={styles.title}>📒 Notizen & Infos</Text>
              <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
                {notes.length === 0 && (
                  <Text style={styles.empty}>Noch keine Notizen. Speichert hier wichtige Haushalts-Infos wie WLAN-Passwort, Versicherungen oder Türcodes.</Text>
                )}
                {notes.map(n => (
                  <TouchableOpacity key={n.id} style={styles.noteRow} onPress={() => openEditor(n)} activeOpacity={0.7}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.noteTitle}>{n.title}</Text>
                      {n.content ? <Text style={styles.notePreview} numberOfLines={1}>{n.content}</Text> : null}
                    </View>
                    <Text style={styles.chevron}>›</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity style={styles.newBtn} onPress={() => openEditor('new')}>
                  <Text style={styles.newBtnText}>+ Neue Notiz</Text>
                </TouchableOpacity>
              </ScrollView>
              <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                <Text style={styles.closeBtnText}>Schließen</Text>
              </TouchableOpacity>
            </>
          )}
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
  empty: { ...typography.sm, color: colors.textSecondary, textAlign: 'center', paddingVertical: spacing.lg },
  noteRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm },
  noteTitle: { ...typography.body, color: colors.text, fontWeight: '700' },
  notePreview: { ...typography.xs, color: colors.textSecondary, marginTop: 2 },
  chevron: { fontSize: 24, color: colors.textMuted, fontWeight: '300' },
  newBtn: { borderWidth: 1.5, borderColor: colors.brand, borderStyle: 'dashed', borderRadius: radius.md, padding: spacing.md, alignItems: 'center', marginTop: spacing.xs },
  newBtnText: { ...typography.body, color: colors.brand, fontWeight: '600' },
  input: { backgroundColor: colors.background, borderRadius: radius.md, padding: spacing.md, ...typography.body, color: colors.text, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  inputMultiline: { minHeight: 120 },
  btn: { backgroundColor: colors.brand, borderRadius: radius.md, padding: spacing.md, alignItems: 'center' },
  btnText: { ...typography.body, color: '#fff', fontWeight: '700' },
  deleteLink: { padding: spacing.md, alignItems: 'center' },
  deleteLinkText: { ...typography.sm, color: colors.error, fontWeight: '600' },
  closeBtn: { padding: spacing.md, alignItems: 'center', marginTop: spacing.sm },
  closeBtnText: { ...typography.body, color: colors.textSecondary },
}); }
