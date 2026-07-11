// components/Skeleton.tsx — a placeholder block that pulses while real content loads, so
// screens show a shape of what's coming instead of a blank gap or a spinner.
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, type DimensionValue } from 'react-native';
import { radius } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';

export function Skeleton({ width = '100%', height = 16, style, radius: r }: {
  width?: DimensionValue; height?: number; style?: object; radius?: number;
}) {
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        { width, height, borderRadius: r ?? radius.sm, backgroundColor: colors.border, opacity },
        style,
      ]}
    />
  );
}

// A ready-made "list item card" shape — avatar/icon circle + two text lines — matching the
// most common row pattern across shopping/tasks/recipes/budget lists.
export function SkeletonListRow() {
  const { colors } = useTheme();
  return (
    <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Skeleton width={36} height={36} radius={radius.full} />
      <View style={{ flex: 1, gap: 8 }}>
        <Skeleton width="70%" height={14} />
        <Skeleton width="40%" height={12} />
      </View>
    </View>
  );
}

export function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <View>
      {Array.from({ length: rows }).map((_, i) => <SkeletonListRow key={i} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: radius.lg, borderWidth: 1, marginBottom: 10,
  },
});
