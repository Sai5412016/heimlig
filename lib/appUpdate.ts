// lib/appUpdate.ts — notify users when a newer app version is available
import { Linking, Platform } from 'react-native';
import * as Application from 'expo-application';
import { supabase } from './supabase';
import { Alert } from './alert';
import i18n from './i18n';

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
      i18n.t('appUpdate.title'),
      data.update_message || i18n.t('appUpdate.defaultBody'),
      [
        { text: i18n.t('appUpdate.later'), style: 'cancel' },
        { text: i18n.t('appUpdate.updateButton'), onPress: () => Linking.openURL(data.store_url || DEFAULT_STORE_URL) },
      ],
    );
  } catch {
    // never block app startup on the update check
  }
}
