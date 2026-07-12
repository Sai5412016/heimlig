// components/RacingCar.tsx — a generic red racer that speeds across the screen on a short
// stretch of track for the "racing" theme. Same sparse-crossing pattern as PitchBall/
// FlyingWitch (this theme keeps the normal light/dark background, so it drives over content,
// not behind it). Plain shapes only — a generic silhouette, not any real car brand/model.
import React, { useEffect, useRef, useState } from 'react';
import { View, Animated, Easing, StyleSheet, useWindowDimensions, AccessibilityInfo } from 'react-native';
import { APP_THEMES } from '../constants/theme';

const CAR_W = 70;
const CAR_H = 28;
const theme = APP_THEMES.find(t => t.id === 'racing')!;

function CarSprite({ facingRight }: { facingRight: boolean }) {
  return (
    <View style={[styles.sprite, { transform: [{ scaleX: facingRight ? 1 : -1 }] }]}>
      <View style={styles.spoiler} />
      <View style={[styles.body, { backgroundColor: theme.brand }]} />
      <View style={styles.cabin} />
      <View style={[styles.wheel, { left: CAR_W * 0.12 }]}>
        <View style={[styles.wheelHub, { backgroundColor: theme.accent }]} />
      </View>
      <View style={[styles.wheel, { left: CAR_W * 0.68 }]}>
        <View style={[styles.wheelHub, { backgroundColor: theme.accent }]} />
      </View>
    </View>
  );
}

export default function RacingCar() {
  const { width, height } = useWindowDimensions();
  const progress = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(false);
  const [flight, setFlight] = useState<{ y: number; dir: 1 | -1 }>({ y: height * 0.3, dir: 1 });

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
    const drive = () => {
      if (cancelled) return;
      setFlight({ y: height * (0.15 + Math.random() * 0.6), dir: Math.random() > 0.5 ? 1 : -1 });
      progress.setValue(0);
      Animated.timing(progress, {
        toValue: 1,
        duration: 2200 + Math.random() * 1600, // faster than the ball/witch — reads as "speed"
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished && !cancelled) timer = setTimeout(drive, 8000 + Math.random() * 22000);
      });
    };
    timer = setTimeout(drive, 3000 + Math.random() * 6000);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [height, reduceMotion, progress]);

  if (reduceMotion) return null;

  const { y, dir } = flight;
  const startX = dir === 1 ? -CAR_W - 40 : width + CAR_W + 40;
  const endX = dir === 1 ? width + CAR_W + 40 : -CAR_W - 40;
  const trackOpacity = progress.interpolate({ inputRange: [0, 0.08, 0.92, 1], outputRange: [0, 1, 1, 0] });
  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [startX, endX] });

  return (
    <Animated.View pointerEvents="none" style={[styles.wrap, { top: y, transform: [{ translateX }] }]}>
      <Animated.View style={[styles.track, { opacity: trackOpacity, flexDirection: dir === 1 ? 'row' : 'row-reverse' }]}>
        <View style={styles.speedLine} />
        <View style={[styles.speedLine, styles.speedLineShort]} />
      </Animated.View>
      <CarSprite facingRight={dir === 1} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, alignItems: 'center' },
  track: { position: 'absolute', top: CAR_H * 0.62, left: -60, alignItems: 'center', gap: 4 },
  speedLine: { width: 34, height: 3, borderRadius: 2, backgroundColor: '#8D99AE55' },
  speedLineShort: { width: 18 },
  sprite: { width: CAR_W, height: CAR_H + 10 },
  spoiler: { position: 'absolute', left: 0, top: CAR_H * 0.28, width: 6, height: CAR_H * 0.4, backgroundColor: '#1A1A1A', borderRadius: 2 },
  body: { position: 'absolute', left: 4, top: CAR_H * 0.32, width: CAR_W - 4, height: CAR_H * 0.5, borderRadius: CAR_H * 0.25 },
  cabin: {
    position: 'absolute', left: CAR_W * 0.32, top: CAR_H * 0.06, width: CAR_W * 0.4, height: CAR_H * 0.4,
    backgroundColor: '#1A1A1A', borderTopLeftRadius: CAR_H * 0.3, borderTopRightRadius: CAR_H * 0.12, borderBottomLeftRadius: 4, borderBottomRightRadius: 4,
  },
  wheel: { position: 'absolute', bottom: 0, width: 16, height: 16, borderRadius: 8, backgroundColor: '#1A1A1A', alignItems: 'center', justifyContent: 'center' },
  wheelHub: { width: 6, height: 6, borderRadius: 3 },
});
