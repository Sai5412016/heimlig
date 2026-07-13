// components/NightSky.tsx — full night-sky backdrop for the "witch-purple" theme.
// Static only (no Animated.View) — FlyingWitch.tsx still provides the motion, this just
// paints the scene behind the tab navigator, same slot as MatrixRain.
import React, { useMemo } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const STAR_COUNT = 26;

// Deterministic pseudo-random so stars don't jump around on every re-render.
function seeded(i: number) {
  const x = Math.sin(i * 999.7) * 10000;
  return x - Math.floor(x);
}

export default function NightSky() {
  const { width, height } = useWindowDimensions();
  const stars = useMemo(
    () => Array.from({ length: STAR_COUNT }, (_, i) => ({
      x: seeded(i) * width,
      y: seeded(i + 100) * height,
      size: 1.5 + seeded(i + 200) * 2,
      opacity: 0.25 + seeded(i + 300) * 0.55,
    })),
    [width, height]
  );

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient colors={['#0B0616', '#150B24', '#0B0616']} style={StyleSheet.absoluteFill} />
      {stars.map((s, i) => (
        <View key={i} style={{ position: 'absolute', left: s.x, top: s.y, width: s.size, height: s.size, borderRadius: s.size / 2, backgroundColor: '#F1E9FF', opacity: s.opacity }} />
      ))}
      <View style={styles.moonBase}>
        <View style={styles.moonNotch} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  moonBase: { position: 'absolute', top: 70, right: 34, width: 52, height: 52, borderRadius: 26, backgroundColor: '#EDE3FF22', overflow: 'hidden' },
  moonNotch: { position: 'absolute', top: -8, right: -14, width: 52, height: 52, borderRadius: 26, backgroundColor: '#0B0616' },
});
