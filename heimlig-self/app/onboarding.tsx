// app/onboarding.tsx
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, ScrollView, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, radius, typography, shadow, AVATAR_COLORS } from '../constants/theme';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';
import { useT } from '../lib/i18n';

type Step = 'welcome' | 'auth' | 'verify' | 'profile';

export default function OnboardingScreen() {
  const router = useRouter();
  const { setUserId, setProfile, language, setLanguage } = useStore();
  const t = useT();
  const [step, setStep] = useState<Step>('welcome');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0]);
  const [loading, setLoading] = useState(false);
  const [isLogin, setIsLogin] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);

  const LanguageToggle = () => (
    <View style={styles.langToggle}>
      {(['de', 'en'] as const).map((l) => (
        <TouchableOpacity
          key={l}
          style={[styles.langPill, language === l && styles.langPillActive]}
          onPress={() => setLanguage(l)}
        >
          <Text style={[styles.langPillText, language === l && styles.langPillTextActive]}>{l.toUpperCase()}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  // ─── AUTH ────────────────────────────────────────────────
  const handleAuth = async () => {
    if (!email || !password) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      if (isLogin) {
        const { error, data } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await loadExistingProfile(data.user.id);
      } else {
        // SECURITY: do NOT sign in right after signUp — see Heimlig's onboarding.tsx for
        // the same reasoning. If email confirmation is on, signUp returns no session.
        const { error, data } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: 'heimligself://reset-password' },
        });
        if (error) throw error;
        if (!data.session) {
          setStep('verify');
          return;
        }
        if (data.user) setPendingUserId(data.user.id);
        setStep('profile');
      }
    } catch (e: any) {
      setErrorMsg(e.message || JSON.stringify(e));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) { setErrorMsg('E-Mail?'); return; }
    setLoading(true);
    setErrorMsg(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: 'heimligself://reset-password',
      });
      if (error) throw error;
      Alert.alert('📧', `${email}`);
    } catch (e: any) {
      setErrorMsg(e.message || 'Error');
    } finally {
      setLoading(false);
    }
  };

  const loadExistingProfile = async (userId: string) => {
    setUserId(userId);
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (data) {
      setProfile(data);
      router.replace('/(tabs)');
    } else {
      setPendingUserId(userId);
      setStep('profile');
    }
  };

  // ─── PROFILE ─────────────────────────────────────────────
  const handleSaveProfile = async () => {
    if (!displayName || !pendingUserId) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .insert({ id: pendingUserId, display_name: displayName, avatar_color: avatarColor, language })
        .select()
        .single();
      if (error) throw error;
      setUserId(pendingUserId);
      setProfile(data);
      router.replace('/(tabs)');
    } catch (e: any) {
      setErrorMsg(e.message || JSON.stringify(e));
    } finally {
      setLoading(false);
    }
  };

  // ─── WELCOME ─────────────────────────────────────────────
  if (step === 'welcome') return (
    <LinearGradient colors={[colors.brandDark, colors.brand, colors.brandLight]} style={styles.fullscreen}>
      <SafeAreaView style={styles.centered}>
        <LanguageToggle />
        <Text style={styles.logo}>✨</Text>
        <Text style={styles.appName}>Heimlig Self</Text>
        <Text style={styles.tagline}>{t('welcome.tagline')}</Text>
        <Text style={styles.taglineSub}>{t('welcome.sub')}</Text>
        <View style={styles.btnGroup}>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => { setIsLogin(false); setStep('auth'); }}>
            <Text style={styles.primaryBtnText}>{t('welcome.start')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => { setIsLogin(true); setStep('auth'); }}>
            <Text style={styles.secondaryBtnText}>{t('welcome.haveAccount')}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.legalRow}>
          <TouchableOpacity onPress={() => router.push('/impressum')}>
            <Text style={styles.legalLink}>{t('settings.imprint')}</Text>
          </TouchableOpacity>
          <Text style={styles.legalDivider}>·</Text>
          <TouchableOpacity onPress={() => router.push('/datenschutz')}>
            <Text style={styles.legalLink}>{t('settings.privacy')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );

  // ─── AUTH ─────────────────────────────────────────────────
  if (step === 'auth') return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.stepContent}>
          <LanguageToggle />
          <Text style={styles.stepTitle}>{isLogin ? t('auth.loginTitle') : t('auth.registerTitle')}</Text>
          <TextInput
            style={styles.textInput} placeholder={t('auth.email')} value={email}
            onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none"
            placeholderTextColor={colors.textMuted}
          />
          <View style={styles.passwordRow}>
            <TextInput
              style={styles.passwordInput} placeholder={t('auth.password')} value={password}
              onChangeText={setPassword} secureTextEntry={!showPassword} placeholderTextColor={colors.textMuted}
            />
            <TouchableOpacity onPress={() => setShowPassword(v => !v)} style={styles.eyeBtn}>
              <Text style={styles.eyeIcon}>{showPassword ? '🙈' : '👁️'}</Text>
            </TouchableOpacity>
          </View>
          {errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}
          <TouchableOpacity
            style={[styles.primaryBtnLight, loading && styles.disabled]}
            onPress={handleAuth} disabled={loading}
          >
            <Text style={styles.primaryBtnLightText}>{loading ? t('auth.loading') : isLogin ? t('auth.login') : t('auth.continue')}</Text>
          </TouchableOpacity>
          {isLogin && (
            <TouchableOpacity style={styles.forgotBtn} onPress={handleForgotPassword} disabled={loading}>
              <Text style={styles.forgotBtnText}>{t('auth.forgotPassword')}</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );

  // ─── VERIFY EMAIL ─────────────────────────────────────────
  if (step === 'verify') return (
    <SafeAreaView style={styles.container}>
      <View style={styles.stepContent}>
        <Text style={styles.stepTitle}>{t('verify.title')}</Text>
        <Text style={styles.stepSub}>{t('verify.body', { email })}</Text>
        <TouchableOpacity
          style={styles.primaryBtnLight}
          onPress={() => { setIsLogin(true); setErrorMsg(null); setStep('auth'); }}
        >
          <Text style={styles.primaryBtnLightText}>{t('verify.toLogin')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );

  // ─── PROFILE ────────────────────────────────────────────────
  if (step === 'profile') return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.stepContent}>
          <Text style={styles.stepTitle}>{t('profile.title')}</Text>
          <Text style={styles.stepSub}>{t('profile.sub')}</Text>
          <Text style={styles.inputLabel}>{t('profile.name')}</Text>
          <TextInput style={styles.textInput} placeholder={t('profile.name')} value={displayName} onChangeText={setDisplayName} placeholderTextColor={colors.textMuted} />
          <Text style={styles.inputLabel}>{t('profile.color')}</Text>
          <View style={styles.colorRow}>
            {AVATAR_COLORS.map(c => (
              <TouchableOpacity
                key={c}
                style={[styles.colorDot, { backgroundColor: c }, avatarColor === c && styles.colorDotActive]}
                onPress={() => setAvatarColor(c)}
              />
            ))}
          </View>
          {errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}
          <TouchableOpacity
            style={[styles.primaryBtnLight, (!displayName || loading) && styles.disabled]}
            onPress={handleSaveProfile}
            disabled={!displayName || loading}
          >
            <Text style={styles.primaryBtnLightText}>{loading ? t('profile.saving') : t('profile.save')}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );

  return null;
}

