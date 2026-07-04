// lib/pushTokens.ts — register this device's Expo push token so other household members
// can be notified (e.g. new pinboard message) even when the app is closed.
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from './supabase';
import { requestNotificationPermission } from './notifications';

let Notifications: any = null;
try { Notifications = require('expo-notifications'); } catch { /* Expo Go / web */ }

// Temporary diagnostic trail: registration failures happen on real devices we have no
// other visibility into, so each failure stage gets a short row here instead of just
// vanishing into a silently-caught error.
async function logPushDebug(memberId: string, householdId: string, stage: string, message?: string) {
  try {
    await supabase.from('push_debug').insert({
      member_id: memberId, household_id: householdId, stage,
      message: message ? String(message).slice(0, 500) : null,
    });
  } catch { /* best-effort — never let the debug log itself break anything */ }
}

// Register (or refresh) this device's push token for the given member. Silently no-ops
// on web and inside Expo Go, where remote push tokens aren't available.
export async function registerPushToken(memberId: string, householdId: string) {
  if (Platform.OS === 'web') return;
  if (!Notifications) { logPushDebug(memberId, householdId, 'no_notifications_module'); return; }

  try {
    const granted = await requestNotificationPermission();
    if (!granted) { logPushDebug(memberId, householdId, 'permission_denied'); return; }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    let tokenData;
    try {
      tokenData = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    } catch (e: any) {
      logPushDebug(memberId, householdId, 'token_fetch_error', e?.message || String(e));
      return;
    }
    if (!tokenData?.data) { logPushDebug(memberId, householdId, 'empty_token'); return; }

    const { error } = await supabase.from('push_tokens').upsert(
      { member_id: memberId, household_id: householdId, token: tokenData.data, platform: Platform.OS, updated_at: new Date().toISOString() },
      { onConflict: 'member_id' }
    );
    if (error) logPushDebug(memberId, householdId, 'upsert_error', error.message);
  } catch (e: any) {
    logPushDebug(memberId, householdId, 'unexpected_error', e?.message || String(e));
  }
}
