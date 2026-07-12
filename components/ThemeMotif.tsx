// components/ThemeMotif.tsx — small per-theme motif shown next to the header title on every
// main screen (e.g. a race car for "Rennsport Rot", a capture ball for "Taschenmonster").
// Built from plain Views/shapes (no image assets, no external icon set) so it works for every
// theme without needing a matching illustration. Falls back to the theme's emoji for anything
// that doesn't have a bespoke shape yet.
import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { useStore } from '../store/useStore';
import { APP_THEMES } from '../constants/theme';

export default function ThemeMotif({ size = 26 }: { size?: number }) {
  const themeId = useStore((s: { themeId: string }) => s.themeId);
  const theme = APP_THEMES.find(t => t.id === themeId);
  if (!theme || theme.id === 'standard') return null;

  const box = { width: size, height: size };

  switch (theme.id) {
    case 'racing':
      return (
        <View style={[styles.wrap, box]}>
          <View style={[styles.absFill, { backgroundColor: theme.brand, borderRadius: size / 2 }]} />
          <View style={[styles.carCabin, { backgroundColor: '#1A1A1A', bottom: size * 0.42, left: size * 0.22, right: size * 0.22, height: size * 0.16 }]} />
          <View style={[styles.abs, { backgroundColor: '#1A1A1A', bottom: size * 0.24, left: size * 0.1, right: size * 0.1, height: size * 0.18, borderRadius: size * 0.09 }]} />
          <View style={[styles.wheel, { backgroundColor: theme.accent, bottom: size * 0.16, left: size * 0.14 }]} />
          <View style={[styles.wheel, { backgroundColor: theme.accent, bottom: size * 0.16, right: size * 0.14 }]} />
        </View>
      );
    case 'monster-fang':
      return (
        <View style={[styles.wrap, box, { borderRadius: size / 2, overflow: 'hidden', backgroundColor: '#fff' }]}>
          <View style={[styles.abs, { top: 0, left: 0, right: 0, height: size * 0.42, backgroundColor: theme.brand }]} />
          <View style={[styles.abs, { top: size * 0.4, left: 0, right: 0, height: size * 0.12, backgroundColor: '#1A1A1A' }]} />
          <View style={[styles.abs, {
            top: size * 0.32, left: size * 0.32, width: size * 0.36, height: size * 0.36, borderRadius: size * 0.18,
            backgroundColor: theme.accent, borderWidth: 2, borderColor: '#1A1A1A',
          }]} />
        </View>
      );
    case 'witch-purple':
      // Small flying-witch-on-a-broomstick silhouette (generic, plain shapes) — the animated
      // full-size version swoops across the screen in components/FlyingWitch.tsx.
      return (
        <View style={[styles.wrap, box, { transform: [{ rotate: '-14deg' }] }]}>
          <View style={[styles.abs, { bottom: size * 0.3, left: 0, width: size * 0.56, height: size * 0.09, backgroundColor: '#5C3A21', borderRadius: size * 0.05 }]} />
          <View style={[styles.abs, { bottom: size * 0.24, left: -size * 0.06, width: size * 0.2, height: size * 0.22, backgroundColor: '#8A5A2B', borderTopLeftRadius: size * 0.14, borderBottomLeftRadius: size * 0.14 }]} />
          <View style={[styles.abs, { bottom: size * 0.28, left: size * 0.4, width: size * 0.3, height: size * 0.34, backgroundColor: theme.brand, borderRadius: size * 0.13 }]} />
          <View style={[styles.abs, {
            bottom: size * 0.58, left: size * 0.44, width: 0, height: 0,
            borderLeftWidth: size * 0.11, borderRightWidth: size * 0.11, borderBottomWidth: size * 0.3,
            borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: theme.brandDark,
          }]} />
          <View style={[styles.abs, { bottom: size * 0.62, left: size * 0.4, width: size * 0.22, height: size * 0.06, backgroundColor: theme.accent, borderRadius: 2 }]} />
        </View>
      );
    case 'pitch-gold':
      // Generic mid-kick star striker (not a specific character) — kicking leg reaching
      // toward the ball, same "plain shapes" treatment as every other motif here.
      return (
        <View style={[styles.wrap, box]}>
          <View style={[styles.abs, {
            bottom: size * 0.18, left: size * 0.02, width: size * 0.62, height: size * 0.16,
            backgroundColor: theme.brand, borderRadius: size * 0.08, transform: [{ rotate: '-40deg' }],
          }]} />
          <View style={[styles.abs, {
            bottom: size * 0.14, left: size * 0.34, width: size * 0.16, height: size * 0.46,
            backgroundColor: theme.brandDark, borderRadius: size * 0.08, transform: [{ rotate: '18deg' }],
          }]} />
          <View style={[styles.abs, { top: size * 0.06, left: size * 0.5, width: size * 0.26, height: size * 0.26, borderRadius: size * 0.13, backgroundColor: theme.brandDark }]} />
          <View style={[styles.abs, { top: size * 0.02, left: size * 0.02, width: size * 0.2, height: size * 0.2, borderRadius: size * 0.1, backgroundColor: theme.accent, borderWidth: 1, borderColor: '#1A1A1A' }]} />
        </View>
      );
    case 'battle-royale':
      return (
        <View style={[styles.wrap, box, { borderRadius: size / 2, backgroundColor: theme.brand }]}>
          <View style={[styles.abs, { top: size * 0.34, left: size * 0.14, right: size * 0.14, height: size * 0.32, backgroundColor: '#1A1A1A', borderRadius: size * 0.16 }]} />
          <View style={[styles.dot, { backgroundColor: theme.accent, top: size * 0.44, left: size * 0.24 }]} />
          <View style={[styles.dot, { backgroundColor: theme.accent, top: size * 0.44, left: size * 0.36 }]} />
          <View style={[styles.dot, { backgroundColor: theme.accent, top: size * 0.44, right: size * 0.24 }]} />
          <View style={[styles.dot, { backgroundColor: theme.accent, top: size * 0.44, right: size * 0.36 }]} />
        </View>
      );
    case 'gothic':
      return (
        <View style={[styles.wrap, box]}>
          <View style={[styles.abs, {
            top: size * 0.32, left: size * 0.5 - size * 0.02, width: size * 0.04, height: size * 0.24, backgroundColor: '#1A1A1A',
          }]} />
          <View style={[styles.abs, {
            top: size * 0.24, left: size * 0.08, width: size * 0.38, height: size * 0.3, backgroundColor: theme.brand,
            borderTopLeftRadius: size * 0.19, borderBottomRightRadius: size * 0.19,
          }]} />
          <View style={[styles.abs, {
            top: size * 0.24, right: size * 0.08, width: size * 0.38, height: size * 0.3, backgroundColor: theme.brand,
            borderTopRightRadius: size * 0.19, borderBottomLeftRadius: size * 0.19,
          }]} />
        </View>
      );
    case 'cinema':
      return (
        <View style={[styles.wrap, box]}>
          <View style={[styles.abs, { top: size * 0.34, left: size * 0.1, right: size * 0.1, bottom: size * 0.12, backgroundColor: '#1A1A1A', borderRadius: size * 0.05 }]} />
          <View style={[styles.abs, { top: size * 0.12, left: size * 0.06, right: size * 0.06, height: size * 0.22, backgroundColor: theme.brand, borderRadius: size * 0.04, transform: [{ rotate: '-6deg' }] }]} />
          <View style={[styles.dot, { backgroundColor: theme.accent, top: size * 0.18, left: size * 0.16, width: size * 0.08, height: size * 0.08 }]} />
        </View>
      );
    case 'sparkle-pop':
      return (
        <View style={[styles.wrap, box]}>
          <View style={[styles.abs, { top: size * 0.5 - size * 0.34, left: size * 0.5 - size * 0.1, width: size * 0.2, height: size * 0.68, backgroundColor: theme.brand, borderRadius: size * 0.1, transform: [{ rotate: '45deg' }] }]} />
          <View style={[styles.abs, { top: size * 0.5 - size * 0.34, left: size * 0.5 - size * 0.1, width: size * 0.2, height: size * 0.68, backgroundColor: theme.brand, borderRadius: size * 0.1, transform: [{ rotate: '-45deg' }] }]} />
          <View style={[styles.dot, { backgroundColor: theme.accent, top: size * 0.14, right: size * 0.1, width: size * 0.14, height: size * 0.14 }]} />
        </View>
      );
    case 'moody':
      return (
        <View style={[styles.wrap, box]}>
          <View style={[styles.abs, { top: size * 0.36, left: size * 0.06, width: size * 0.36, height: size * 0.26, backgroundColor: '#1A1A1A', borderRadius: size * 0.1 }]} />
          <View style={[styles.abs, { top: size * 0.36, right: size * 0.06, width: size * 0.36, height: size * 0.26, backgroundColor: '#1A1A1A', borderRadius: size * 0.1 }]} />
          <View style={[styles.abs, { top: size * 0.46, left: size * 0.42, width: size * 0.16, height: size * 0.05, backgroundColor: '#1A1A1A' }]} />
        </View>
      );
    case 'comic-hero':
      return (
        <View style={[styles.wrap, box, { borderRadius: size / 2, backgroundColor: theme.brand }]}>
          <View style={[styles.abs, {
            top: size * 0.22, left: size * 0.5 - size * 0.16, width: size * 0.32, height: size * 0.32,
            backgroundColor: theme.accent, transform: [{ rotate: '45deg' }],
          }]} />
        </View>
      );
    case 'waldgeist':
      return (
        <View style={[styles.wrap, box]}>
          <View style={[styles.abs, { bottom: 0, left: size * 0.1, right: size * 0.1, height: size * 0.72, backgroundColor: theme.brand, borderRadius: size * 0.36 }]} />
          <View style={[styles.abs, {
            top: 0, left: size * 0.42, width: size * 0.24, height: size * 0.3, backgroundColor: theme.brandDark,
            borderTopRightRadius: size * 0.24, borderBottomLeftRadius: size * 0.24, transform: [{ rotate: '-15deg' }],
          }]} />
        </View>
      );
    case 'matrix':
      return (
        <View style={[styles.wrap, box, { borderRadius: size * 0.22, backgroundColor: '#070A08', borderWidth: 1, borderColor: theme.brand, overflow: 'hidden' }]}>
          <View style={[styles.abs, {
            top: size * 0.3, left: size * 0.16, width: size * 0.24, height: size * 0.24,
            borderLeftWidth: size * 0.07, borderBottomWidth: size * 0.07, borderColor: theme.brand,
            transform: [{ rotate: '-45deg' }],
          }]} />
          <View style={[styles.abs, { top: size * 0.42, left: size * 0.52, width: size * 0.28, height: size * 0.11, backgroundColor: theme.brand }]} />
        </View>
      );
    case 'inselfreunde':
      return (
        <View style={[styles.wrap, box]}>
          <View style={[styles.abs, { top: 0, left: size * 0.22, right: size * 0.22, height: size * 0.34, backgroundColor: theme.brandDark, borderRadius: size * 0.06 }]} />
          <View style={[styles.abs, { top: size * 0.28, left: size * 0.14, right: size * 0.14, bottom: 0, backgroundColor: theme.brandLight, borderRadius: size * 0.18 }]} />
        </View>
      );
    default:
      return (
        <View style={[styles.wrap, box, { borderRadius: size / 2, backgroundColor: theme.brand, alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={{ fontSize: size * 0.55 }}>{theme.emoji}</Text>
        </View>
      );
  }
}

const styles = StyleSheet.create({
  wrap: { position: 'relative', overflow: 'visible' },
  abs: { position: 'absolute' },
  absFill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  carCabin: { position: 'absolute', borderTopLeftRadius: 6, borderTopRightRadius: 6 },
  wheel: { position: 'absolute', width: '18%', height: '18%', borderRadius: 100 },
  dot: { position: 'absolute', width: '10%', height: '10%', borderRadius: 100 },
});