const styles = StyleSheet.create({
  fullscreen: { flex: 1 },
  container: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  langToggle: { position: 'absolute', top: spacing.md, right: spacing.md, flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: radius.full, padding: 3 },
  langPill: { paddingHorizontal: spacing.sm + 2, paddingVertical: 4, borderRadius: radius.full },
  langPillActive: { backgroundColor: 'rgba(255,255,255,0.9)' },
  langPillText: { ...typography.xs, color: 'rgba(255,255,255,0.8)', fontWeight: '700' },
  langPillTextActive: { color: colors.brandDark },
  logo: { fontSize: 72, marginBottom: spacing.md },
  appName: { fontSize: 42, fontWeight: '800', color: colors.textInverse, letterSpacing: -1 },
  tagline: { ...typography.h3, color: 'rgba(255,255,255,0.95)', marginTop: spacing.sm, textAlign: 'center' },
  taglineSub: { ...typography.body, color: 'rgba(255,255,255,0.7)', marginTop: spacing.xs, marginBottom: spacing.xxl },
  btnGroup: { width: '100%', gap: spacing.md },
  primaryBtn: { backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: radius.md, padding: spacing.md + 2, alignItems: 'center', ...shadow.md },
  primaryBtnText: { ...typography.body, color: colors.brandDark, fontWeight: '700' },
  secondaryBtn: { padding: spacing.md, alignItems: 'center' },
  secondaryBtnText: { ...typography.body, color: 'rgba(255,255,255,0.85)' },
  legalRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.lg, gap: spacing.sm },
  legalLink: { ...typography.xs, color: 'rgba(255,255,255,0.6)', textDecorationLine: 'underline' },
  legalDivider: { ...typography.xs, color: 'rgba(255,255,255,0.4)' },
  disabled: { opacity: 0.4 },
  stepContent: { padding: spacing.lg, paddingTop: spacing.xxl },
  stepTitle: { ...typography.h1, color: colors.text, marginBottom: spacing.sm },
  stepSub: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.xl },
  textInput: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, ...typography.body, color: colors.text, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  passwordRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  passwordInput: { flex: 1, padding: spacing.md, ...typography.body, color: colors.text },
  eyeBtn: { paddingHorizontal: spacing.md },
  eyeIcon: { fontSize: 18 },
  inputLabel: { ...typography.label, color: colors.textSecondary, marginBottom: spacing.xs },
  colorRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.xl, flexWrap: 'wrap' },
  colorDot: { width: 36, height: 36, borderRadius: 18 },
  colorDotActive: { borderWidth: 3, borderColor: colors.text },
  errorText: { color: colors.error, backgroundColor: colors.accentLight, borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 14 },
  primaryBtnLight: { backgroundColor: colors.brand, borderRadius: radius.md, padding: spacing.md + 2, alignItems: 'center', ...shadow.md },
  primaryBtnLightText: { ...typography.body, color: colors.textInverse, fontWeight: '700' },
  forgotBtn: { alignItems: 'center', paddingVertical: spacing.md },
  forgotBtnText: { ...typography.body, color: colors.brand, fontWeight: '600' },
});
