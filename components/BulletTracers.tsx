// components/BulletTracers.tsx — fast crossfire tracers for the "tactical-ops" theme.
// Same sparse-crossing family as PitchBall/FlyingWitch/RacingCar (this theme keeps the
// normal light/dark background, so tracers fly over content, not behind it), but instead of
// one slow object this fires short bursts of 2-4 very fast streaks alternating from left and
// right — reads as "two sides exchanging fire" without drawing two actual characters.
import React, { useEffect, useRef, useState } from 'react';
import { View, Animated, Easing, StyleSheet, useWindowDimensions, AccessibilityInfo } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { APP_THEMES } from '../constants/theme';

const TRACER_LEN = 110;
const theme = APP_THEMES.find(t => t.id === 'tactical-ops')!;

function Tracer({ y, dir, delay, width, onDone }: { y: number; dir: 1 | -1; delay: number; width: number; onDone: () => void }) {
  const progress = useRef(new Animated.Value(0)).current;
  const flash = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const t = setTimeout(() => {
      Animated.timing(flash, { toValue: 1, duration: 90, useNativeDriver: true }).start(() => {
        Animated.timing(flash, { toValue: 0, duration: 160, useNativeDriver: true }).start();
      });
      Animated.timing(progress, {
        toValue: 1,
        duration: 380 + Math.random() * 220,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start(onDone);
    }, delay);
    return () => clearTimeout(t);
  }, []);

  const startX = dir === 1 ? -TRACER_LEN : width + TRACER_LEN;
  const endX = dir === 1 ? width + TRACER_LEN : -TRACER_LEN;
  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [startX, endX] });
  const opacity = progress.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 1, 0] });
  const gradientColors = dir === 1
    ? ['transparent', theme.brand, '#FFE4B3'] as const
    : ['#FFE4B3', theme.brand, 'transparent'] as const;

  // Single wrapping View (never a bare Fragment) — see BulletTracers() below for why.
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View pointerEvents="none" style={[styles.spark, { top: y - 3, left: dir === 1 ? -6 : width - 4, opacity: flash }]} />
      <Animated.View pointerEvents="none" style={[styles.tracer, { top: y, transform: [{ translateX }], opacity }]}>
        <LinearGradient colors={gradientColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.tracerFill} />
      </Animated.View>
    </View>
  );
}

export default function BulletTracers() {
  const { width, height } = useWindowDimensions();
  const [reduceMotion, setReduceMotion] = useState(false);
  const [tracers, setTracers] = useState<{ id: number; y: number; dir: 1 | -1; delay: number }[]>([]);
  const nextId = useRef(0);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then(v => { if (mounted) setReduceMotion(v); }).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v: boolean) => setReduceMotion(v));
    return () => { mounted = false; sub.remove(); };
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const burst = () => {
      if (cancelled) return;
      const count = 2 + Math.floor(Math.random() * 3);
      const shots = Array.from({ length: count }, () => ({
        id: nextId.current++,
        y: height * (0.12 + Math.random() * 0.6),
        dir: (Math.random() > 0.5 ? 1 : -1) as 1 | -1,
        delay: Math.random() * 500,
      }));
      setTracers(shots);
      timer = setTimeout(burst, 6000 + Math.random() * 14000);
    };
    timer = setTimeout(burst, 3000 + Math.random() * 5000);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [height, reduceMotion]);

  // Always render the same single wrapping View (never null, never a bare Fragment around a
  // variable-length .map()) so this component always contributes exactly one child to its
  // parent (app/(tabs)/_layout.tsx) regardless of how many tracers are in flight — a Fragment
  // whose child count changed every burst previously caused an Android
  // "getChildDrawingOrder() returned invalid index" crash (child count desync).
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {!reduceMotion && tracers.map(t => (
        <Tracer key={t.id} y={t.y} dir={t.dir} delay={t.delay} width={width} onDone={() => {}} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  tracer: { position: 'absolute', left: 0, width: TRACER_LEN, height: 3 },
  tracerFill: { flex: 1, borderRadius: 2 },
  spark: { position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFE4B3' },
});
