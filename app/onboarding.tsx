// app/onboarding.tsx
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, ScrollView, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, radius, typography, shadow, AVATAR_COLORS } from '../constants/theme';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';

type Step = 'welcome' | 'type' | 'auth' | 'name';
type HouseholdType = 'couple' | 'wg' | 'family' | 'solo';

const HOUSEHOLD_TYPES: { key: HouseholdType; emoji: string; label: string; sub: string }[] = [
  { key: 'couple', emoji: '💑', label: 'Paar',    sub: 'Zu zweit wirtschaften' },
  { key: 'wg',     emoji: '🏠', label: 'WG',      sub: 'Shared Apartment' },
  { key: 'family', emoji: '👨‍👩‍👧‍👦', label: 'Familie', sub: 'Mit Kids & Co.' },
  { key: 'solo',   emoji: '🧘', label: 'Solo',    sub: 'Für mich allein' },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { setHousehold, setCurrentMember, setMembers, setShoppingLists, setActiveListId, setItems } = useStore();
  const [step, setStep] = useState<Step>('welcome');
  const [householdType, setHouseholdType] = useState<HouseholdType | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [householdName, setHouseholdName] = useState('');
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0]);
  const [loading, setLoading] = useState(false);
  const [isLogin, setIsLogin] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [signedUpUserId, setSignedUpUserId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ─── AUTH ────────────────────────────────────────────────
  const handleAuth = async () => {
    if (!email || !password) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      if (isLogin) {
        const { error, data } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await loadExistingHousehold(data.user.id);
      } else {
        const { error, data } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data.session) await supabase.auth.setSession(data.session);
        if (data.user) setSignedUpUserId(data.user.id);
        setStep('name');
      }
    } catch (e: any) {
      setErrorMsg(e.message || JSON.stringify(e));
    } finally {
      setLoading(false);
    }
  };

  // ─── LOAD EXISTING HOUSEHOLD (for login) ─────────────────
  const loadExistingHousehold = async (userId: string) => {
    const { data: memberRows } = await supabase
      .from('members')
      .select('*, households(*)')
      .eq('user_id', userId)
      .limit(1);

    if (!memberRows || memberRows.length === 0) {
      setStep('name');
      return;
    }

    const myMember = memberRows[0];
    const household = myMember.households;
    setHousehold(household);
    setCurrentMember(myMember);

    const { data: allMembers } = await supabase.from('members').select('*').eq('household_id', household.id);
    if (allMembers) setMembers(allMembers);

    let { data: lists } = await supabase.from('shopping_lists').select('*').eq('household_id', household.id);
    if (!lists || lists.length === 0) {
      const { data: newList } = await supabase
        .from('shopping_lists')
        .insert({ household_id: household.id, name: 'Einkaufsliste', emoji: '🛒', created_by: myMember.id })
        .select().single();
      if (newList) lists = [newList];
    }

    if (lists && lists.length > 0) {
      setShoppingLists(lists);
      setActiveListId(lists[0].id);
      const { data: items } = await supabase.from('shopping_items').select('*').eq('list_id', lists[0].id);
      if (items) setItems(items);
    }

    router.replace('/(tabs)');
  };

  // ─── CREATE HOUSEHOLD ────────────────────────────────────
  const handleCreateHousehold = async () => {
    if (!displayName || !householdName) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id ?? signedUpUserId;
      if (!userId) throw new Error('Keine Session. Bitte neu einloggen.');

      // 1. Haushalt erstellen
      const { data: household, error: hError } = await supabase
        .from('households')
        .insert({ name: householdName })
        .select().single();
      if (hError) throw hError;

      // 2. Member erstellen
      const { data: member, error: mError } = await supabase
        .from('members')
        .insert({ user_id: userId, household_id: household.id, display_name: displayName, avatar_color: avatarColor, role: 'admin' })
        .select().single();
      if (mError) throw mError;

      // 3. Standard Einkaufsliste erstellen
      const { data: shoppingList, error: slError } = await supabase
        .from('shopping_lists')
        .insert({ household_id: household.id, name: 'Einkaufsliste', emoji: '🛒', created_by: member.id })
        .select().single();
      if (slError) throw slError;

      // 4. Store befüllen
      setHousehold(household);
      setCurrentMember(member);
      setMembers([member]);
      setShoppingLists([shoppingList]);
      setActiveListId(shoppingList.id);
      setItems([]);

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
        <Text style={styles.logo}>🏡</Text>
        <Text style={styles.appName}>Heimlig</Text>
        <Text style={styles.tagline}>Euer gemeinsamer Haushalt.</Text>
        <Text style={styles.taglineSub}>Budget · Einkauf · Aufgaben · AI</Text>
        <View style={styles.btnGroup}>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => { setIsLogin(false); setStep('type'); }}>
            <Text style={styles.primaryBtnText}>Loslegen →</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => { setIsLogin(true); setStep('auth'); }}>
            <Text style={styles.secondaryBtnText}>Ich habe schon einen Account</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );

  // ─── HOUSEHOLD TYPE ───────────────────────────────────────
  if (step === 'type') return (
    <SafeAreaView style={styles.container}>
      <View style={styles.stepContent}>
        <Text style={styles.stepTitle}>Wer seid ihr?</Text>
        <Text style={styles.stepSub}>Wir passen die App an euren Haushalt an.</Text>
        <View style={styles.typeGrid}>
          {HOUSEHOLD_TYPES.map(t => (
            <TouchableOpacity
              key={t.key}
              style={[styles.typeCard, householdType === t.key && styles.typeCardActive]}
              onPress={() => setHouseholdType(t.key)}
            >
              <Text style={styles.typeEmoji}>{t.emoji}</Text>
              <Text style={[styles.typeLabel, householdType === t.key && styles.typeLabelActive]}>{t.label}</Text>
              <Text style={styles.typeSub}>{t.sub}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity
          style={[styles.primaryBtn, !householdType && styles.disabled]}
          onPress={() => householdType && setStep('auth')}
          disabled={!householdType}
        >
          <Text style={styles.primaryBtnText}>Weiter →</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );

  // ─── AUTH ─────────────────────────────────────────────────
  if (step === 'auth') return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.stepContent}>
          <Text style={styles.stepTitle}>{isLogin ? 'Willkommen zurück' : 'Account erstellen'}</Text>
          <TextInput
            style={styles.textInput} placeholder="E-Mail" value={email}
            onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none"
            placeholderTextColor={colors.textMuted}
          />
          <View style={styles.passwordRow}>
            <TextInput
              style={styles.passwordInput} placeholder="Passwort" value={password}
              onChangeText={setPassword} secureTextEntry={!showPassword} placeholderTextColor={colors.textMuted}
            />
            <TouchableOpacity onPress={() => setShowPassword(v => !v)} style={styles.eyeBtn}>
              <Text style={styles.eyeIcon}>{showPassword ? '🙈' : '👁️'}</Text>
            </TouchableOpacity>
          </View>
          {errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}
          <TouchableOpacity
            style={[styles.primaryBtn, loading && styles.disabled]}
            onPress={handleAuth} disabled={loading}
          >
            <Text style={styles.primaryBtnText}>{loading ? 'Lädt...' : isLogin ? 'Einloggen' : 'Weiter →'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );

  // ─── NAME & HOUSEHOLD ─────────────────────────────────────
  if (step === 'name') return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.stepContent}>
          <Text style={styles.stepTitle}>Fast geschafft! 🎉</Text>
          <Text style={styles.stepSub}>Wie heißt du und euer Haushalt?</Text>
          <Text style={styles.inputLabel}>Dein Name</Text>
          <TextInput style={styles.textInput} placeholder="z.B. Andi" value={displayName} onChangeText={setDisplayName} placeholderTextColor={colors.textMuted} />
          <Text style={styles.inputLabel}>Haushaltsname</Text>
          <TextInput style={styles.textInput} placeholder="z.B. Unser Zuhause" value={householdName} onChangeText={setHouseholdName} placeholderTextColor={colors.textMuted} />
          <Text style={styles.inputLabel}>Deine Farbe</Text>
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
            style={[styles.primaryBtn, (!displayName || !householdName || loading) && styles.disabled]}
            onPress={handleCreateHousehold}
            disabled={!displayName || !householdName || loading}
          >
            <Text style={styles.primaryBtnText}>{loading ? 'Erstelle Haushalt...' : 'Haushalt erstellen 🏡'}</Text>
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
  stepContent: { padding: spacing.lg, paddingTop: spacing.xxl },
  logo: { fontSize: 80, marginBottom: spacing.md },
  appName: { fontSize: 48, fontWeight: '800', color: colors.textInverse, letterSpacing: -1 },
  tagline: { ...typography.h3, color: 'rgba(255,255,255,0.9)', marginTop: spacing.sm },
  taglineSub: { ...typography.body, color: 'rgba(255,255,255,0.7)', marginTop: spacing.xs, marginBottom: spacing.xxl },
  btnGroup: { width: '100%', gap: spacing.md },
  primaryBtn: { backgroundColor: colors.brand, borderRadius: radius.md, padding: spacing.md + 2, alignItems: 'center', ...shadow.md },
  primaryBtnText: { ...typography.body, color: colors.textInverse, fontWeight: '700' },
  secondaryBtn: { padding: spacing.md, alignItems: 'center' },
  secondaryBtnText: { ...typography.body, color: 'rgba(255,255,255,0.8)' },
  disabled: { opacity: 0.4 },
  stepTitle: { ...typography.h1, color: colors.text, marginBottom: spacing.sm },
  stepSub: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.xl },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.xl },
  typeCard: { width: '46%', backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, alignItems: 'center', borderWidth: 2, borderColor: colors.border, ...shadow.sm },
  typeCardActive: { borderColor: colors.brand, backgroundColor: colors.brandPale },
  typeEmoji: { fontSize: 36, marginBottom: spacing.sm },
  typeLabel: { ...typography.h3, color: colors.text },
  typeLabelActive: { color: colors.brand },
  typeSub: { ...typography.xs, color: colors.textSecondary, marginTop: 2, textAlign: 'center' },
  textInput: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, ...typography.body, color: colors.text, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  passwordRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  passwordInput: { flex: 1, padding: spacing.md, ...typography.body, color: colors.text },
  eyeBtn: { paddingHorizontal: spacing.md },
  eyeIcon: { fontSize: 18 },
  inputLabel: { ...typography.label, color: colors.textSecondary, marginBottom: spacing.xs },
  colorRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.xl },
  colorDot: { width: 36, height: 36, borderRadius: 18 },
  colorDotActive: { borderWidth: 3, borderColor: colors.text },
  errorText: { color: '#ef4444', backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 14 },
});
