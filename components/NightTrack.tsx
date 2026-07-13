// components/NightTrack.tsx — full night-track backdrop for the "racing" theme.
// Static only (no Animated.View) — RacingCar.tsx still provides the motion, this just
// paints the scene behind the tab navigator, same slot as MatrixRain.
import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function NightTrack() {
  const { width, height } = useWindowDimensions();

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient colors={['#0A0A0C', '#16161A', '#0A0A0C']} style={StyleSheet.absoluteFill} />
      <View style={[styles.streak, { top: height * 0.18, left: -60, width: width + 120 }]} />
      <View style={[styles.streak, { top: height * 0.52, left: -60, width: width + 120 }]} />
      <View style={[styles.streak, { top: height * 0.8, left: -60, width: width + 120 }]} />
      <LinearGradient colors={['transparent', '#C1121F1F']} style={[StyleSheet.absoluteFill, { top: height * 0.6 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  streak: { position: 'absolute', height: 2, backgroundColor: '#FFFFFF0A', transform: [{ rotate: '-4deg' }] },
});
