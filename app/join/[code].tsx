// app/join/[code].tsx
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, radius, typography, shadow } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { useStore } from '../../store/useStore';
import { isMemberLimitError } from '../../lib/premium';
import { DEFAULT_STORE_URL } from '../../lib/appUpdate';
import { logInviteFunnelStep, logJoinOpenedOnce, resolveInviteCode, savePendingInviteCode, clearPendingInviteCode, isAlreadyMemberError } from '../../lib/inviteFunnel';

type Status = 'idle' | 'joining' | 'done' | 'error' | 'login' | 'web';

export default function JoinByCode() {
  const { code: rawCode } = useLocalSearchParams<{ code: string }>();
  const code = String(rawCode || '').toUpperCase().trim();
  const router = useRouter();
  const { t } = useTranslation();
  const { currentMember, switchHousehold, setUserId } = useStore();
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');

  // On web, the page only acts as a bridge: open the installed app via the custom scheme. There
  // is no Android App Link configured (no assetlinks.json / intentFilters in app.json), so this
  // page always loads in a browser first, even with the app installed — the custom-scheme
  // handoff below is what actually opens the app. If that handoff fails (app not installed), the
  // browser tab just sits there with no scheme to open — the fallback timer below sends it to
  // the Play Store instead of dead-ending.
  useEffect(() => {
    if (Platform.OS === 'web') {
      setStatus('web');
      const fallbackTimer = setTimeout(() => {
        // If the tab is still visible/focused when this fires, the custom-scheme handoff never
        // navigated away — the app isn't installed (or the handoff was blocked).
        // @ts-ignore - document only exists on web
        if (typeof document === 'undefined' || !document.hidden) {
          // @ts-ignore - window only exists on web
          window.location.href = DEFAULT_STORE_URL;
        }
      }, 1500);
      // @ts-ignore - window only exists on web
      window.location.href = `heimlig://join/${code}`;
      return () => clearTimeout(fallbackTimer);
    }
    // On native: persist the code FIRST, before anything else — this is the safety net that
    // survives a full auth detour (signup, mail-app switch for email confirmation, login). See
    // lib/inviteFunnel.ts for why AsyncStorage. Cleared once the join actually completes.
    (async () => {
      await savePendingInviteCode(code);

      // join_opened needs a real household_id, which a code alone doesn't give us — resolve it
      // without joining. Works with or without a session now (resolve_invite_code is granted to
      // anon too) — this is exactly the main case: a recipient with no account yet. If the code
      // is invalid this just silently returns null and the step isn't logged (the join attempt
      // itself still surfaces the real error to the user).
      //
      // This screen legitimately mounts more than once for the SAME physical "opened the invite"
      // event — app/_layout.tsx and app/onboarding.tsx both redirect back here once the recipient
      // has a session (see lib/inviteFunnel.ts's logJoinOpenedOnce doc comment) — so the logging
      // itself is deduped per code, not just called once per mount.
      const resolved = await resolveInviteCode(code);

      const { data: { user } } = await supabase.auth.getUser();
      if (resolved) logJoinOpenedOnce(code, resolved.household_id, user?.id ?? null);
      if (!user) { setStatus('login'); return; }
    })();
  }, [code]);

  const handleJoin = async () => {
    setStatus('joining');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setStatus('login'); return; }
      // switchHousehold (store/useStore.ts) below reads userId from the store — nothing sets it
      // when this screen is reached via onboarding.tsx's login/signup redirect (only
      // app/_layout.tsx's checkSession does), so without this switchHousehold would silently
      // no-op for that path.
      setUserId(user.id);

      // Need a display name + colour: prefer the loaded member, otherwise look one up
      let member = currentMember;
      if (!member) {
        const { data } = await supabase.from('members').select('*').eq('user_id', user.id).limit(1);
        member = data?.[0] ?? null;
      }

      const { data: result, error } = await supabase.rpc('join_household_by_code', {
        p_invite_code: code,
        p_display_name: member?.display_name ?? t('joinPage.defaultMemberName'),
        p_avatar_color: member?.avatar_color ?? colors.brand,
      });

      // Transient vs. final, so the pending code (see lib/inviteFunnel.ts) is only thrown away
      // once it's actually dead:
      // - Member limit reached (trg_enforce_member_limit's exception, surfaced as `error` and
      //   matched by isMemberLimitError) and the RPC's own business errors below (unknown/invalid
      //   code — which also covers a household deleted after the code was shared, since it then
      //   simply doesn't resolve to anything) are FINAL: retrying with the same code will never
      //   succeed, so the code must stop resurfacing on later logins.
      // - Any other `error` here means the request got a definite non-2xx response from the
      //   server (not a dropped connection — see the catch block below for that case). We don't
      //   have a reliable way to tell a genuine 5xx apart from it here, so we conservatively keep
      //   the code rather than risk discarding a still-valid invite.
      // - A thrown exception (below, in `catch`) means the request never got a response at all
      //   — network drop, timeout — the textbook transient case, so the code survives.
      if (isMemberLimitError(error)) {
        await clearPendingInviteCode();
        setStatus('error'); setMessage(t('household.memberLimitBody')); return;
      }
      if (error) { setStatus('error'); setMessage(error.message); return; }

      // "Already a member" is the recipient's evident intent, not a failure — e.g. they opened
      // an old link from a chat after having joined some other way already, or tapped the link a
      // second time. Switch them into that household and open it instead of dead-ending on an
      // error (see join_household_by_code — this branch doesn't return household_id, so it needs
      // a separate lookup via resolveInviteCode).
      if (result?.error && isAlreadyMemberError(result.error)) {
        const resolved = await resolveInviteCode(code);
        if (resolved) {
          await switchHousehold(resolved.household_id);
          await clearPendingInviteCode();
          setStatus('done');
          setMessage(resolved.household_name);
          setTimeout(() => router.replace('/(tabs)'), 1400);
          return;
        }
        // Couldn't resolve it after all (code vanished between the two calls) — fall through to
        // the generic error path below instead of silently doing nothing.
      }
      if (result?.error) {
        await clearPendingInviteCode();
        setStatus('error'); setMessage(result.error); return;
      }

      if (result?.household_id) {
        logInviteFunnelStep('join_completed', result.household_id);
        await switchHousehold(result.household_id);
      }
      await clearPendingInviteCode();
      setStatus('done');
      setMessage(result?.household_name ?? '');
      setTimeout(() => router.replace('/(tabs)'), 1400);
    } catch (e: any) {
      // Never reached a response — see the transient/final note above.
      setStatus('error');
      setMessage(e?.message ?? t('joinPage.joinFailedBody'));
    }
  };

  return (
    <LinearGradient colors={[colors.brandDark, colors.brand, colors.brandLight]} style={styles.fullscreen}>
      <SafeAreaView style={styles.centered}>
        <Text style={styles.logo}>🔑</Text>
        <Text style={styles.title}>{t('joinPage.title')}</Text>

        {status === 'web' && (
          <Text style={styles.sub}>{t('joinPage.webOpening')}</Text>
        )}

        {status === 'login' && (
          <>
            <Text style={styles.sub}>{t('joinPage.loginPrompt', { code })}</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => router.replace('/onboarding')}>
              <Text style={styles.primaryBtnText}>{t('onboarding.goToLoginButton')}</Text>
            </TouchableOpacity>
          </>
        )}

        {(status === 'idle' || status === 'joining') && Platform.OS !== 'web' && (
          <>
            <Text style={styles.sub}>{t('joinPage.invitedPrompt')}</Text>
            <View style={styles.codeBox}><Text style={styles.codeText}>{code}</Text></View>
            <TouchableOpacity
              style={[styles.primaryBtn, status === 'joining' && styles.disabled]}
              onPress={handleJoin}
              disabled={status === 'joining'}
            >
              {status === 'joining'
                ? <ActivityIndicator color={colors.brand} />
                : <Text style={styles.primaryBtnText}>{t('joinPage.joinButton')}</Text>}
            </TouchableOpacity>
          </>
        )}

        {status === 'done' && (
          <Text style={styles.sub}>{t('joinPage.welcomeBody', { name: message })}</Text>
        )}

        {status === 'error' && (
          <>
            <Text style={styles.errorText}>{message}</Text>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.replace('/(tabs)')}>
              <Text style={styles.secondaryBtnText}>{t('joinPage.goToApp')}</Text>
            </TouchableOpacity>
          </>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fullscreen: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  logo: { fontSize: 72, marginBottom: spacing.md },
  title: { fontSize: 32, fontWeight: '800', color: colors.textInverse, marginBottom: spacing.md, textAlign: 'center' },
  sub: { ...typography.body, color: 'rgba(255,255,255,0.9)', textAlign: 'center', marginBottom: spacing.xl },
  codeBox: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: radius.md, paddingVertical: spacing.md, paddingHorizontal: spacing.xl, marginBottom: spacing.xl },
  codeText: { fontSize: 28, fontWeight: '800', color: colors.textInverse, letterSpacing: 4 },
  primaryBtn: { backgroundColor: colors.surface, borderRadius: radius.md, paddingVertical: spacing.md + 2, paddingHorizontal: spacing.xxl, alignItems: 'center', minWidth: 200, ...shadow.md },
  primaryBtnText: { ...typography.body, color: colors.brand, fontWeight: '700' },
  secondaryBtn: { padding: spacing.md },
  secondaryBtnText: { ...typography.body, color: 'rgba(255,255,255,0.85)' },
  disabled: { opacity: 0.6 },
  errorText: { color: '#fff', backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 8, padding: 12, marginBottom: 16, textAlign: 'center' },
});
