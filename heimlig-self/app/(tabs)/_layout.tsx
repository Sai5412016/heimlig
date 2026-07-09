// app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router';
import { View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../hooks/useTheme';
import { useT } from '../../lib/i18n';
import { radius } from '../../constants/theme';

function TabIcon({ emoji, label, focused }: { emoji: string; label: string; focused: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.sm, minWidth: 56, backgroundColor: focused ? colors.brandPale : 'transparent' }}>
      <Text style={{ fontSize: 20 }}>{emoji}</Text>
      <Text style={{ fontSize: 8, color: focused ? colors.brand : colors.textMuted, marginTop: 1, fontWeight: focused ? '700' : '600' }}>{label}</Text>
    </View>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const t = useT();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
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
    >
      <Tabs.Screen name="index" options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="🏡" label={t('tabs.dashboard')} focused={focused} /> }} />
      <Tabs.Screen name="energy" options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="⚡" label={t('tabs.energy')} focused={focused} /> }} />
      <Tabs.Screen name="mind" options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="🧠" label={t('tabs.mind')} focused={focused} /> }} />
      <Tabs.Screen name="coach" options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="✨" label={t('tabs.coach')} focused={focused} /> }} />
      <Tabs.Screen name="profile" options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="👤" label={t('tabs.profile')} focused={focused} /> }} />
    </Tabs>
  );
}
