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

type Status = 'idle' | 'joining' | 'done' | 'error' | 'login' | 'web';

export default function JoinByCode() {
  const { code: rawCode } = useLocalSearchParams<{ code: string }>();
  const code = String(rawCode || '').toUpperCase().trim();
  const router = useRouter();
  const { t } = useTranslation();
  const { currentMember } = useStore();
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');

  // On web, the page only acts as a bridge: open the installed app via the custom scheme.
  useEffect(() => {
    if (Platform.OS === 'web') {
      setStatus('web');
      // @ts-ignore - window only exists on web
      window.location.href = `heimlig://join/${code}`;
      return;
    }
    // On native, check whether the user is logged in
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) setStatus('login');
    })();
  }, [code]);

  const handleJoin = async () => {
    setStatus('joining');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setStatus('login'); return; }

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

      if (error) { setStatus('error'); setMessage(error.message); return; }
      if (result?.error) { setStatus('error'); setMessage(result.error); return; }

      setStatus('done');
      setMessage(result?.household_name ?? '');
      setTimeout(() => router.replace('/(tabs)'), 1400);
    } catch (e: any) {
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
