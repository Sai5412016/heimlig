// app/_layout.tsx
import { useEffect, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';

export default function RootLayout() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const { setUserId, setHousehold, setCurrentMember, setMembers, setShoppingLists, setActiveListId, setItems } = useStore();

  useEffect(() => {
    // Small delay to let router initialize
    const timer = setTimeout(() => checkSession(), 500);
    return () => clearTimeout(timer);
  }, []);

  const checkSession = async () => {
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
        router.replace('/onboarding');
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
      router.replace('/(tabs)');
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
      </Stack>
    </GestureHandlerRootView>
  );
}
