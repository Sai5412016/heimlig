// components/PitchField.tsx — full night-pitch backdrop for the "pitch-gold" theme.
// Static only (no Animated.View) — the ball in PitchBall.tsx still provides the motion,
// this just paints the scene behind the tab navigator (see app/(tabs)/_layout.tsx),
// same slot as MatrixRain.
import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const STRIPE_COUNT = 7;

export default function PitchField() {
  const { width, height } = useWindowDimensions();
  const stripeHeight = height / STRIPE_COUNT;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient colors={['#0A160C', '#0F1D12', '#0A160C']} style={StyleSheet.absoluteFill} />
      {Array.from({ length: STRIPE_COUNT }, (_, i) => (
        i % 2 === 0 && (
          <View key={i} style={{ position: 'absolute', top: i * stripeHeight, left: 0, right: 0, height: stripeHeight, backgroundColor: '#FFFFFF06' }} />
        )
      ))}
      <View style={[styles.glow, { top: -60, left: -40 }]} />
      <View style={[styles.glow, { top: -60, right: -40 }]} />
      <View style={[styles.centerCircle, { left: width / 2 - 70, top: height * 0.42 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  glow: { position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: '#FFE9A322' },
  centerCircle: { position: 'absolute', width: 140, height: 140, borderRadius: 70, borderWidth: 1.5, borderColor: '#FFFFFF14' },
});
