// lib/i18n.ts — i18next setup. Two languages so far: de (default/fallback) and en, rolled
// out screen by screen (see lib/locales/*.ts). Language preference is a device-local setting
// (AsyncStorage via store/useStore.ts, same pattern as darkMode/themeId), not synced through
// the household/member DB rows.
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { de } from './locales/de';
import { en } from './locales/en';

export type SupportedLanguage = 'de' | 'en';

i18n.use(initReactI18next).init({
  resources: {
    de: { translation: de },
    en: { translation: en },
  },
  lng: 'de',
  fallbackLng: 'de',
  interpolation: { escapeValue: false },
});

export default i18n;
