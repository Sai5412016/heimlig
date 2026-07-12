// lib/haptics.ts — thin wrappers around expo-haptics that no-op on web (haptics aren't
// supported there, and calling the native API throws in react-native-web).
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

export const hapticImpact = (style: Haptics.ImpactFeedbackStyle) => {
  if (Platform.OS !== 'web') Haptics.impactAsync(style);
};

export const hapticNotification = (type: Haptics.NotificationFeedbackType) => {
  if (Platform.OS !== 'web') Haptics.notificationAsync(type);
};
