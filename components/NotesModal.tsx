// components/NotesModal.tsx — shared household notes/documents (WLAN, insurance, info …).
import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity, TextInput, Pressable,
} from 'react-native';
import { Alert } from '../lib/alert';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../hooks/useTheme';
import { spacing, radius, typography, type ColorPalette } from '../constants/theme';
import { useStore } from '../store/useStore';
import type { HouseholdNote } from '../lib/supabase';

export default function NotesModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
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
    Alert.alert(t('notes.deleteConfirmTitle'), note.title, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => { deleteNote(note.id); setEditing(null); } },
    ]);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)' }]} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          {editing ? (
            <>
              <Text style={styles.title}>{editing === 'new' ? t('notes.newNoteTitle') : t('notes.editNoteTitle')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('notes.titlePlaceholder')}
                placeholderTextColor={colors.textMuted}
                value={title}
                onChangeText={setTitle}
              />
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                placeholder={t('notes.contentPlaceholder')}
                placeholderTextColor={colors.textMuted}
                value={content}
                onChangeText={setContent}
                multiline
                textAlignVertical="top"
              />
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <TouchableOpacity style={[styles.btn, { backgroundColor: colors.border, flex: 1 }]} onPress={() => setEditing(null)}>
                  <Text style={[styles.btnText, { color: colors.text }]}>{t('common.back')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btn, { flex: 1 }, !title.trim() && { opacity: 0.5 }]} onPress={handleSave} disabled={!title.trim()}>
                  <Text style={styles.btnText}>{t('common.save')}</Text>
                </TouchableOpacity>
              </View>
              {editing !== 'new' && (
                <TouchableOpacity style={styles.deleteLink} onPress={() => confirmDelete(editing)}>
                  <Text style={styles.deleteLinkText}>{t('common.delete')}</Text>
                </TouchableOpacity>
              )}
            </>
          ) : (
            <>
              <Text style={styles.title}>{t('household.notesLabel')}</Text>
              <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
                {notes.length === 0 && (
                  <Text style={styles.empty}>{t('notes.emptyBody')}</Text>
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
                  <Text style={styles.newBtnText}>{t('notes.newNoteButton')}</Text>
                </TouchableOpacity>
              </ScrollView>
              <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                <Text style={styles.closeBtnText}>{t('common.close')}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(colors: ColorPalette) { return StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingBottom: spacing.xl },
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
