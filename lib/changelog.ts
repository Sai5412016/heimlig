// lib/changelog.ts — in-app "what's new" notes, surfaced once after the user updates.
// Entries live in the public.app_changelog table so we can announce releases without a
// new build (works on web too). We only show notes for versions the user actually has,
// and never the same note twice (last-seen version stored in AsyncStorage).

import { Platform } from 'react-native';
import * as Application from 'expo-application';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const SEEN_KEY = '@heimlig/lastSeenChangelog';

export interface ChangelogEntry {
  version_code: number;
  version_name?: string | null;
  title: string;
  items: string[];
  released_at?: string | null;
}

// Notes the user hasn't seen yet, capped to versions their installed build actually includes.
export async function getUnseenChangelog(): Promise<ChangelogEntry[]> {
  try {
    const { data } = await supabase
      .from('app_changelog')
      .select('version_code, version_name, title, items, released_at')
      .order('version_code', { ascending: false });
    if (!data || data.length === 0) return [];

    const seenRaw = await AsyncStorage.getItem(SEEN_KEY);
    const lastSeen = seenRaw ? parseInt(seenRaw, 10) : 0;

    // Web is always the latest deploy; native is capped to the installed build version.
    const installed = Platform.OS === 'web'
      ? Number.MAX_SAFE_INTEGER
      : parseInt(Application.nativeBuildVersion ?? '0', 10) || Number.MAX_SAFE_INTEGER;

    return (data as any[])
      .filter(e => e.version_code > lastSeen && e.version_code <= installed)
      .map(e => ({ ...e, items: Array.isArray(e.items) ? e.items : [] }));
  } catch {
    return [];
  }
}

// Remember that everything up to the newest shown entry has been seen.
export async function markChangelogSeen(entries: ChangelogEntry[]) {
  if (!entries.length) return;
  const max = Math.max(...entries.map(e => e.version_code));
  try { await AsyncStorage.setItem(SEEN_KEY, String(max)); } catch { /* ignore */ }
}
