// lib/appUpdate.ts — notify users when a newer app version is available
import { Alert, Linking, Platform } from 'react-native';
import * as Application from 'expo-application';
import { supabase } from './supabase';

const DEFAULT_STORE_URL = 'https://play.google.com/store/apps/details?id=com.fledderman.heimlig';

// Check the remote app_config and prompt the user to update if their build is older.
export async function checkForUpdate() {
  try {
    if (Platform.OS === 'web') return;
    const current = parseInt(Application.nativeBuildVersion ?? '0', 10);
    if (!current) return;

    const { data } = await supabase.from('app_config').select('*').eq('id', 1).single();
    if (!data) return;
    if (data.latest_version_code <= current) return;

    Alert.alert(
      'Update verfügbar 🎉',
      data.update_message || 'Eine neue Version von Heimlig ist da. Jetzt im Play Store aktualisieren!',
      [
        { text: 'Später', style: 'cancel' },
        { text: 'Aktualisieren', onPress: () => Linking.openURL(data.store_url || DEFAULT_STORE_URL) },
      ],
    );
  } catch {
    // never block app startup on the update check
  }
}
