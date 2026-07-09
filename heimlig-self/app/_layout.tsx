// app/_layout.tsx
import { useEffect, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';
import { useTheme } from '../hooks/useTheme';
import type { Language } from '../lib/i18n';

export default function RootLayout() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const { colors } = useTheme();
  const { setUserId, setDarkMode, setLanguage, loadProfile } = useStore();

  useEffect(() => {
    const timer = setTimeout(() => { checkSession(); }, 300);
    return () => clearTimeout(timer);
  }, []);

  const checkSession = async () => {
    try {
      // Locally persisted prefs render instantly; a loaded profile (once logged in)
      // then overrides them with the server-side value.
      const dm = await AsyncStorage.getItem('@heimligself/darkMode');
      if (dm !== null) setDarkMode(dm === '1');
      const savedLang = await AsyncStorage.getItem('@heimligself/language');
      if (savedLang) setLanguage(savedLang as Language);
      else {
        const deviceLang = Localization.getLocales()[0]?.languageCode;
        setLanguage(deviceLang === 'en' ? 'en' : 'de');
      }

      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setReady(true);
        router.replace('/onboarding');
        return;
      }

      setUserId(user.id);
      const profile = await loadProfile(user.id);

      setReady(true);
      if (!profile) router.replace('/onboarding');
      else router.replace('/(tabs)');
    } catch (e) {
      console.error(e);
      setReady(true);
      router.replace('/onboarding');
    }
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="reset-password" />
        <Stack.Screen name="impressum" />
        <Stack.Screen name="datenschutz" />
        <Stack.Screen name="module/[key]" />
      </Stack>
      {!ready && (
        <View
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}
        >
          <ActivityIndicator size="large" color={colors.brand} />
        </View>
      )}
    </GestureHandlerRootView>
  );
}
