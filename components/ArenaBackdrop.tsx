// components/ArenaBackdrop.tsx — full dark-arena backdrop for the "red-light" theme.
// Static only (no Animated.View) — RedLightDoll.tsx still provides the motion/flash, this
// just paints the scene behind the tab navigator, same slot as MatrixRain. Diamond/dot grid
// on purpose, not the show's circle/triangle/square guard-rank symbols.
import React, { useMemo } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

function seeded(i: number) {
  const x = Math.sin(i * 78.233) * 12500;
  return x - Math.floor(x);
}

export default function ArenaBackdrop() {
  const { width, height } = useWindowDimensions();
  const marks = useMemo(
    () => Array.from({ length: 14 }, (_, i) => ({
      x: seeded(i) * width,
      y: seeded(i + 40) * height,
      size: 10 + seeded(i + 80) * 10,
    })),
    [width, height]
  );

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient colors={['#0F0710', '#1A0E14', '#0F0710']} style={StyleSheet.absoluteFill} />
      {marks.map((m, i) => (
        <View key={i} style={{ position: 'absolute', left: m.x, top: m.y, width: m.size, height: m.size, borderRadius: 3, borderWidth: 1, borderColor: '#E0286B1A', transform: [{ rotate: '45deg' }] }} />
      ))}
      <LinearGradient colors={['#00000055', 'transparent', '#00000055']} style={StyleSheet.absoluteFill} />
    </View>
  );
}
