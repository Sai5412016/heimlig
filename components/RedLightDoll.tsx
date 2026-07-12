// components/RedLightDoll.tsx — a "red light, green light" cycle for the "red-light" theme:
// a small faceless doll watcher pinned in a corner turns to face you (with a red screen
// flash) or looks away (green flash), on a randomized timer like the real game. Unlike the
// sparse-crossing family (PitchBall etc.), this one is a persistent HUD element plus an
// occasional full-screen tint — closer to "full background" as requested. Fully abstract
// shapes (no braids, no specific dress pattern, no face beyond two dots) — a mood, not a
// likeness of the show's actual doll design.
import React, { useEffect, useRef, useState } from 'react';
import { View, Animated, StyleSheet, AccessibilityInfo } from 'react-native';
import { APP_THEMES } from '../constants/theme';

const theme = APP_THEMES.find(t => t.id === 'red-light')!;
const RED = '#E53935';
const GREEN = '#43A047';

export default function RedLightDoll() {
  const [reduceMotion, setReduceMotion] = useState(false);
  const [facing, setFacing] = useState(true); // true = red light, facing you
  const eyesOpacity = useRef(new Animated.Value(1)).current;
  const flashOpacity = useRef(new Animated.Value(0)).current;
  const flashColor = useRef(new Animated.Value(1)).current; // 1 = red, 0 = green (interpolated)

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
    const cycle = (isRed: boolean) => {
      if (cancelled) return;
      setFacing(isRed);
      flashColor.setValue(isRed ? 1 : 0);
      Animated.timing(eyesOpacity, { toValue: isRed ? 1 : 0, duration: 180, useNativeDriver: true }).start();
      Animated.sequence([
        Animated.timing(flashOpacity, { toValue: 0.16, duration: 140, useNativeDriver: true }),
        Animated.timing(flashOpacity, { toValue: 0, duration: 700, useNativeDriver: true }),
      ]).start();
      const duration = isRed ? 2500 + Math.random() * 2000 : 4000 + Math.random() * 4000;
      timer = setTimeout(() => cycle(!isRed), duration);
    };
    timer = setTimeout(() => cycle(true), 1500);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [reduceMotion, eyesOpacity, flashOpacity, flashColor]);

  const flashBg = flashColor.interpolate({ inputRange: [0, 1], outputRange: [GREEN, RED] });

  return (
    <>
      {!reduceMotion && (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: flashBg, opacity: flashOpacity }]} />
      )}
      <View pointerEvents="none" style={styles.wrap}>
        <View style={[styles.dress, { backgroundColor: theme.brandDark }]} />
        <View style={styles.bunLeft} />
        <View style={styles.bunRight} />
        <View style={styles.head}>
          <Animated.View style={[styles.eyes, { opacity: reduceMotion ? 1 : eyesOpacity }]}>
            <View style={styles.eye} />
            <View style={styles.eye} />
          </Animated.View>
        </View>
        <View style={[styles.indicator, { backgroundColor: (reduceMotion || facing) ? RED : GREEN }]} />
      </View>
    </>
  );
}

const DOLL_W = 46;
const DOLL_H = 64;

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: 58, right: 14, width: DOLL_W, height: DOLL_H, opacity: 0.92 },
  dress: { position: 'absolute', bottom: 0, left: DOLL_W * 0.1, right: DOLL_W * 0.1, height: DOLL_H * 0.5, borderTopLeftRadius: DOLL_W * 0.3, borderTopRightRadius: DOLL_W * 0.3, borderBottomLeftRadius: DOLL_W * 0.12, borderBottomRightRadius: DOLL_W * 0.12 },
  head: { position: 'absolute', top: 0, left: DOLL_W * 0.18, width: DOLL_W * 0.64, height: DOLL_W * 0.64, borderRadius: DOLL_W * 0.32, backgroundColor: '#F5E9DC', alignItems: 'center', justifyContent: 'center' },
  bunLeft: { position: 'absolute', top: DOLL_W * 0.06, left: -DOLL_W * 0.02, width: DOLL_W * 0.22, height: DOLL_W * 0.22, borderRadius: DOLL_W * 0.11, backgroundColor: '#3A1220' },
  bunRight: { position: 'absolute', top: DOLL_W * 0.06, right: -DOLL_W * 0.02, width: DOLL_W * 0.22, height: DOLL_W * 0.22, borderRadius: DOLL_W * 0.11, backgroundColor: '#3A1220' },
  eyes: { flexDirection: 'row', gap: 6 },
  eye: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#2A1810' },
  indicator: { position: 'absolute', bottom: -4, right: -2, width: 8, height: 8, borderRadius: 4 },
});
