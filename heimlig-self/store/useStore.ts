// store/useStore.ts
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, type Profile } from '../lib/supabase';
import type { Language } from '../lib/i18n';

interface StoreState {
  userId: string | null;
  profile: Profile | null;
  darkMode: boolean;
  language: Language;

  setUserId: (id: string | null) => void;
  setProfile: (p: Profile | null) => void;
  setDarkMode: (v: boolean) => void;
  setLanguage: (v: Language) => void;

  loadProfile: (userId: string) => Promise<Profile | null>;
  signOut: () => Promise<void>;
}

export const useStore = create<StoreState>((set, get) => ({
  userId: null,
  profile: null,
  darkMode: true,
  language: 'de',

  setUserId: (id) => set({ userId: id }),
  setProfile: (p) => set({ profile: p }),

  setDarkMode: (v) => {
    set({ darkMode: v });
    AsyncStorage.setItem('@heimligself/darkMode', v ? '1' : '0').catch(() => {});
  },

  setLanguage: (v) => {
    set({ language: v });
    AsyncStorage.setItem('@heimligself/language', v).catch(() => {});
    const userId = get().userId;
    if (userId) supabase.from('profiles').update({ language: v }).eq('id', userId).then(() => {});
  },

  loadProfile: async (userId: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (data) {
      set({ profile: data, darkMode: data.dark_mode, language: data.language });
    }
    return data ?? null;
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ userId: null, profile: null });
  },
}));
