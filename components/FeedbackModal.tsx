// components/FeedbackModal.tsx — "Feedback & Wünsche": send feedback, feature requests, bug
// reports or questions straight from the settings screen.
//
// TEXT ONLY, by design. There is no in-app audio recording: users dictate with the microphone
// key of their device keyboard, which transcribes before a single character reaches this form.
// That keeps a transcription service, audio storage and the extra privacy surface out of the
// app entirely — the placeholder points the microphone key out so people find it.
//
// Nothing is written to the database from here. The text goes to the submit-feedback edge
// function, which runs the topic check and is the only writer of the `feedback` table.
import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, Pressable, TextInput,
  ActivityIndicator, Platform, KeyboardAvoidingView, ScrollView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';
import { spacing, radius, typography, type ColorPalette } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { useStore } from '../store/useStore';
import { supabase } from '../lib/supabase';

const hapticNotification = (type: Haptics.NotificationFeedbackType) => { if (Platform.OS !== 'web') Haptics.notificationAsync(type); };

const MAX_MESSAGE_CHARS = 4000; // mirrors MAX_MESSAGE_CHARS in supabase/functions/submit-feedback

// e.g. "1.1.0 (74)" — helps place a report against a specific build when reading the inbox.
function appVersionLabel(): string {
  const version = Constants.expoConfig?.version ?? '?';
  const build = Constants.expoConfig?.android?.versionCode;
  return build ? `${version} (${build})` : version;
}

type Phase = 'form' | 'sending' | 'delivered' | 'rejected';

