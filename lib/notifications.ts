// lib/notifications.ts
// No React tree here, so the notification title goes through i18n.t() directly rather than the
// useTranslation() hook — same pattern as lib/appUpdate.ts and lib/productScore.ts.
import i18n from './i18n';

let Notifications: any = null;

// Only load notifications in real builds, not Expo Go
try {
  Notifications = require('expo-notifications');
} catch (e) {}

if (Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

// Reads the current permission WITHOUT ever opening the system dialog. Used by
// lib/pushTokens.ts on every launch and by the settings row, both of which must never prompt.
export async function hasNotificationPermission(): Promise<boolean> {
  if (!Notifications) return false;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted';
  } catch { return false; }
}

// Whether asking again can still produce a dialog. Android only offers the dialog once: after a
// denial `canAskAgain` is false and the only remaining route is system settings — which is what
// the settings row tells the user instead of showing a button that would do nothing.
export async function canAskForNotificationPermission(): Promise<boolean> {
  if (!Notifications) return false;
  try {
    const { status, canAskAgain } = await Notifications.getPermissionsAsync();
    if (status === 'granted') return false;
    return canAskAgain !== false;
  } catch { return false; }
}

// OPENS THE SYSTEM DIALOG. Only call this from a place where the user has just been told what
// the permission is for — see components/NotificationPermissionModal.
export async function requestNotificationPermission(): Promise<boolean> {
  if (!Notifications) return false;
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch { return false; }
}

// remindTime: "HH:MM" on the due date, chosen by the user (defaults to 5:00 if not given,
// e.g. for tasks created before this was configurable).
export async function scheduleTaskNotification(
  taskId: string, title: string, dueDate: string, dueTime?: string, remindTime?: string,
): Promise<string | null> {
  if (!Notifications) return null;
  try {
    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) return null;

    const [remindHour, remindMinute] = (remindTime || '05:00').split(':').map(Number);
    const due = new Date(dueDate);
    const now = new Date();
    const reminder = new Date(due);
    reminder.setHours(remindHour, remindMinute, 0, 0);

    if (reminder > now) {
      // identifier: taskId makes the notification's own ID predictable, so cancelling it later
      // (task deleted, completed, or edited away from needing a reminder) never needs a
      // separately-tracked notification ID — and scheduling again for the same task just
      // replaces the old one instead of leaving a duplicate.
      const id = await Notifications.scheduleNotificationAsync({
        identifier: taskId,
        content: {
          title: i18n.t('system.taskDueTodayTitle'),
          body: title,
          data: { taskId },
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: reminder,
        },
      });
      return id;
    }
    return null;
  } catch (e) {
    console.log('Notification skipped (Expo Go)');
    return null;
  }
}

export async function cancelTaskNotification(taskId: string) {
  if (!Notifications) return;
  try { await Notifications.cancelScheduledNotificationAsync(taskId); } catch {}
}