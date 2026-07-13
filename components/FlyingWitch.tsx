// components/FlyingWitch.tsx — a generic witch-on-a-broomstick that swoops across the screen
// for the "witch-purple" theme. Same sparse-crossing pattern as PitchBall (this theme keeps
// the normal light/dark background, so the sprite flies over content, not behind it) — but
// built from plain shapes (hat/robe/broom), not any specific character's likeness, same rule
// every other theme motif in this app already follows.
import React, { useEffect, useRef, useState } from 'react';
import { View, Animated, Easing, StyleSheet, useWindowDimensions, AccessibilityInfo } from 'react-native';
import { APP_THEMES } from '../constants/theme';

const SPRITE_W = 62;
const SPRITE_H = 40;
const theme = APP_THEMES.find(t => t.id === 'witch-purple')!;

function WitchSprite({ facingRight }: { facingRight: boolean }) {
  return (
    <View style={[styles.sprite, { transform: [{ scaleX: facingRight ? 1 : -1 }, { rotate: '-16deg' }] }]}>
      <View style={styles.bristles} />
      <View style={styles.broomstick} />
      <View style={[styles.robe, { backgroundColor: theme.brand }]} />
      <View style={[styles.hat, { borderBottomColor: theme.brandDark }]} />
      <View style={[styles.hatBand, { backgroundColor: theme.accent }]} />
    </View>
  );
}

export default function FlyingWitch() {
  const { width, height } = useWindowDimensions();
  const progress = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(false);
  const [flight, setFlight] = useState<{ y: number; dir: 1 | -1 }>({ y: height * 0.2, dir: 1 });

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
      setFlight({ y: height * (0.1 + Math.random() * 0.5), dir: Math.random() > 0.5 ? 1 : -1 });
      progress.setValue(0);
      Animated.timing(progress, {
        toValue: 1,
        duration: 6000 + Math.random() * 4000,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished && !cancelled) timer = setTimeout(fly, 12000 + Math.random() * 28000);
      });
    };
    timer = setTimeout(fly, 4000 + Math.random() * 6000);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [height, reduceMotion, progress]);

  if (reduceMotion) return null;

  const { y, dir } = flight;
  const startX = dir === 1 ? -SPRITE_W : width + SPRITE_W;
  const endX = dir === 1 ? width + SPRITE_W : -SPRITE_W;

  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [startX, endX] });
  // Gentle undulating swoop instead of a single arc, feels more like flying than falling.
  const translateY = progress.interpolate({
    inputRange: [0, 0.2, 0.45, 0.7, 1],
    outputRange: [y, y - 34, y + 18, y - 26, y],
  });
  const sparkleOpacity = progress.interpolate({ inputRange: [0, 0.1, 0.9, 1], outputRange: [0, 1, 1, 0] });

  // Single wrapping View so this component always contributes exactly one child to its
  // parent (app/(tabs)/_layout.tsx) — a Fragment with several root siblings here previously
  // caused an Android "getChildDrawingOrder() returned invalid index" crash (child count
  // desync when a sibling's own child count changes at the wrong moment).
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View pointerEvents="none" style={[styles.wrap, { transform: [{ translateX }, { translateY }] }]}>
        <WitchSprite facingRight={dir === 1} />
      </Animated.View>
      <Animated.View
        pointerEvents="none"
        style={[styles.sparkle, { opacity: sparkleOpacity, transform: [
          { translateX: Animated.add(translateX, dir === 1 ? -16 : 16) },
          { translateY: Animated.add(translateY, 14) },
        ] }]}
      />
      <Animated.View
        pointerEvents="none"
        style={[styles.sparkle, styles.sparkleSmall, { opacity: sparkleOpacity, transform: [
          { translateX: Animated.add(translateX, dir === 1 ? -30 : 30) },
          { translateY: Animated.add(translateY, 4) },
        ] }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, left: 0 },
  sprite: { width: SPRITE_W, height: SPRITE_H },
  broomstick: { position: 'absolute', left: 0, top: SPRITE_H * 0.58, width: SPRITE_W * 0.6, height: SPRITE_H * 0.1, backgroundColor: '#5C3A21', borderRadius: SPRITE_H * 0.05 },
  bristles: {
    position: 'absolute', left: -SPRITE_W * 0.06, top: SPRITE_H * 0.36, width: SPRITE_W * 0.22, height: SPRITE_H * 0.5,
    backgroundColor: '#8A5A2B', borderTopLeftRadius: SPRITE_H * 0.3, borderBottomLeftRadius: SPRITE_H * 0.3,
    transform: [{ rotate: '10deg' }],
  },
  robe: { position: 'absolute', left: SPRITE_W * 0.4, top: SPRITE_H * 0.08, width: SPRITE_W * 0.32, height: SPRITE_H * 0.6, borderRadius: SPRITE_W * 0.14 },
  hat: {
    position: 'absolute', left: SPRITE_W * 0.48, top: -SPRITE_H * 0.24, width: 0, height: 0,
    borderLeftWidth: SPRITE_W * 0.12, borderRightWidth: SPRITE_W * 0.12, borderBottomWidth: SPRITE_H * 0.34,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
  },
  hatBand: { position: 'absolute', left: SPRITE_W * 0.44, top: SPRITE_H * 0.06, width: SPRITE_W * 0.24, height: SPRITE_H * 0.06, borderRadius: 2 },
  sparkle: { position: 'absolute', top: 0, left: 0, width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFE68A' },
  sparkleSmall: { width: 4, height: 4, borderRadius: 2 },
});
