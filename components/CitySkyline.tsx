// components/CitySkyline.tsx — full night-skyline backdrop for the "comic-hero" theme.
// Static only (no Animated.View) — FlyingHero.tsx still provides the motion, this just
// paints the scene behind the tab navigator, same slot as MatrixRain.
import React, { useMemo } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

function seeded(i: number) {
  const x = Math.sin(i * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export default function CitySkyline() {
  const { width, height } = useWindowDimensions();
  const buildings = useMemo(() => {
    const count = Math.max(6, Math.round(width / 46));
    const bw = width / count;
    return Array.from({ length: count }, (_, i) => ({
      x: i * bw,
      w: bw - 3,
      h: height * (0.1 + seeded(i) * 0.22),
      windows: Math.round(2 + seeded(i + 50) * 3),
    }));
  }, [width, height]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient colors={['#0B0F1E', '#141B33', '#0B0F1E']} style={StyleSheet.absoluteFill} />
      <LinearGradient colors={['transparent', '#D628281A']} style={[StyleSheet.absoluteFill, { top: height * 0.68 }]} />
      {buildings.map((b, i) => (
        <View key={i} style={{ position: 'absolute', left: b.x, bottom: 0, width: b.w, height: b.h, backgroundColor: '#0A0D1C' }}>
          {Array.from({ length: b.windows }, (_, w) => (
            <View key={w} style={{ position: 'absolute', left: 4 + (w % 2) * (b.w - 12), top: 8 + Math.floor(w / 2) * 14, width: 4, height: 4, backgroundColor: '#F4A10055' }} />
          ))}
        </View>
      ))}
    </View>
  );
}
