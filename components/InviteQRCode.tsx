// components/InviteQRCode.tsx — the invite code as a scannable QR.
//
// Why this exists: three households demonstrably grew (4, 2 and 2 members) without a single
// invite_shared or invite_code_copied event ever being logged. The codes travelled by word of
// mouth — read out loud, typed in by hand — while the app only ever offered the share sheet and
// the clipboard. Neither of those helps two people standing next to each other, which is the
// situation a household invite actually happens in.
//
// Shared by app/(tabs)/household.tsx and app/onboarding.tsx so the contrast rule below is stated
// once rather than copied into two screens and then drifting.
import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useTranslation } from 'react-i18next';
import { spacing, radius, typography, type ColorPalette } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';

export const INVITE_QR_SIZE = 200;

// The same URL the share text carries (household.inviteMessage), so a scan and a tapped link
// land on exactly the same route.
export function inviteJoinUrl(code: string): string {
  return `https://heimlig.app/join/${code}`;
}

export default function InviteQRCode({ code, size = INVITE_QR_SIZE }: { code: string; size?: number }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  // Guard rather than render an empty QR: household.invite_code is briefly undefined while the
  // household row loads, and QRCode throws on an empty value.
  if (!code) return null;

  return (
    <View style={styles.wrap}>
      {/* Hard-coded #FFFFFF / #000000 instead of theme colours, and this is deliberate — it is
          the one place in the app where the convention "colours only via useTheme()" must not
          apply. A QR code has to be dark-on-light to be readable; rendered light-on-dark in one
          of the seven forceDark themes most phone cameras simply refuse to detect it. The white
          plate with padding around it is the quiet zone the spec requires, and it also keeps the
          code legible against Matrix's animated black backdrop. */}
      <View style={styles.plate}>
        <QRCode value={inviteJoinUrl(code)} size={size} backgroundColor="#FFFFFF" color="#000000" />
      </View>
      <Text style={styles.hint}>{t('household.qrHint')}</Text>
    </View>
  );
}

function makeStyles(colors: ColorPalette) { return StyleSheet.create({
  wrap: { alignItems: 'center', marginBottom: spacing.lg },
  plate: {
    backgroundColor: '#FFFFFF',
    padding: spacing.md,
    borderRadius: radius.lg,
    // A visible edge so the white plate doesn't melt into a light theme's white surface.
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  hint: { ...typography.sm, color: colors.textSecondary, marginTop: spacing.sm, textAlign: 'center' },
}); }