export default function FeedbackModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const { household } = useStore();

  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [phase, setPhase] = useState<Phase>('form');
  const [rejectReason, setRejectReason] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  // Reset once the sheet is fully closed, so a reopened form is always clean — but a rejected
  // message keeps its text while the sheet stays open (see handleRetry) so nobody has to retype.
  useEffect(() => {
    if (!visible) {
      setMessage(''); setEmail(''); setPhase('form'); setRejectReason(null); setErrorText(null);
    }
  }, [visible]);

  const trimmed = message.trim();
  const canSend = trimmed.length > 0 && trimmed.length <= MAX_MESSAGE_CHARS && phase !== 'sending';

  const handleSend = async () => {
    if (!canSend) return;
    setPhase('sending');
    setErrorText(null);
    try {
      const { data, error } = await supabase.functions.invoke('submit-feedback', {
        body: {
          message: trimmed,
          contactEmail: email.trim() || undefined,
          householdId: household?.id,
          appVersion: appVersionLabel(),
          platform: Platform.OS,
        },
      });

      if (error) {
        // supabase-js doesn't parse the body on a non-2xx response — the edge function's
        // { error } detail lives on error.context (the raw Response).
        let serverError: string | undefined;
        try { serverError = (await error.context?.json())?.error; } catch { /* best-effort */ }
        setErrorText(serverError === 'rate_limited' ? t('feedbackModal.errorRateLimited') : t('feedbackModal.errorGeneric'));
        setPhase('form');
        return;
      }

      if (data?.status === 'rejected') {
        setRejectReason(typeof data.reason === 'string' ? data.reason : null);
        setPhase('rejected');
        return;
      }

      hapticNotification(Haptics.NotificationFeedbackType.Success);
      setPhase('delivered');
    } catch {
      setErrorText(t('feedbackModal.errorGeneric'));
      setPhase('form');
    }
  };

  // Back to the form with the original text intact — a rejected message is usually one rewrite
  // away from being fine, and retyping it is the fastest way to lose the person.
  const handleRetry = () => { setPhase('form'); setRejectReason(null); };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={[{ width: '100%' }, Platform.OS === 'web' && { flex: 1 }]}
        >
          <View style={s.sheet}>
            <View style={s.handle} />
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

              {phase === 'delivered' ? (
                <View style={s.resultBox}>
                  <Text style={s.resultEmoji}>🎉</Text>
                  <Text style={s.resultTitle}>{t('feedbackModal.deliveredTitle')}</Text>
                  <Text style={s.resultBody}>{t('feedbackModal.deliveredBody')}</Text>
                  <TouchableOpacity style={s.primaryBtn} onPress={onClose}>
                    <Text style={s.primaryBtnText}>{t('common.close')}</Text>
                  </TouchableOpacity>
                </View>
              ) : phase === 'rejected' ? (
                <View style={s.resultBox}>
                  <Text style={s.resultEmoji}>🤔</Text>
                  <Text style={s.resultTitle}>{t('feedbackModal.rejectedTitle')}</Text>
                  <Text style={s.resultBody}>{t('feedbackModal.rejectedBody')}</Text>
                  {!!rejectReason && (
                    <View style={s.reasonBox}>
                      <Text style={s.reasonText}>{rejectReason}</Text>
                    </View>
                  )}
                  <TouchableOpacity style={s.primaryBtn} onPress={handleRetry}>
                    <Text style={s.primaryBtnText}>{t('feedbackModal.rejectedRetryButton')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.secondaryBtn} onPress={onClose}>
                    <Text style={s.secondaryBtnText}>{t('common.close')}</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <Text style={s.title}>{t('feedbackModal.title')}</Text>
                  <Text style={s.subtitle}>{t('feedbackModal.subtitle')}</Text>

                  <TextInput
                    style={s.messageInput}
                    placeholder={t('feedbackModal.messagePlaceholder')}
                    placeholderTextColor={colors.textMuted}
                    value={message}
                    onChangeText={setMessage}
                    multiline
                    textAlignVertical="top"
                    maxLength={MAX_MESSAGE_CHARS}
                    editable={phase !== 'sending'}
                  />
                  <Text style={s.counter}>{trimmed.length} / {MAX_MESSAGE_CHARS}</Text>

                  <Text style={s.fieldLabel}>{t('feedbackModal.emailLabel')}</Text>
                  <TextInput
                    style={s.input}
                    placeholder={t('feedbackModal.emailPlaceholder')}
                    placeholderTextColor={colors.textMuted}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={phase !== 'sending'}
                  />
                  <Text style={s.hint}>{t('feedbackModal.emailHint')}</Text>

                  {!!errorText && <Text style={s.errorText}>{errorText}</Text>}

                  <TouchableOpacity
                    style={[s.primaryBtn, !canSend && s.primaryBtnDisabled]}
                    onPress={handleSend}
                    disabled={!canSend}
                  >
                    {phase === 'sending'
                      ? <ActivityIndicator color={colors.textInverse} />
                      : <Text style={s.primaryBtnText}>{t('feedbackModal.sendButton')}</Text>}
                  </TouchableOpacity>

                  <TouchableOpacity style={s.secondaryBtn} onPress={onClose} disabled={phase === 'sending'}>
                    <Text style={s.secondaryBtnText}>{t('common.cancel')}</Text>
                  </TouchableOpacity>
                </>
              )}

            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function makeStyles(colors: ColorPalette) { return StyleSheet.create({
  // Anchored to the top on web so the on-screen keyboard can't push the sheet out of view —
  // same pattern as the budget entry sheet.
  overlay: { flex: 1, justifyContent: Platform.OS === 'web' ? 'flex-start' : 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    padding: spacing.lg, paddingBottom: spacing.xxl, maxHeight: Platform.OS === 'web' ? '100%' : '92%',
  },
  handle: { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.md },
  title: { ...typography.h2, color: colors.text },
  subtitle: { ...typography.sm, color: colors.textSecondary, marginTop: 2, marginBottom: spacing.md },
  messageInput: {
    ...typography.body, color: colors.text, backgroundColor: colors.background,
    borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border,
    padding: spacing.md, minHeight: 140,
  },
  counter: { ...typography.sm, color: colors.textMuted, alignSelf: 'flex-end', marginTop: spacing.xs },
  fieldLabel: { ...typography.label, color: colors.textMuted, marginTop: spacing.md, marginBottom: spacing.sm, textTransform: 'uppercase' },
  input: {
    ...typography.body, color: colors.text, backgroundColor: colors.background,
    borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  hint: { ...typography.sm, color: colors.textMuted, marginTop: spacing.xs },
  errorText: { ...typography.sm, color: colors.error, marginTop: spacing.md },
  primaryBtn: { backgroundColor: colors.brand, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', marginTop: spacing.lg },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnText: { ...typography.body, color: colors.textInverse, fontWeight: '700' },
  secondaryBtn: { padding: spacing.md, alignItems: 'center', marginTop: spacing.xs },
  secondaryBtnText: { ...typography.body, color: colors.textSecondary },
  resultBox: { alignItems: 'center', paddingVertical: spacing.lg },
  resultEmoji: { fontSize: 44, marginBottom: spacing.sm },
  resultTitle: { ...typography.h2, color: colors.text, textAlign: 'center' },
  resultBody: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm },
  reasonBox: { backgroundColor: colors.background, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md, alignSelf: 'stretch' },
  reasonText: { ...typography.sm, color: colors.textSecondary, fontStyle: 'italic' },
}); }
