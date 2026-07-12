// components/FlyingHero.tsx — a generic flying comic hero with a lightning speed-trail for
// the "comic-hero" theme. Same sparse-crossing family as PitchBall/FlyingWitch/RacingCar/
// BulletTracers (this theme has no forceDark, so it flies over content, not behind it).
// Plain shapes only, no emblem/face — a mood, not a specific character's likeness.
import React, { useEffect, useRef, useState } from 'react';
import { View, Animated, Easing, StyleSheet, useWindowDimensions, AccessibilityInfo } from 'react-native';
import { APP_THEMES } from '../constants/theme';

const HERO_W = 76;
const HERO_H = 50;
const theme = APP_THEMES.find(t => t.id === 'comic-hero')!;

function Bolt({ style }: { style: any }) {
  return (
    <Animated.View style={[styles.boltWrap, style]}>
      <View style={styles.boltSeg1} />
      <View style={styles.boltSeg2} />
    </Animated.View>
  );
}

function HeroSprite({ facingRight }: { facingRight: boolean }) {
  return (
    <View style={[styles.sprite, { transform: [{ scaleX: facingRight ? 1 : -1 }] }]}>
      <View style={[styles.cape, { backgroundColor: theme.brandDark }]} />
      <View style={[styles.torso, { backgroundColor: theme.accent }]} />
      <View style={[styles.emblem, { backgroundColor: theme.brand }]} />
      <View style={styles.head} />
      <View style={[styles.fist, { backgroundColor: theme.accent }]} />
    </View>
  );
}

export default function FlyingHero() {
  const { width, height } = useWindowDimensions();
  const progress = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(false);
  const [flight, setFlight] = useState<{ y: number; dir: 1 | -1 }>({ y: height * 0.22, dir: 1 });

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
      setFlight({ y: height * (0.1 + Math.random() * 0.55), dir: Math.random() > 0.5 ? 1 : -1 });
      progress.setValue(0);
      Animated.timing(progress, {
        toValue: 1,
        duration: 2600 + Math.random() * 1600, // fast — "super speed", between the ball and the car
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished && !cancelled) timer = setTimeout(fly, 10000 + Math.random() * 25000);
      });
    };
    timer = setTimeout(fly, 3500 + Math.random() * 6000);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [height, reduceMotion, progress]);

  if (reduceMotion) return null;

  const { y, dir } = flight;
  const startX = dir === 1 ? -HERO_W - 50 : width + HERO_W + 50;
  const endX = dir === 1 ? width + HERO_W + 50 : -HERO_W - 50;
  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [startX, endX] });
  const boltOpacity = progress.interpolate({ inputRange: [0, 0.1, 0.9, 1], outputRange: [0, 1, 1, 0] });
  const boltOffset = dir === 1 ? -1 : 1;

  return (
    <Animated.View pointerEvents="none" style={[styles.wrap, { top: y, transform: [{ translateX }] }]}>
      <Bolt style={{ opacity: boltOpacity, transform: [{ translateX: boltOffset * 30 }, { translateY: -10 }, { scaleX: dir === 1 ? -1 : 1 }] }} />
      <Bolt style={{ opacity: boltOpacity, transform: [{ translateX: boltOffset * 58 }, { translateY: 8 }, { scale: 0.7 }, { scaleX: dir === 1 ? -1 : 1 }] }} />
      <HeroSprite facingRight={dir === 1} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0 },
  sprite: { width: HERO_W, height: HERO_H },
  cape: { position: 'absolute', top: HERO_H * 0.02, left: -HERO_W * 0.16, width: HERO_W * 0.5, height: HERO_H * 0.86, borderTopLeftRadius: HERO_H * 0.4, borderBottomLeftRadius: HERO_H * 0.6, transform: [{ rotate: '10deg' }] },
  torso: { position: 'absolute', top: HERO_H * 0.28, left: HERO_W * 0.32, width: HERO_W * 0.4, height: HERO_H * 0.5, borderRadius: HERO_H * 0.2 },
  emblem: { position: 'absolute', top: HERO_H * 0.42, left: HERO_W * 0.44, width: HERO_H * 0.18, height: HERO_H * 0.18, borderRadius: 3, transform: [{ rotate: '45deg' }] },
  head: { position: 'absolute', top: HERO_H * 0.08, left: HERO_W * 0.42, width: HERO_H * 0.32, height: HERO_H * 0.32, borderRadius: HERO_H * 0.16, backgroundColor: '#1A1A1A' },
  fist: { position: 'absolute', top: HERO_H * 0.36, left: HERO_W * 0.78, width: HERO_H * 0.22, height: HERO_H * 0.22, borderRadius: HERO_H * 0.11 },
  boltWrap: { position: 'absolute', top: HERO_H * 0.3, left: HERO_W * 0.1, width: 30, height: 26 },
  boltSeg1: { position: 'absolute', top: 2, left: 8, width: 22, height: 5, borderRadius: 2, backgroundColor: '#FFE066', transform: [{ rotate: '-28deg' }] },
  boltSeg2: { position: 'absolute', top: 13, left: 0, width: 22, height: 5, borderRadius: 2, backgroundColor: '#FFE066', transform: [{ rotate: '28deg' }] },
});
