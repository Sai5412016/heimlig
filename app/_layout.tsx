// app/_layout.tsx
import { useEffect, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { Platform, Dimensions } from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';

// Pull a join code out of an incoming deep link, e.g. heimlig://join/AB12CD34
function extractJoinCode(url: string | null): string | null {
  if (!url) return null;
  const m = url.match(/join\/([A-Za-z0-9]+)/);
  return m ? m[1] : null;
}

export default function RootLayout() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const { setUserId, setHousehold, setCurrentMember, setMembers, setShoppingLists, setActiveListId, setItems } = useStore();

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
      const initialUrl = await Linking.getInitialURL();
      checkSession(extractJoinCode(initialUrl));
    }, 500);

    // Handle deep links while the app is already running
    const sub = Linking.addEventListener('url', ({ url }) => {
      const code = extractJoinCode(url);
      if (code) router.push(`/join/${code}`);
    });

    return () => { clearTimeout(timer); sub.remove(); };
  }, []);

  const checkSession = async (pendingJoinCode?: string | null) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user) {
        setReady(true);
        router.replace('/onboarding');
        return;
      }

      const userId = session.user.id;
      setUserId(userId);

      const { data: memberRows } = await supabase
        .from('members')
        .select('*, households(*)')
        .eq('user_id', userId)
        .limit(1);

      if (!memberRows || memberRows.length === 0) {
        setReady(true);
        if (pendingJoinCode) router.replace(`/join/${pendingJoinCode}`);
        else router.replace('/onboarding');
        return;
      }

      const myMember = memberRows[0];
      const household = myMember.households;
      setHousehold(household);
      setCurrentMember(myMember);

      const { data: allMembers } = await supabase
        .from('members').select('*').eq('household_id', household.id);
      if (allMembers) setMembers(allMembers);

      let { data: lists } = await supabase
        .from('shopping_lists').select('*').eq('household_id', household.id);

      if (!lists || lists.length === 0) {
        const { data: newList } = await supabase
          .from('shopping_lists')
          .insert({ household_id: household.id, name: 'Einkaufsliste', emoji: '🛒', created_by: myMember.id })
          .select().single();
        if (newList) lists = [newList];
      }

      if (lists && lists.length > 0) {
        setShoppingLists(lists);
        setActiveListId(lists[0].id);
        const { data: items } = await supabase
          .from('shopping_items').select('*').eq('list_id', lists[0].id);
        if (items) setItems(items);
      }

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
      </Stack>
    </GestureHandlerRootView>
  );
}
