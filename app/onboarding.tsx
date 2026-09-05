// app/onboarding.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, ScrollView, Linking, Share
} from 'react-native';
import { Alert } from '../lib/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import * as Localization from 'expo-localization';
import { colors, spacing, radius, typography, shadow, AVATAR_COLORS } from '../constants/theme';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';
import { CURRENCIES } from '../lib/currency';
import { TIMEZONES } from '../lib/timezones';
import { SUPPORTED_COUNTRIES } from '../lib/holidays';
import { isMemberLimitError, HOUSEHOLD_MEMBER_CAP } from '../lib/premium';
import { logInviteFunnelStep, logJoinOpenedOnce, getPendingInviteCode, clearPendingInviteCode, isPendingCodeAlreadyMember, isAlreadyMemberError, resolveInviteCode } from '../lib/inviteFunnel';
import { savePendingHouseholdChoice, getPendingHouseholdChoice, clearPendingHouseholdChoice } from '../lib/householdChoice';

// 'household' (Haushaltswahl) sits BEFORE 'auth' on purpose: the old order asked for an
// account first and only then what the account was for. See the report for build 91.
type Step = 'welcome' | 'slides' | 'household' | 'auth' | 'verify' | 'name' | 'invite';

export default function OnboardingScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { household, setHousehold, setCurrentMember, setMembers, setShoppingLists, setActiveListId, setItems, switchHousehold, setUserId, language } = useStore();
  const [step, setStep] = useState<Step>('welcome');
  const [slideIndex, setSlideIndex] = useState(0);
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
  const [joinMode, setJoinMode] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  // A code app/join/[code].tsx persisted to AsyncStorage before routing here because there was
  // no session yet (see lib/inviteFunnel.ts for why AsyncStorage and not a route param). Read
  // once on mount; carries through signup/email-verify/login without the user retyping anything.
  const [pendingInviteCode, setPendingInviteCode] = useState<string | null>(null);
  useEffect(() => { getPendingInviteCode().then(setPendingInviteCode); }, []);

  // Restore the pre-signup household choice and, if a session already exists without any
  // membership, skip straight to the step that finishes the job. That combination is what a cold
  // boot after confirming the email in a mail client looks like: app/_layout.tsx sends such a
  // user here, and without this they would land back on the welcome screen and be asked to
  // "get started" while already signed in.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [choice, { data: { user } }] = await Promise.all([
        getPendingHouseholdChoice(),
        supabase.auth.getUser(),
      ]);
      if (cancelled) return;
      // A waiting deep-link code outranks the stored choice — see lib/householdChoice.ts. It is
      // applied by the effect below, so only fill in from the choice when there is no code.
      const code = await getPendingInviteCode();
      if (cancelled) return;
      if (choice && !code) {
        if (choice.mode === 'create') { setJoinMode(false); setHouseholdName(choice.name); }
        else { setJoinMode(true); setInviteCode(choice.code); }
      }
      if (user) { setUserId(user.id); setStep('name'); }
    })();
    return () => { cancelled = true; };
  }, []);

  // Once we know about a pending code, pre-fill + preselect join mode as soon as the name step
  // is reached — from any entry path (fresh signup, post-verify login, existing-account login).
  useEffect(() => {
    if (step === 'name' && pendingInviteCode) {
      setJoinMode(true);
      setInviteCode(pendingInviteCode);
    }
  }, [step, pendingInviteCode]);

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
        // SECURITY: do NOT sign in right after signUp — that let anyone register with a
        // stranger's email and land in a live session before ever proving they own it.
        // If Supabase's "Confirm email" is on, signUp returns no session and the user
        // must click the verification link first.
        const { error, data } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: 'https://heimlig.vercel.app' },
        });
        if (error) throw error;
        if (!data.session) {
          setStep('verify');
          return;
        }
        if (data.user) setSignedUpUserId(data.user.id);
        setStep('name');
      }
    } catch (e: any) {
      setErrorMsg(e.message || JSON.stringify(e));
    } finally {
      setLoading(false);
    }
  };

  // ─── FORGOT PASSWORD ─────────────────────────────────────
  const handleForgotPassword = async () => {
    if (!email) { setErrorMsg(t('onboarding.forgotPasswordNeedsEmail')); return; }
    setLoading(true);
    setErrorMsg(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: 'https://heimlig.vercel.app/reset-password',
      });
      if (error) throw error;
      Alert.alert(t('onboarding.resetEmailSentTitle'), t('onboarding.resetEmailSentBody', { email }));
    } catch (e: any) {
      setErrorMsg(e.message || t('onboarding.resetEmailFailedGeneric'));
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
      .is('deleted_at', null)
      .limit(1);

    if (!memberRows || memberRows.length === 0) {
      setStep('name');
      return;
    }

    const myMember = memberRows[0];
    const household = myMember.households;
    setHousehold(household);
    setCurrentMember(myMember);

    const { data: allMembers } = await supabase.from('members').select('*').eq('household_id', household.id).is('deleted_at', null);
    if (allMembers) setMembers(allMembers);

    let { data: lists } = await supabase.from('shopping_lists').select('*').eq('household_id', household.id);
    if (!lists || lists.length === 0) {
      const { data: newList } = await supabase
        .from('shopping_lists')
        .insert({ household_id: household.id, name: t('shopping.defaultListName'), emoji: '🛒', created_by: myMember.id })
        .select().single();
      if (newList) lists = [newList];
    }

    if (lists && lists.length > 0) {
      setShoppingLists(lists);
      setActiveListId(lists[0].id);
      const { data: items } = await supabase.from('shopping_items').select('*').eq('list_id', lists[0].id);
      if (items) setItems(items);
    }

    // A pending code plus an already-known identity (display name, avatar) is exactly the case
    // app/join/[code].tsx's own handleJoin already covers end-to-end — hand off there instead of
    // duplicating that join call here. currentMember is already set above, so it'll find it.
    const pending = pendingInviteCode ?? await getPendingInviteCode();
    if (pending) {
      // Skip the join screen entirely if this login's user already belongs to the household the
      // code points at — join_household_by_code can only ever answer "already a member" for that
      // combination, so redirecting there would just be the dead-end loop this fix addresses.
      // Checked across ALL of this user's memberships, not just `household` above (which is only
      // the first one loaded) — someone can belong to more than one household.
      const { data: allMemberRows } = await supabase.from('members').select('household_id').eq('user_id', userId).is('deleted_at', null);
      const householdIds = (allMemberRows || []).map((r: any) => r.household_id);
      if (await isPendingCodeAlreadyMember(pending, householdIds)) {
        await clearPendingInviteCode();
      } else {
        router.replace(`/join/${pending}`);
        return;
      }
    }

    router.replace('/(tabs)');
  };

  // ─── JOIN HOUSEHOLD ──────────────────────────────────────
  const handleJoinHousehold = async () => {
    if (!displayName || !inviteCode) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const normalizedCode = inviteCode.toUpperCase().trim();

      // join_opened for the code-entry route — see the same block in app/(tabs)/household.tsx for
      // why it was missing. Read once here and reused for setUserId further down, rather than
      // asking the auth server twice.
      const { data: { user } } = await supabase.auth.getUser();

      // The dedup inside logJoinOpenedOnce matters most at THIS call site. A recipient who taps a
      // deep link without an account goes: app/join/[code].tsx (logs join_opened for the code) ->
      // no session -> onboarding -> signs up -> lands back here with the same code. Logging again
      // would make one arrival look like two, and would inflate exactly the number every later
      // rate is divided by. The code is normalised the same way in both places, which is what
      // makes the dedup key match; the guard is per code in memory and in AsyncStorage, and is
      // cleared by clearPendingInviteCode() once the journey is over, so a genuinely new attempt
      // later still counts.
      const resolvedForFunnel = await resolveInviteCode(normalizedCode);
      if (resolvedForFunnel) {
        logJoinOpenedOnce(normalizedCode, resolvedForFunnel.household_id, user?.id ?? null);
      }

      const { data: result, error: rpcError } = await supabase.rpc('join_household_by_code', {
        p_invite_code: normalizedCode,
        p_display_name: displayName,
        p_avatar_color: avatarColor,
      });
      // Same transient-vs-final split as app/join/[code].tsx's handleJoin: member-limit and the
      // RPC's own business errors are final for this code and must not leave it stuck in
      // AsyncStorage for the next login; a thrown exception below (network drop before any
      // response) is the one case that stays transient and keeps the pending code.
      if (isMemberLimitError(rpcError)) {
        await clearPendingInviteCode();
        setErrorMsg(t('household.memberLimitBody', { limit: HOUSEHOLD_MEMBER_CAP }));
        return;
      }
      if (rpcError) throw rpcError;

      // "Already a member" is the recipient's evident intent, not a failure — switch them into
      // that household instead of dead-ending on an error. That branch of the RPC doesn't return
      // household_id (see join_household_by_code's definition), so it needs a separate lookup.
      let household_id = result?.error && isAlreadyMemberError(result.error)
        ? (await resolveInviteCode(normalizedCode))?.household_id
        : result?.household_id;

      if (!household_id) {
        await clearPendingInviteCode();
        setErrorMsg(result?.error ?? t('household.joinFailed'));
        return;
      }
      if (!result?.error) logInviteFunnelStep('join_completed', household_id);

      // switchHousehold (store/useStore.ts) looks the membership row up by user_id + household_id
      // itself, so it works uniformly for both a fresh join (result.member_id) and the
      // already-a-member case (no member_id in the RPC result at all). It reads userId from the
      // store though, which — unlike app/_layout.tsx's checkSession — nothing on this screen ever
      // sets; without this, switchHousehold would silently no-op here.
      if (user) setUserId(user.id);
      await switchHousehold(household_id);
      await clearPendingInviteCode();
      await clearPendingHouseholdChoice();
      router.replace('/(tabs)');
    } catch (e: any) {
      setErrorMsg(e.message || JSON.stringify(e));
    } finally {
      setLoading(false);
    }
  };

  // ─── CREATE HOUSEHOLD ────────────────────────────────────
  const handleCreateHousehold = async () => {
    if (!displayName || !householdName) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      // Use SECURITY DEFINER function to bypass RLS (works even if session not in storage)
      // p_household_type needs sql/household_type.sql applied first (adds that RPC overload) —
      // see that file's deploy-order note. Guarded here rather than just documented: if this
      // build ships before the migration lands, PostgREST can't resolve the 5-arg overload and
      // returns PGRST202 ("Could not find the function... in the schema cache") for EVERY
      // signup — so on exactly that error, retry once without p_household_type instead of
      // hard-failing account creation over a param the household_type feature doesn't need to
      // succeed for. Once the migration is applied, the first attempt always succeeds and this
      // fallback never triggers.
      let { data: result, error: fnError } = await supabase.rpc('create_household_for_user', {
        p_name: householdName,
        p_display_name: displayName,
        p_avatar_color: avatarColor,
        p_language: language,
        // The onboarding step that asked couple/wg/family/solo is gone (it cost every new
        // user a screen and was left unanswered in 93% of households). The parameter stays
        // so the RPC signature is untouched; the column is filled by the dashboard card in
        // task #2 instead, which asks the question where it actually matters.
        p_household_type: null,
      });
      if (fnError?.code === 'PGRST202') {
        ({ data: result, error: fnError } = await supabase.rpc('create_household_for_user', {
          p_name: householdName,
          p_display_name: displayName,
          p_avatar_color: avatarColor,
          p_language: language,
        }));
      }
      if (fnError) throw fnError;

      const { household_id, member_id, list_id } = result as any;

      // Load the created data for the store
      let { data: household } = await supabase.from('households').select('*').eq('id', household_id).single();
      const { data: member } = await supabase.from('members').select('*').eq('id', member_id).single();
      const { data: shoppingList } = await supabase.from('shopping_lists').select('*').eq('id', list_id).single();

      // Guess the household's currency, timezone and country from the device (same idea as the
      // language auto-detect in app/_layout.tsx) instead of leaving every new household on the
      // DB defaults of EUR / Europe/Berlin / DE — most of the world matches none of those.
      const deviceLocale = Localization.getLocales()[0];
      const deviceCurrency = deviceLocale?.currencyCode;
      const deviceTimezone = Localization.getCalendars()[0]?.timeZone;
      const deviceCountry = deviceLocale?.regionCode;
      const guesses: { currency?: string; timezone?: string; country?: string } = {};
      // Currency is only trusted when the device's OWN language matches the language the user
      // actually chose for the app — a German UI on an otherwise English-region device (e.g.
      // when generating German Play Store screenshots) should still default to the DB's EUR,
      // not silently inherit an unrelated device currency just because the region field says so.
      if (deviceCurrency && deviceCurrency !== 'EUR' && CURRENCIES.some(c => c.code === deviceCurrency) && deviceLocale?.languageCode === language) guesses.currency = deviceCurrency;
      if (deviceTimezone && deviceTimezone !== 'Europe/Berlin' && TIMEZONES.includes(deviceTimezone)) guesses.timezone = deviceTimezone;
      if (deviceCountry && deviceCountry !== 'DE' && SUPPORTED_COUNTRIES.some(c => c.code === deviceCountry)) guesses.country = deviceCountry;
      if (household && Object.keys(guesses).length > 0) {
        const { data: updated, error: guessError } = await supabase.from('households').update(guesses).eq('id', household_id).select().single();
        // Non-critical: if this fails, the household just stays on the DB defaults
        // (EUR/Europe/Berlin/DE) — still log it so a systematic failure doesn't go unnoticed.
        if (guessError) console.warn('Failed to apply guessed household locale settings:', guessError.message);
        if (updated) household = updated;
      }

      if (household) setHousehold(household);
      if (member) { setCurrentMember(member); setMembers([member]); }
      if (shoppingList) { setShoppingLists([shoppingList]); setActiveListId(shoppingList.id); }
      setItems([]);

      // Chose to create their own household instead of using a pending invite (if any) — that's
      // a deliberate opt-out, don't resurrect the old code on a later launch.
      await clearPendingInviteCode();
      await clearPendingHouseholdChoice();

      // Freshly created household -> mandatory (but skippable) invite step, never shown when
      // joining an existing one. household is now set in the store, so the 'invite' render below
      // can read invite_code/name straight from it.
      setStep('invite');
    } catch (e: any) {
      setErrorMsg(e.message || JSON.stringify(e));
    } finally {
      setLoading(false);
    }
  };

  // ─── INVITE (mandatory-but-skippable step after creating a household) ────
  // Once per entry into the step, guarded the same way as the invite modal — see
  // app/(tabs)/household.tsx. invite_opened is what every later rate is divided by, so a double
  // count here quietly makes the whole funnel look worse than it is.
  const inviteOpenLogged = useRef(false);
  useEffect(() => {
    if (step !== 'invite' || !household) { inviteOpenLogged.current = false; return; }
    if (inviteOpenLogged.current) return;
    inviteOpenLogged.current = true;
    logInviteFunnelStep('invite_opened', household.id);
  }, [step, household?.id]);

  const handleShareInvite = async () => {
    if (!household) { router.replace('/(tabs)'); return; }
    const message = t('household.inviteMessage', { name: household.name, code: household.invite_code });
    try {
      if (Platform.OS === 'web') {
        await navigator.clipboard.writeText(message);
        Alert.alert(t('household.copiedTitle'), t('household.copiedClipboardBody'));
        logInviteFunnelStep('invite_shared', household.id);
      } else {
        const result = await Share.share({ message });
        // dismissedAction is iOS-only; on Android a swiped-away sheet resolves like a sent one,
        // so this stays an upper bound there. See app/(tabs)/household.tsx.
        if (result.action !== Share.dismissedAction) {
          logInviteFunnelStep('invite_shared', household.id);
        }
      }
    } catch {
      // user dismissed the share sheet or it failed — either way, don't block onboarding on it
    } finally {
      router.replace('/(tabs)');
    }
  };

  // ─── WELCOME ─────────────────────────────────────────────
  if (step === 'welcome') return (
    <LinearGradient colors={[colors.brandDark, colors.brand, colors.brandLight]} style={styles.fullscreen}>
      <SafeAreaView style={styles.centered}>
        <Text style={styles.logo}>🏡</Text>
        <Text style={styles.appName}>Heimlig</Text>
        <Text style={styles.tagline}>{t('onboarding.tagline')}</Text>
        <Text style={styles.taglineSub}>{t('onboarding.taglineSub')}</Text>
        <View style={styles.btnGroup}>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => { setIsLogin(false); setStep(pendingInviteCode ? 'auth' : 'slides'); }}>
            <Text style={styles.primaryBtnText}>{t('onboarding.getStarted')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => { setIsLogin(true); setStep('auth'); }}>
            <Text style={styles.secondaryBtnText}>{t('onboarding.haveAccount')}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.legalRow}>
          <TouchableOpacity onPress={() => router.push('/impressum')}>
            <Text style={styles.legalLink}>{t('onboarding.imprint')}</Text>
          </TouchableOpacity>
          <Text style={styles.legalDivider}>·</Text>
          <TouchableOpacity onPress={() => router.push('/datenschutz')}>
            <Text style={styles.legalLink}>{t('onboarding.privacy')}</Text>
          </TouchableOpacity>
        </View>
        {Platform.OS !== 'web' && (
          <TouchableOpacity onPress={() => Linking.openURL('https://heimlig.vercel.app')} style={styles.webHintRow}>
            <Text style={styles.webHintText}>
              {t('onboarding.webHintPrefix')} <Text style={styles.webHintLink}>heimlig.vercel.app</Text> {t('onboarding.webHintSuffix')}
            </Text>
          </TouchableOpacity>
        )}
      </SafeAreaView>
    </LinearGradient>
  );

  // ─── SLIDES ───────────────────────────────────────────────────────────────
  // Three, because there are three things the app does that nobody can guess from the icon.
  // Skippable from the first one — somebody who already knows what they came for should not
  // have to page through an explanation to reach the household screen.
  const SLIDES = [
    { emoji: '🛒', title: t('onboarding.slide1Title'), body: t('onboarding.slide1Body') },
    { emoji: '🧹', title: t('onboarding.slide2Title'), body: t('onboarding.slide2Body') },
    { emoji: '💶', title: t('onboarding.slide3Title'), body: t('onboarding.slide3Body') },
  ];
  if (step === 'slides') {
    const slide = SLIDES[slideIndex];
    const isLast = slideIndex === SLIDES.length - 1;
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.slideSkipRow}>
          <TouchableOpacity onPress={() => setStep('household')}>
            <Text style={styles.slideSkipText}>{t('onboarding.slideSkip')}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.slideBody}>
          <Text style={styles.slideEmoji}>{slide.emoji}</Text>
          <Text style={styles.slideTitle}>{slide.title}</Text>
          <Text style={styles.slideText}>{slide.body}</Text>
        </View>
        <View style={styles.slideFooter}>
          <View style={styles.slideDots}>
            {SLIDES.map((_, i) => (
              <View key={i} style={[styles.slideDot, i === slideIndex && styles.slideDotActive]} />
            ))}
          </View>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => isLast ? setStep('household') : setSlideIndex(i => i + 1)}
          >
            <Text style={styles.primaryBtnText}>{isLast ? t('onboarding.slideStart') : t('onboarding.slideNext')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ─── HOUSEHOLD: create or join, BEFORE any account exists ─────────────────
  // Collects a name or a code and nothing else — no network call, no session needed. The RPCs
  // that actually create or join both require auth.uid(), so the work happens after the login;
  // this step only records what the login is for.
  if (step === 'household') return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.stepContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.stepTitle}>{t('onboarding.householdStepTitle')}</Text>
          <Text style={styles.stepSub}>{t('onboarding.householdStepSub')}</Text>
          <View style={styles.joinTabRow}>
            <TouchableOpacity style={[styles.joinTab, !joinMode && styles.joinTabActive]} onPress={() => { setJoinMode(false); setErrorMsg(null); }}>
              <Text style={[styles.joinTabText, !joinMode && styles.joinTabTextActive]}>{t('onboarding.createNewTab')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.joinTab, joinMode && styles.joinTabActive]} onPress={() => { setJoinMode(true); setErrorMsg(null); }}>
              <Text style={[styles.joinTabText, joinMode && styles.joinTabTextActive]}>{t('onboarding.enterCodeTab')}</Text>
            </TouchableOpacity>
          </View>
          {!joinMode ? (
            <>
              <Text style={styles.inputLabel}>{t('onboarding.householdNameLabel')}</Text>
              <TextInput style={styles.textInput} placeholder={t('onboarding.householdNamePlaceholder')} value={householdName} onChangeText={setHouseholdName} placeholderTextColor={colors.textMuted} />
            </>
          ) : (
            <>
              <Text style={styles.inputLabel}>{t('onboarding.inviteCodeLabel')}</Text>
              <TextInput style={styles.textInput} placeholder={t('onboarding.inviteCodePlaceholder')} value={inviteCode} onChangeText={setInviteCode} autoCapitalize="characters" placeholderTextColor={colors.textMuted} />
              {/* No validity check here on purpose: resolve_invite_code runs as an authenticated
                  user, and opening it up to anonymous callers is a database change this rebuild
                  deliberately avoids. A wrong code surfaces after the login, on the name step,
                  where it can be corrected without losing the flow. */}
              <Text style={styles.hintText}>{t('onboarding.inviteCodeCheckedLater')}</Text>
            </>
          )}
          <TouchableOpacity
            style={[styles.primaryBtn, (joinMode ? !inviteCode.trim() : !householdName.trim()) && styles.disabled]}
            onPress={() => {
              savePendingHouseholdChoice(joinMode
                ? { mode: 'join', code: inviteCode.trim().toUpperCase() }
                : { mode: 'create', name: householdName.trim() });
              setStep('auth');
            }}
            disabled={joinMode ? !inviteCode.trim() : !householdName.trim()}
          >
            <Text style={styles.primaryBtnText}>{t('onboarding.continueButton')}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );

  // ─── AUTH ─────────────────────────────────────────────────
  if (step === 'auth') return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.stepContent}>
          <Text style={styles.stepTitle}>{isLogin ? t('onboarding.welcomeBack') : t('onboarding.createAccount')}</Text>
          <TextInput
            style={styles.textInput} placeholder={t('onboarding.emailPlaceholder')} value={email}
            onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none"
            placeholderTextColor={colors.textMuted}
          />
          <View style={styles.passwordRow}>
            <TextInput
              style={styles.passwordInput} placeholder={t('onboarding.passwordPlaceholder')} value={password}
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
            <Text style={styles.primaryBtnText}>{loading ? t('onboarding.loadingButton') : isLogin ? t('onboarding.loginButton') : t('onboarding.continueButton')}</Text>
          </TouchableOpacity>
          {isLogin && (
            <TouchableOpacity style={styles.forgotBtn} onPress={handleForgotPassword} disabled={loading}>
              <Text style={styles.forgotBtnText}>{t('onboarding.forgotPassword')}</Text>
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
        <Text style={styles.stepTitle}>{t('onboarding.verifyTitle')}</Text>
        <Text style={styles.stepSub}>{t('onboarding.verifyBody', { email })}</Text>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => { setIsLogin(true); setErrorMsg(null); setStep('auth'); }}
        >
          <Text style={styles.primaryBtnText}>{t('onboarding.goToLoginButton')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );

  // ─── NAME & HOUSEHOLD ─────────────────────────────────────
  if (step === 'name') return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.stepContent}>
          <Text style={styles.stepTitle}>{t('onboarding.nameStepTitle')}</Text>
          <Text style={styles.stepSub}>{t('onboarding.nameStepSub')}</Text>
          <Text style={styles.inputLabel}>{t('onboarding.nameLabel')}</Text>
          <TextInput style={styles.textInput} placeholder={t('onboarding.namePlaceholder')} value={displayName} onChangeText={setDisplayName} placeholderTextColor={colors.textMuted} />
          <Text style={styles.inputLabel}>{t('onboarding.colorLabel')}</Text>
          <View style={styles.colorRow}>
            {AVATAR_COLORS.map(c => (
              <TouchableOpacity
                key={c}
                style={[styles.colorDot, { backgroundColor: c }, avatarColor === c && styles.colorDotActive]}
                onPress={() => setAvatarColor(c)}
              />
            ))}
          </View>
          {/* The choice itself was made before the account existed (step 'household'). What
              stays here is the value, still editable — that is the escape hatch for a mistyped
              invite code, which can only fail this late because it is never checked before the
              login. Switching mode outright stays possible too, via the link below. */}
          {!joinMode ? (
            <>
              <Text style={styles.inputLabel}>{t('onboarding.householdNameLabel')}</Text>
              <TextInput style={styles.textInput} placeholder={t('onboarding.householdNamePlaceholder')} value={householdName} onChangeText={setHouseholdName} placeholderTextColor={colors.textMuted} />
              {errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}
              <TouchableOpacity
                style={[styles.primaryBtn, (!displayName || !householdName || loading) && styles.disabled]}
                onPress={handleCreateHousehold}
                disabled={!displayName || !householdName || loading}
              >
                <Text style={styles.primaryBtnText}>{loading ? t('onboarding.creatingHousehold') : t('onboarding.createHouseholdButton')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.switchModeBtn} onPress={() => { setJoinMode(true); setErrorMsg(null); }}>
                <Text style={styles.switchModeText}>{t('onboarding.switchToJoin')}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.inputLabel}>{t('onboarding.inviteCodeLabel')}</Text>
              <TextInput style={styles.textInput} placeholder={t('onboarding.inviteCodePlaceholder')} value={inviteCode} onChangeText={setInviteCode} autoCapitalize="characters" placeholderTextColor={colors.textMuted} />
              {errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}
              <TouchableOpacity
                style={[styles.primaryBtn, (!displayName || !inviteCode || loading) && styles.disabled]}
                onPress={handleJoinHousehold}
                disabled={!displayName || !inviteCode || loading}
              >
                <Text style={styles.primaryBtnText}>{loading ? t('onboarding.joining') : t('onboarding.joinHouseholdButton')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.switchModeBtn} onPress={() => { setJoinMode(false); setErrorMsg(null); }}>
                <Text style={styles.switchModeText}>{t('onboarding.switchToCreate')}</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );

  // ─── INVITE ────────────────────────────────────────────────
  if (step === 'invite') return (
    <SafeAreaView style={styles.container}>
      <View style={styles.stepContent}>
        <Text style={styles.stepTitle}>{t('onboarding.inviteStepTitle')}</Text>
        <Text style={styles.stepSub}>{t('onboarding.inviteStepBody')}</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={handleShareInvite}>
          <Text style={styles.primaryBtnText}>{t('onboarding.inviteStepShareButton')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.inviteSkipBtn} onPress={() => router.replace('/(tabs)')}>
          <Text style={styles.inviteSkipText}>{t('onboarding.inviteStepSkip')}</Text>
        </TouchableOpacity>
      </View>
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
  legalRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.lg, gap: spacing.sm },
  legalLink: { ...typography.xs, color: 'rgba(255,255,255,0.6)', textDecorationLine: 'underline' },
  legalDivider: { ...typography.xs, color: 'rgba(255,255,255,0.4)' },
  webHintRow: { marginTop: spacing.md },
  webHintText: { ...typography.xs, color: 'rgba(255,255,255,0.6)', textAlign: 'center' },
  webHintLink: { color: '#fff', fontWeight: '700', textDecorationLine: 'underline' },
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
  forgotBtn: { alignItems: 'center', paddingVertical: spacing.md },
  forgotBtnText: { ...typography.body, color: colors.brand, fontWeight: '600' },
  joinTabRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg, marginTop: spacing.sm },
  joinTab: { flex: 1, padding: spacing.sm + 2, borderRadius: radius.md, alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  joinTabActive: { backgroundColor: colors.brandPale, borderColor: colors.brand },
  joinTabText: { ...typography.body, color: colors.textSecondary, fontWeight: '600', fontSize: 14 },
  joinTabTextActive: { color: colors.brand },
  slideSkipRow: { alignItems: 'flex-end', paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  slideSkipText: { ...typography.sm, color: colors.textMuted, textDecorationLine: 'underline' },
  slideBody: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  slideEmoji: { fontSize: 72, marginBottom: spacing.xl },
  slideTitle: { ...typography.h1, color: colors.text, textAlign: 'center', marginBottom: spacing.md },
  slideText: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  slideFooter: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.lg },
  slideDots: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm },
  slideDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  slideDotActive: { backgroundColor: colors.brand, width: 20 },
  hintText: { ...typography.xs, color: colors.textMuted, marginTop: -spacing.sm, marginBottom: spacing.md },
  switchModeBtn: { alignItems: 'center', padding: spacing.md },
  switchModeText: { ...typography.sm, color: colors.brand, fontWeight: '600' },
  inviteSkipBtn: { alignItems: 'center', padding: spacing.md, marginTop: spacing.sm },
  inviteSkipText: { ...typography.sm, color: colors.textMuted, textDecorationLine: 'underline' },
});
