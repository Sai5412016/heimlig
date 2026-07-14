// app/(tabs)/_layout.tsx
import { useEffect, useRef } from 'react';
import { Tabs } from 'expo-router';
import { View, Text, Animated, Platform, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../hooks/useTheme';
import { useStore } from '../../store/useStore';
import { radius, motion } from '../../constants/theme';
import MatrixRain from '../../components/MatrixRain';
import PitchBall from '../../components/PitchBall';
import FlyingWitch from '../../components/FlyingWitch';
import RacingCar from '../../components/RacingCar';
import BulletTracers from '../../components/BulletTracers';
import FlyingHero from '../../components/FlyingHero';
import RedLightDoll from '../../components/RedLightDoll';
import PitchField from '../../components/PitchField';
import NightSky from '../../components/NightSky';
import NightTrack from '../../components/NightTrack';
import OpsBackdrop from '../../components/OpsBackdrop';
import CitySkyline from '../../components/CitySkyline';
import ArenaBackdrop from '../../components/ArenaBackdrop';

function TabIcon({ emoji, label, focused }: { emoji: string; label: string; focused: boolean }) {
  const { colors } = useTheme();
  const scale = useRef(new Animated.Value(focused ? 1 : 0.92)).current;
  const bgOpacity = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: focused ? 1 : 0.92, ...motion.spring }),
      Animated.timing(bgOpacity, { toValue: focused ? 1 : 0, duration: motion.duration.fast, useNativeDriver: true }),
    ]).start();
  }, [focused, scale, bgOpacity]);

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, paddingVertical: 2, minWidth: 56 }}>
      <Animated.View
        style={{ position: 'absolute', top: -2, width: 40, height: 24, borderRadius: radius.sm, backgroundColor: colors.brandPale, opacity: bgOpacity }}
      />
      <Animated.View style={{ transform: [{ scale }] }}>
        <Text style={{ fontSize: 20 }}>{emoji}</Text>
      </Animated.View>
      <Text style={{ fontSize: 8, color: focused ? colors.brand : colors.textMuted, marginTop: 1, fontWeight: focused ? '700' : '600' }}>{label}</Text>
    </View>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const themeId = useStore((s: { themeId: string }) => s.themeId);
  const { t } = useTranslation();

  return (
    <View style={{ flex: 1 }}>
      {/* Stable wrapping Views (always rendered, never conditionally absent) so this outer
          View's own direct child count never changes as the theme switches — the backdrop
          and sprite each vary internally, but that variability stays isolated one level
          down instead of reaching the ViewGroup that also holds <Tabs>. See the matching
          fix/comment in FlyingWitch.tsx, RedLightDoll.tsx and BulletTracers.tsx. */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {themeId === 'matrix' && <MatrixRain />}
        {themeId === 'pitch-gold' && <PitchField />}
        {themeId === 'witch-purple' && <NightSky />}
        {themeId === 'racing' && <NightTrack />}
        {themeId === 'tactical-ops' && <OpsBackdrop />}
        {themeId === 'comic-hero' && <CitySkyline />}
        {themeId === 'red-light' && <ArenaBackdrop />}
      </View>
      <Tabs
        screenOptions={{
          headerShown: false,
          // For most themes this resolves to colors.background (opaque) — for the
          // full-backdrop themes (matrix, pitch-gold, witch-purple, racing, tactical-ops,
          // comic-hero, red-light) it's transparent so their backdrop component above shows
          // through every screen instead of each one painting over it.
          sceneStyle: { backgroundColor: colors.background },
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            borderTopWidth: 1,
            height: 56 + insets.bottom,
            paddingBottom: insets.bottom,
            paddingTop: 6,
          },
          tabBarShowLabel: false,
        }}
        screenListeners={{
          tabPress: () => { if (Platform.OS !== 'web') Haptics.selectionAsync(); },
        }}
      >
        <Tabs.Screen name="index" options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="🏡" label={t('tabs.home')} focused={focused} /> }} />
        <Tabs.Screen name="shopping" options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="🛒" label={t('tabs.shopping')} focused={focused} /> }} />
        <Tabs.Screen name="scan" options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="🥗" label={t('tabs.scan')} focused={focused} /> }} />
        <Tabs.Screen name="recipes" options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="🍳" label={t('tabs.recipes')} focused={focused} /> }} />
        <Tabs.Screen name="tasks" options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="📅" label={t('tabs.tasks')} focused={focused} /> }} />
        <Tabs.Screen name="budget" options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="💶" label={t('tabs.budget')} focused={focused} /> }} />
        <Tabs.Screen name="household" options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="👥" label={t('tabs.household')} focused={focused} /> }} />
      </Tabs>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {themeId === 'pitch-gold' && <PitchBall />}
        {themeId === 'witch-purple' && <FlyingWitch />}
        {themeId === 'racing' && <RacingCar />}
        {themeId === 'tactical-ops' && <BulletTracers />}
        {themeId === 'comic-hero' && <FlyingHero />}
        {themeId === 'red-light' && <RedLightDoll />}
      </View>
    </View>
  );
}
