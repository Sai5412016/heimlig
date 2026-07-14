// app/reset-password.tsx
// Landing page for Supabase's "reset password" email link (redirectTo points here).
// The Supabase client has detectSessionInUrl: false (needed so expo-router's own URL
// handling doesn't fight with it), so the recovery tokens in the URL fragment have to be
// parsed and applied manually via setSession() before we can call updateUser({ password }).
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, radius, typography, shadow } from '../constants/theme';
import { supabase } from '../lib/supabase';

type Status = 'checking' | 'ready' | 'invalid' | 'saving' | 'done' | 'native';

function parseHashParams(hash: string): Record<string, string> {
  const clean = hash.startsWith('#') ? hash.slice(1) : hash;
  const out: Record<string, string> = {};
  for (const part of clean.split('&')) {
    const [k, v] = part.split('=');
    if (k) out[decodeURIComponent(k)] = decodeURIComponent(v || '');
  }
  return out;
}

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [status, setStatus] = useState<Status>('checking');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      // The reset link only points at the web URL for now (no app-link setup yet).
      setStatus('native');
      return;
    }
    (async () => {
      // @ts-ignore - window only exists on web
      const hash = window.location.hash || '';
      const params = parseHashParams(hash);
      if (params.type === 'recovery' && params.access_token && params.refresh_token) {
        const { error } = await supabase.auth.setSession({
          access_token: params.access_token,
          refresh_token: params.refresh_token,
        });
        // Clear the tokens from the visible URL once consumed.
        // @ts-ignore
        window.history.replaceState(null, '', window.location.pathname);
        setStatus(error ? 'invalid' : 'ready');
        return;
      }
      // Maybe we already have a recovery session from a previous load in this tab.
      const { data } = await supabase.auth.getUser();
      setStatus(data.user ? 'ready' : 'invalid');
    })();
  }, []);

  const handleSubmit = async () => {
    if (password.length < 10) { setErrorMsg(t('resetPassword.tooShortError')); return; }
    if (password !== confirm) { setErrorMsg(t('resetPassword.mismatchError')); return; }
    setErrorMsg(null);
    setStatus('saving');
    const { error } = await supabase.auth.updateUser({ password });
    if (error) { setErrorMsg(error.message); setStatus('ready'); return; }
    setStatus('done');
    setTimeout(() => router.replace('/(tabs)'), 1500);
  };

  return (
    <LinearGradient colors={[colors.brandDark, colors.brand, colors.brandLight]} style={styles.fullscreen}>
      <SafeAreaView style={styles.centered}>
        <Text style={styles.logo}>🔑</Text>
        <Text style={styles.title}>{t('resetPassword.title')}</Text>

        {status === 'checking' && <ActivityIndicator color="#fff" />}

        {status === 'native' && (
          <Text style={styles.sub}>{t('resetPassword.nativeBody')}</Text>
        )}

        {status === 'invalid' && (
          <>
            <Text style={styles.sub}>{t('resetPassword.invalidBody')}</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => router.replace('/onboarding')}>
              <Text style={styles.primaryBtnText}>{t('resetPassword.backToApp')}</Text>
            </TouchableOpacity>
          </>
        )}

        {(status === 'ready' || status === 'saving') && (
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ width: '100%', alignItems: 'center' }}>
            <TextInput
              style={styles.input}
              placeholder={t('household.newPasswordPlaceholder')}
              placeholderTextColor="rgba(255,255,255,0.6)"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
            <TextInput
              style={styles.input}
              placeholder={t('resetPassword.confirmPasswordPlaceholder')}
              placeholderTextColor="rgba(255,255,255,0.6)"
              secureTextEntry
              value={confirm}
              onChangeText={setConfirm}
            />
            {errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}
            <TouchableOpacity
              style={[styles.primaryBtn, status === 'saving' && styles.disabled]}
              onPress={handleSubmit}
              disabled={status === 'saving'}
            >
              {status === 'saving'
                ? <ActivityIndicator color={colors.brand} />
                : <Text style={styles.primaryBtnText}>{t('common.save')}</Text>}
            </TouchableOpacity>
          </KeyboardAvoidingView>
        )}

        {status === 'done' && (
          <Text style={styles.sub}>{t('resetPassword.doneBody')}</Text>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fullscreen: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  logo: { fontSize: 64, marginBottom: spacing.md },
  title: { fontSize: 28, fontWeight: '800', color: colors.textInverse, marginBottom: spacing.md, textAlign: 'center' },
  sub: { ...typography.body, color: 'rgba(255,255,255,0.9)', textAlign: 'center', marginBottom: spacing.xl },
  input: {
    width: '100%', maxWidth: 340, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: radius.md,
    paddingVertical: spacing.md, paddingHorizontal: spacing.lg, color: '#fff', marginBottom: spacing.md,
    ...typography.body,
  },
  primaryBtn: { backgroundColor: colors.surface, borderRadius: radius.md, paddingVertical: spacing.md + 2, paddingHorizontal: spacing.xxl, alignItems: 'center', minWidth: 200, ...shadow.md, marginTop: spacing.sm },
  primaryBtnText: { ...typography.body, color: colors.brand, fontWeight: '700' },
  disabled: { opacity: 0.6 },
  errorText: { color: '#fff', backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 8, padding: 12, marginBottom: 12, textAlign: 'center', maxWidth: 340 },
});
