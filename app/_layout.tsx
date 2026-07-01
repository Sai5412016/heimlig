// app/_layout.tsx
import { useEffect, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { Platform, Dimensions } from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';
import { checkForUpdate } from '../lib/appUpdate';
import WhatsNewModal from '../components/WhatsNewModal';

// Pull a join code out of an incoming deep link, e.g. heimlig://join/AB12CD34
// Bounded length: input hygiene against malformed/oversized deep links (the code itself
// only ever reaches a parameterized RPC lookup, so this isn't an open-redirect concern).
function extractJoinCode(url: string | null): string | null {
  if (!url) return null;
  const m = url.match(/join\/([A-Za-z0-9]{4,12})/);
  return m ? m[1] : null;
}

export default function RootLayout() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const { setUserId, loadMyHouseholds, activateHousehold, setDarkMode } = useStore();

  // Lock phones to portrait, but let large screens (tablets/foldables) rotate freely.
  // The static manifest restriction is removed (orientation: default) so Play stops
  // warning about large-screen support; we enforce portrait only on small devices here.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const { width, height } = Dimensions.get('window');
    const smallestSide = Math.min(width, height);
    if (smallestSide < 600) {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    }
  }, []);

  useEffect(() => {
    // Small delay to let router initialize
    const timer = setTimeout(async () => {
      // The password-reset link lands here with recovery tokens still unconsumed in the
      // URL (detectSessionInUrl is off). Let app/reset-password.tsx own that flow instead
      // of racing it with the normal "no session -> /onboarding" redirect below.
      if (Platform.OS === 'web') {
        // @ts-ignore - window only exists on web
        const { pathname, hash } = window.location;
        if (pathname.startsWith('/reset-password') || hash.includes('type=recovery')) {
          setReady(true);
          return;
        }
      }
      const initialUrl = await Linking.getInitialURL();
      checkSession(extractJoinCode(initialUrl));
    }, 500);

    // Handle deep links while the app is already running
    const sub = Linking.addEventListener('url', ({ url }) => {
      const code = extractJoinCode(url);
      if (code) router.push(`/join/${code}`);
    });

    // Notify about a newer version a moment after launch (non-blocking)
    const updTimer = setTimeout(() => { checkForUpdate(); }, 2500);

    return () => { clearTimeout(timer); clearTimeout(updTimer); sub.remove(); };
  }, []);

  const checkSession = async (pendingJoinCode?: string | null) => {
    try {
      // Load persisted theme preference before rendering
      const dm = await AsyncStorage.getItem('@heimlig/darkMode');
      if (dm === '1') setDarkMode(true);

      // getUser() re-verifies against the Auth server instead of trusting local storage,
      // so a revoked/expired session doesn't leave the app thinking it's still logged in.
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setReady(true);
        router.replace('/onboarding');
        return;
      }

      const userId = user.id;
      setUserId(userId);

      const memberships = await loadMyHouseholds();

      if (!memberships || memberships.length === 0) {
        setReady(true);
        if (pendingJoinCode) router.replace(`/join/${pendingJoinCode}`);
        else router.replace('/onboarding');
        return;
      }

      // Prefer the household with the most members (the shared one) over an
      // accidental solo household, so users always land in the "real" home.
      const householdIds = memberships.map((m: any) => m.household_id);
      const { data: allMems } = await supabase.from('members').select('household_id').in('household_id', householdIds);
      const counts: Record<string, number> = {};
      (allMems || []).forEach((r: any) => { counts[r.household_id] = (counts[r.household_id] || 0) + 1; });
      memberships.sort((a: any, b: any) => (counts[b.household_id] || 0) - (counts[a.household_id] || 0));

      const chosen: any = memberships[0];
      const member = { ...chosen }; delete member.households;
      await activateHousehold(chosen.households, member);

      setReady(true);
      if (pendingJoinCode) router.replace(`/join/${pendingJoinCode}`);
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
        <Stack.Screen name="join/[code]" />
        <Stack.Screen name="reset-password" />
      </Stack>
      <WhatsNewModal />
    </GestureHandlerRootView>
  );
}
