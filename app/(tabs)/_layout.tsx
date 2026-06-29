// app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router';
import { View, Text, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../hooks/useTheme';
import { radius, typography } from '../../constants/theme';

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
      <Tabs.Screen name="index" options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="🏡" label="Home" focused={focused} /> }} />
      <Tabs.Screen name="shopping" options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="🛒" label="Einkauf" focused={focused} /> }} />
      <Tabs.Screen name="scan" options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="🥗" label="Gesund" focused={focused} /> }} />
      <Tabs.Screen name="recipes" options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="🍳" label="Rezepte" focused={focused} /> }} />
      <Tabs.Screen name="tasks" options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="✅" label="Tasks" focused={focused} /> }} />
      <Tabs.Screen name="budget" options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="💶" label="Budget" focused={focused} /> }} />
      <Tabs.Screen name="household" options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="👥" label="Haushalt" focused={focused} /> }} />
    </Tabs>
  );
}
