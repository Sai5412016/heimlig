// lib/alert.ts — drop-in replacement for React Native's Alert, because react-native-web ships
// Alert.alert() as a complete no-op (see node_modules/react-native-web/src/exports/Alert). Every
// confirm/info dialog built on Alert.alert (task completion, deletions, imports, ...) silently
// did nothing on the web/Vercel build, while working fine in the native Android app. Same call
// signature as the original, so call sites don't change — only the import does.
import { Alert as RNAlert, Platform } from 'react-native';

type AlertButton = { text?: string; style?: 'default' | 'cancel' | 'destructive'; onPress?: () => void };

function alertWeb(title: string, message?: string, buttons?: AlertButton[]) {
  const text = [title, message].filter(Boolean).join('\n\n');
  if (!buttons || buttons.length <= 1) {
    window.alert(text);
    buttons?.[0]?.onPress?.();
    return;
  }
  const cancelBtn = buttons.find(b => b.style === 'cancel');
  const confirmBtn = buttons.find(b => b !== cancelBtn) ?? buttons[buttons.length - 1];
  if (window.confirm(text)) confirmBtn?.onPress?.();
  else cancelBtn?.onPress?.();
}

export const Alert = {
  alert(title: string, message?: string, buttons?: AlertButton[]) {
    if (Platform.OS === 'web') alertWeb(title, message, buttons);
    else RNAlert.alert(title, message, buttons as any);
  },
};
