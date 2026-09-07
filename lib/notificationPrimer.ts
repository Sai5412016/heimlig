// lib/notificationPrimer.ts — remembers that this device has already been shown the explanation
// for notification permissions (components/NotificationPermissionModal).
//
// PER DEVICE, not per household — deliberately different from lib/soloBanner.ts. A notification
// permission is granted to the app by the operating system, once, for all households on that
// phone. Asking again in a second household would re-open a question the OS has already
// answered, and on Android a second denial cannot be undone in-app at all.
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@heimlig/notificationPrimerSeen';

export async function isNotificationPrimerSeen(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) === '1';
  } catch {
    // Storage unavailable — treat it as "already seen" so a broken read can never turn the
    // explainer into something that reappears on every save.
    return true;
  }
}

export async function markNotificationPrimerSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, '1');
  } catch { /* best-effort: worst case it shows once more on the next launch */ }
}
