// app/konto-loeschen.tsx — self-service account deletion, two stages.
//
// Stage 1 explains what goes and what stays, and — this is the part that needs the server — lists
// every household the user is in with what will happen to it. Stage 2 makes them type the word.
//
// The per-household preview comes from the RPC preview_account_deletion() rather than being
// worked out here from `members`, deliberately: it applies the exact same rules as
// delete_account() (who inherits admin, whether the household disappears), so the screen cannot
// promise one thing while the server does another. The client also can't see the other
// households' member lists anyway.
import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Alert } from '../lib/alert';
import { spacing, radius, typography, type ColorPalette } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';

type PreviewHousehold = {
  household_id: string;
  household_name: string;
  other_members: number;
  household_will_be_deleted: boolean;
  new_admin: string | null;
};

export default function KontoLoeschenScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const resetSession = useStore(s => s.resetSession);

  const [stage, setStage] = useState<'info' | 'confirm'>('info');
  const [households, setHouseholds] = useState<PreviewHousehold[] | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc('preview_account_deletion');
      if (cancelled) return;
      if (error) {
        console.warn('[konto-loeschen] preview_account_deletion failed —', error.message);
        setPreviewFailed(true);
        return;
      }
      setHouseholds((data as any)?.households ?? []);
    })();
    return () => { cancelled = true; };
  }, []);

  const confirmWord = t('accountDelete.confirmWord');
  const wordMatches = typed.trim().toUpperCase() === confirmWord.toUpperCase();

  const handleDelete = async () => {
    if (!wordMatches || busy) return;
    setBusy(true);
    try {
      // 'DELETE' is a fixed protocol value, not the word the user typed — the UI word is
      // translated, the API's is not.
      const { data, error } = await supabase.functions.invoke('delete-account', {
        body: { confirm: 'DELETE' },
      });

      if (error || !(data as any)?.ok) {
        console.warn('[konto-loeschen] delete-account failed —', error?.message ?? JSON.stringify(data));
        Alert.alert(t('accountDelete.errorTitle'), t('accountDelete.errorBody'));
        setBusy(false);
        return;
      }

      // The account is gone at this point; the local session is just a stale token. Clear the
      // store first so no household data is left in memory behind the onboarding screen.
      resetSession();
      await supabase.auth.signOut();
      router.replace('/onboarding');
    } catch (e: any) {
      console.warn('[konto-loeschen] delete-account threw —', e?.message ?? e);
      Alert.alert(t('accountDelete.errorTitle'), t('accountDelete.errorBody'));
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} disabled={busy}>
          <Text style={styles.backText}>‹ {t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('accountDelete.title')}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {stage === 'info' ? (
          <>
            <Text style={styles.intro}>{t('accountDelete.intro')}</Text>

            <Text style={styles.h2}>{t('accountDelete.goesTitle')}</Text>
            <View style={styles.card}>
              <Bullet styles={styles}>{t('accountDelete.goesAccount')}</Bullet>
              <Bullet styles={styles}>{t('accountDelete.goesMemberships')}</Bullet>
              <Bullet styles={styles}>{t('accountDelete.goesPurchases')}</Bullet>
              <Bullet styles={styles}>{t('accountDelete.goesFeedback')}</Bullet>
              <Bullet styles={styles}>{t('accountDelete.goesUsage')}</Bullet>
            </View>

            <Text style={styles.h2}>{t('accountDelete.staysTitle')}</Text>
            <View style={styles.card}>
              <Bullet styles={styles}>{t('accountDelete.staysContent')}</Bullet>
              <Bullet styles={styles}>{t('accountDelete.staysBudget')}</Bullet>
            </View>

            <Text style={styles.h2}>{t('accountDelete.householdsTitle')}</Text>
            {households === null ? (
              <Text style={styles.muted}>
                {previewFailed ? t('accountDelete.loadFailed') : t('accountDelete.householdsLoading')}
              </Text>
            ) : households.length === 0 ? (
              <Text style={styles.muted}>{t('accountDelete.householdsNone')}</Text>
            ) : (
              households.map(h => (
                <View key={h.household_id} style={styles.card}>
                  <Text style={styles.householdName}>{h.household_name}</Text>
                  <Text style={h.household_will_be_deleted ? styles.warn : styles.muted}>
                    {h.household_will_be_deleted
                      ? t('accountDelete.householdWillBeDeleted')
                      : t('accountDelete.householdStays')}
                  </Text>
                  {/* Only shown when this user is the last admin — that's the one case where
                      somebody else's role changes because of this deletion, so they should see
                      who it lands on before they confirm. */}
                  {!!h.new_admin && (
                    <Text style={styles.handover}>{t('accountDelete.householdHandover', { name: h.new_admin })}</Text>
                  )}
                </View>
              ))
            )}

            <Text style={styles.h2}>{t('accountDelete.timingTitle')}</Text>
            <Text style={styles.p}>{t('accountDelete.timingBody')}</Text>
            <Text style={styles.hint}>{t('accountDelete.exportHint')}</Text>

            <TouchableOpacity style={styles.dangerBtn} onPress={() => setStage('confirm')}>
              <Text style={styles.dangerBtnText}>{t('accountDelete.continueButton')}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.h2}>{t('accountDelete.confirmTitle')}</Text>
            <Text style={styles.p}>{t('accountDelete.confirmBody', { word: confirmWord })}</Text>

            <TextInput
              style={styles.input}
              value={typed}
              onChangeText={setTyped}
              placeholder={confirmWord}
              placeholderTextColor={colors.textMuted}
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!busy}
            />

            <TouchableOpacity
              style={[styles.dangerBtn, (!wordMatches || busy) && styles.dangerBtnOff]}
              onPress={handleDelete}
              disabled={!wordMatches || busy}
            >
              {busy
                ? <ActivityIndicator color={colors.textInverse} />
                : <Text style={styles.dangerBtnText}>{t('accountDelete.deleteButton')}</Text>}
            </TouchableOpacity>
            {busy && <Text style={styles.muted}>{t('accountDelete.deleting')}</Text>}

            <TouchableOpacity style={styles.cancelBtn} onPress={() => setStage('info')} disabled={busy}>
              <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Bullet({ children, styles }: { children: React.ReactNode; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={styles.bulletRow}>
      <Text style={styles.bulletDot}>•</Text>
      <Text style={styles.bulletText}>{children}</Text>
    </View>
  );
}

function makeStyles(colors: ColorPalette) { return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { marginRight: spacing.md },
  backText: { ...typography.body, color: colors.brand, fontWeight: '600' },
  title: { ...typography.h2, color: colors.text },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, ...(Platform.OS === 'web' ? { maxWidth: 720, width: '100%', alignSelf: 'center' } : null) },
  intro: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.md },
  h2: { ...typography.h3, color: colors.text, marginTop: spacing.lg, marginBottom: spacing.sm },
  p: { ...typography.body, color: colors.textSecondary, lineHeight: 22 },
  hint: { ...typography.sm, color: colors.textMuted, marginTop: spacing.sm },
  muted: { ...typography.sm, color: colors.textMuted, marginTop: spacing.xs },
  warn: { ...typography.sm, color: colors.error, marginTop: spacing.xs, fontWeight: '600' },
  handover: { ...typography.sm, color: colors.brand, marginTop: spacing.xs, fontWeight: '600' },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm },
  householdName: { ...typography.body, color: colors.text, fontWeight: '700' },
  bulletRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  bulletDot: { ...typography.body, color: colors.textMuted },
  bulletText: { ...typography.sm, color: colors.textSecondary, flex: 1, lineHeight: 20 },
  input: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md, ...typography.body, color: colors.text, marginTop: spacing.md, letterSpacing: 2 },
  dangerBtn: { backgroundColor: colors.error, borderRadius: radius.md, paddingVertical: spacing.md + 2, alignItems: 'center', marginTop: spacing.xl },
  dangerBtnOff: { opacity: 0.45 },
  dangerBtnText: { ...typography.body, color: colors.textInverse, fontWeight: '700' },
  cancelBtn: { padding: spacing.md, alignItems: 'center', marginTop: spacing.sm },
  cancelBtnText: { ...typography.body, color: colors.textSecondary },
}); }
