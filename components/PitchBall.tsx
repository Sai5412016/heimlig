// components/PitchBall.tsx — a football that occasionally arcs across the screen for the
// "pitch-gold" theme. Much sparser than MatrixRain on purpose: this theme keeps the normal
// light/dark background (no forceDark), so a constant animated layer would fight with actual
// list content — one ball, every 10-35s, reads as a nice surprise instead of a distraction.
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Text, StyleSheet, useWindowDimensions, AccessibilityInfo } from 'react-native';

const BALL_SIZE = 34;

export default function PitchBall() {
  const { width, height } = useWindowDimensions();
  const progress = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(false);
  const [flight, setFlight] = useState<{ y: number; dir: 1 | -1 }>({ y: height * 0.25, dir: 1 });

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
    const fly = () => {
      if (cancelled) return;
      setFlight({ y: height * (0.12 + Math.random() * 0.55), dir: Math.random() > 0.5 ? 1 : -1 });
      progress.setValue(0);
      Animated.timing(progress, {
        toValue: 1,
        duration: 4000 + Math.random() * 3000,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished && !cancelled) timer = setTimeout(fly, 10000 + Math.random() * 25000);
      });
    };
    timer = setTimeout(fly, 3000 + Math.random() * 6000);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [height, reduceMotion, progress]);

  if (reduceMotion) return null;

  const { y, dir } = flight;
  const startX = dir === 1 ? -BALL_SIZE : width + BALL_SIZE;
  const endX = dir === 1 ? width + BALL_SIZE : -BALL_SIZE;

  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [startX, endX] });
  const translateY = progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [y, y - 70, y] });
  const rotate = progress.interpolate({ inputRange: [0, 1], outputRange: dir === 1 ? ['0deg', '720deg'] : ['0deg', '-720deg'] });

  return (
    <Animated.View pointerEvents="none" style={[styles.ball, { transform: [{ translateX }, { translateY }, { rotate }] }]}>
      <Text style={styles.emoji}>⚽</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  ball: { position: 'absolute', top: 0, left: 0 },
  emoji: { fontSize: BALL_SIZE },
});
