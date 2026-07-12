// components/MatrixRain.tsx — animated code-rain background for the "matrix" theme.
// Pure React Native Animated (no canvas/skia dependency): each column is one Animated.View
// looping translateY on the native thread (useNativeDriver: true), so the fall itself never
// touches the JS thread — scrolling lists on top stay smooth. Only the glyph strings inside a
// column are re-rolled once per fall cycle (every few seconds), not per frame.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Animated, Easing, StyleSheet, Platform, useWindowDimensions, AccessibilityInfo } from 'react-native';

const CHARS = 'アカサタナハマヤラワガザダバパイキシチニヒミリギジヂビピウクスツヌフムユルグズブヅプエケセテネヘメレゲゼデベペオコソトノホモヨロヲゴゾドボポヴン0123456789'.split('');
const randChar = () => CHARS[Math.floor(Math.random() * CHARS.length)];

const TRAIL_LENGTH = 9;
const GLYPH_SIZE = 15;
const GLYPH_GAP = 20;
const TRAIL_HEIGHT = TRAIL_LENGTH * GLYPH_GAP;
const COLUMN_SPACING = 26;
const OPACITIES = Array.from({ length: TRAIL_LENGTH }, (_, i) => Math.min(1, (i + 1) / TRAIL_LENGTH));
const GLYPH_FONT = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

function RainColumn({ x, height, reduceMotion }: { x: number; height: number; reduceMotion: boolean }) {
  const translateY = useRef(new Animated.Value(-TRAIL_HEIGHT)).current;
  const [chars, setChars] = useState<string[]>(() => Array.from({ length: TRAIL_LENGTH }, randChar));

  useEffect(() => {
    if (reduceMotion) {
      translateY.setValue(Math.random() * height);
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const fall = () => {
      if (cancelled) return;
      translateY.setValue(-TRAIL_HEIGHT);
      Animated.timing(translateY, {
        toValue: height + TRAIL_HEIGHT,
        duration: 4000 + Math.random() * 4000,
        easing: Easing.linear,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished && !cancelled) {
          setChars(Array.from({ length: TRAIL_LENGTH }, randChar));
          fall();
        }
      });
    };
    timer = setTimeout(fall, Math.random() * 5000);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [height, reduceMotion, translateY]);

  return (
    <Animated.View style={[styles.column, { left: x, transform: [{ translateY }] }]}>
      {chars.map((c, i) => (
        <Text
          key={i}
          style={[
            styles.glyph,
            { color: i === TRAIL_LENGTH - 1 ? '#E7FFEF' : '#39FF6E', opacity: OPACITIES[i] },
          ]}
        >
          {c}
        </Text>
      ))}
    </Animated.View>
  );
}
const MemoRainColumn = React.memo(RainColumn);

export default function MatrixRain() {
  const { width, height } = useWindowDimensions();
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then(v => { if (mounted) setReduceMotion(v); }).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v: boolean) => setReduceMotion(v));
    return () => { mounted = false; sub.remove(); };
  }, []);

  const columnXs = useMemo(() => {
    const count = Math.ceil(width / COLUMN_SPACING) + 1;
    return Array.from({ length: count }, (_, i) => i * COLUMN_SPACING);
  }, [width]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#070A08' }]} />
      {columnXs.map((x, i) => (
        <MemoRainColumn key={i} x={x} height={height} reduceMotion={reduceMotion} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  column: { position: 'absolute', top: 0 },
  glyph: { fontFamily: GLYPH_FONT, fontSize: GLYPH_SIZE, lineHeight: GLYPH_GAP, height: GLYPH_GAP },
});
