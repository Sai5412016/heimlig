// components/OpsBackdrop.tsx — full ops-backdrop for the "tactical-ops" theme.
// Static only (no Animated.View) — BulletTracers.tsx still provides the motion, this just
// paints the scene behind the tab navigator, same slot as MatrixRain.
import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function OpsBackdrop() {
  const { width, height } = useWindowDimensions();

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient colors={['#14171B', '#20242A', '#14171B']} style={StyleSheet.absoluteFill} />
      <View style={[styles.stripe, { top: height * 0.15, left: -60, width: width + 120 }]} />
      <View style={[styles.stripe, { top: height * 0.5, left: -60, width: width + 120 }]} />
      <View style={[styles.stripe, { top: height * 0.82, left: -60, width: width + 120 }]} />
      <LinearGradient colors={['transparent', '#FF6A1322']} style={[StyleSheet.absoluteFill, { top: height * 0.72 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  stripe: { position: 'absolute', height: 34, backgroundColor: '#FFFFFF05', transform: [{ rotate: '-6deg' }] },
});
