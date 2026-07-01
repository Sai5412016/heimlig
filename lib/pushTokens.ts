// lib/pushTokens.ts — register this device's Expo push token so other household members
// can be notified (e.g. new pinboard message) even when the app is closed.
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from './supabase';
import { requestNotificationPermission } from './notifications';

let Notifications: any = null;
try { Notifications = require('expo-notifications'); } catch { /* Expo Go / web */ }

// Register (or refresh) this device's push token for the given member. Silently no-ops
// on web and inside Expo Go, where remote push tokens aren't available.
export async function registerPushToken(memberId: string, householdId: string) {
  if (!Notifications || Platform.OS === 'web') return;
  try {
    const granted = await requestNotificationPermission();
    if (!granted) return;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const { data } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    if (!data?.data) return;

    await supabase.from('push_tokens').upsert(
      { member_id: memberId, household_id: householdId, token: data.data, platform: Platform.OS, updated_at: new Date().toISOString() },
      { onConflict: 'member_id' }
    );
  } catch { /* best-effort — a missing push token just means no notifications */ }
}
