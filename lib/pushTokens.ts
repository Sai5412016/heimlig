// lib/pushTokens.ts — register this device's Expo push token so other household members
// can be notified (e.g. new pinboard message) even when the app is closed.
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from './supabase';
import { hasNotificationPermission } from './notifications';

let Notifications: any = null;
try { Notifications = require('expo-notifications'); } catch { /* Expo Go / web */ }

// Temporary diagnostic trail: registration failures happen on real devices we have no
// other visibility into, so each failure stage gets a short row here instead of just
// vanishing into a silently-caught error.
//
// push_debug.stage has no check constraint (verified against production), so new stages can be
// added here without a migration — unlike paywall_events.source, which silently rejected every
// new value until its constraint was widened.
async function logPushDebug(memberId: string, householdId: string, stage: string, message?: string) {
  try {
    const { error } = await supabase.from('push_debug').insert({
      member_id: memberId, household_id: householdId, stage,
      message: message ? String(message).slice(0, 500) : null,
    });
    // supabase-js returns { error } instead of throwing, so a bare try/catch would catch nothing.
    if (error) console.warn(`[push] debug row '${stage}' was not written —`, error.code, error.message);
  } catch (e: any) {
    console.warn(`[push] debug row '${stage}' threw before reaching the server —`, e?.message ?? e);
  }
}

// Records that notify-message could not even be reached or answered with an error. Lives here
// rather than in the store so every push_debug write goes through the same checked insert.
export async function logNotifyInvokeError(
  householdId: string, memberId: string | undefined, message: string,
): Promise<void> {
  if (!memberId) return; // the RLS policy requires our own member id; without it the row is refused
  console.warn('[push] notify-message failed —', message);
  await logPushDebug(memberId, householdId, 'notify_invoke_error', message);
}

// Register (or refresh) this device's push token for the given member. Silently no-ops
// on web and inside Expo Go, where remote push tokens aren't available.
//
// IMPORTANT — this NEVER opens the system permission dialog any more.
//
// It used to call requestNotificationPermission(), and since the only caller is
// activateHousehold() in store/useStore.ts, the Android dialog popped up in the middle of the
// launch sequence with no explanation of what it was for. 7 members across 6 households denied
// it, and on Android a denial is effectively permanent — it can only be undone in system
// settings. Asking is now a separate, explained step (components/NotificationPermissionModal),
// and this function only picks up a permission that has ALREADY been granted.
export async function registerPushToken(memberId: string, householdId: string) {
  if (Platform.OS === 'web') return;
  if (!Notifications) { logPushDebug(memberId, householdId, 'no_notifications_module'); return; }

  try {
    const granted = await hasNotificationPermission();
    // Not an error and not worth a row on every single launch: it just means we haven't asked
    // yet, or the user said no. The explainer handles both.
    if (!granted) return;

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
