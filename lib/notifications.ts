// lib/notifications.ts
import { Platform } from 'react-native';

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

export async function requestNotificationPermission(): Promise<boolean> {
  if (!Notifications) return false;
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch { return false; }
}

export async function scheduleTaskNotification(
  taskId: string, title: string, dueDate: string, dueTime?: string,
): Promise<string | null> {
  if (!Notifications) return null;
  try {
    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) return null;

    const due = new Date(dueDate);
    const now = new Date();
    const morningReminder = new Date(due);
    morningReminder.setHours(5, 0, 0, 0);

    if (morningReminder > now) {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: '📋 Aufgabe heute fällig',
          body: title,
          data: { taskId },
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: morningReminder,
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

export async function cancelTaskNotification(notificationId: string) {
  if (!Notifications) return;
  try { await Notifications.cancelScheduledNotificationAsync(notificationId); } catch {}
}