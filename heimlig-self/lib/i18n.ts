// lib/i18n.ts — minimal DE/EN dictionary, no external i18n lib needed for this scaffold.
import { useStore } from '../store/useStore';

export type Language = 'de' | 'en';

const dict = {
  de: {
    'welcome.tagline': 'Organisiere dein Leben – nicht nur deinen Alltag.',
    'welcome.sub': 'Energy · Body · Mind · Growth · Purpose',
    'welcome.start': 'Loslegen →',
    'welcome.haveAccount': 'Ich habe schon einen Account',
    'auth.loginTitle': 'Willkommen zurück',
    'auth.registerTitle': 'Account erstellen',
    'auth.email': 'E-Mail',
    'auth.password': 'Passwort',
    'auth.login': 'Einloggen',
    'auth.continue': 'Weiter →',
    'auth.forgotPassword': 'Passwort vergessen?',
    'auth.loading': 'Lädt...',
    'verify.title': 'Fast geschafft 📧',
    'verify.body': 'Wir haben dir einen Bestätigungslink an {email} geschickt. Klick den Link in der Mail, dann kannst du dich hier einloggen.',
    'verify.toLogin': 'Zum Login →',
    'profile.title': 'Fast geschafft! 🎉',
    'profile.sub': 'Wie heißt du?',
    'profile.name': 'Dein Name',
    'profile.color': 'Deine Farbe',
    'profile.language': 'Sprache',
    'profile.save': 'Profil speichern 🎉',
    'profile.saving': 'Speichere...',
    'tabs.dashboard': 'Home',
    'tabs.energy': 'Energy',
    'tabs.mind': 'Mind',
    'tabs.coach': 'Coach',
    'tabs.profile': 'Profil',
    'dashboard.greeting': 'Wie geht es dir heute?',
    'dashboard.energyScore': 'Energy Score',
    'dashboard.modules': 'Deine Module',
    'dashboard.aiTip': 'KI-Tipp des Tages',
    'dashboard.aiTipPlaceholder': 'Sobald du ein paar Tage getrackt hast, erkennt die KI hier deine Muster.',
    'stub.comingSoon': 'Bald verfügbar',
    'stub.body': 'Dieses Modul ist Teil der Heimlig-Self-Vision und wird als Nächstes gebaut.',
    'stub.back': '‹ Zurück',
    'coach.title': 'AI Coach',
    'coach.placeholder': 'Dein persönlicher Coach lernt dich noch kennen. Sobald Energy, Body und Mind Daten sammeln, gibt es hier echte Empfehlungen.',
    'coach.inputPlaceholder': 'Frag deinen Coach...',
    'settings.language': 'Sprache',
    'settings.darkMode': 'Dark Mode',
    'settings.logout': 'Abmelden',
    'settings.deleteAccount': 'Account löschen',
    'settings.legal': 'Rechtliches',
    'settings.imprint': 'Impressum',
    'settings.privacy': 'Datenschutz',
    'legal.back': '‹ Zurück',
  },
  en: {
    'welcome.tagline': 'Organize your life – not just your day.',
    'welcome.sub': 'Energy · Body · Mind · Growth · Purpose',
    'welcome.start': 'Get started →',
    'welcome.haveAccount': 'I already have an account',
    'auth.loginTitle': 'Welcome back',
    'auth.registerTitle': 'Create account',
    'auth.email': 'Email',
    'auth.password': 'Password',
    'auth.login': 'Log in',
    'auth.continue': 'Continue →',
    'auth.forgotPassword': 'Forgot password?',
    'auth.loading': 'Loading...',
    'verify.title': 'Almost there 📧',
    'verify.body': 'We sent a confirmation link to {email}. Click the link, then come back and log in here.',
    'verify.toLogin': 'To login →',
    'profile.title': 'Almost done! 🎉',
    'profile.sub': "What's your name?",
    'profile.name': 'Your name',
    'profile.color': 'Your color',
    'profile.language': 'Language',
    'profile.save': 'Save profile 🎉',
    'profile.saving': 'Saving...',
    'tabs.dashboard': 'Home',
    'tabs.energy': 'Energy',
    'tabs.mind': 'Mind',
    'tabs.coach': 'Coach',
    'tabs.profile': 'Profile',
    'dashboard.greeting': 'How are you feeling today?',
    'dashboard.energyScore': 'Energy Score',
    'dashboard.modules': 'Your modules',
    'dashboard.aiTip': "Today's AI tip",
    'dashboard.aiTipPlaceholder': 'Once you have tracked a few days, the AI will spot your patterns here.',
    'stub.comingSoon': 'Coming soon',
    'stub.body': 'This module is part of the Heimlig Self vision and is built next.',
    'stub.back': '‹ Back',
    'coach.title': 'AI Coach',
    'coach.placeholder': 'Your personal coach is still getting to know you. Once Energy, Body and Mind collect data, real recommendations show up here.',
    'coach.inputPlaceholder': 'Ask your coach...',
    'settings.language': 'Language',
    'settings.darkMode': 'Dark mode',
    'settings.logout': 'Log out',
    'settings.deleteAccount': 'Delete account',
    'settings.legal': 'Legal',
    'settings.imprint': 'Imprint',
    'settings.privacy': 'Privacy',
    'legal.back': '‹ Back',
  },
} satisfies Record<Language, Record<string, string>>;

export type TranslationKey = keyof typeof dict['de'];

export function translate(lang: Language, key: TranslationKey, vars?: Record<string, string>): string {
  let str = dict[lang][key] ?? dict.de[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) str = str.replace(`{${k}}`, v);
  }
  return str;
}

export function useT() {
  const language = useStore((s) => s.language);
  return (key: TranslationKey, vars?: Record<string, string>) => translate(language, key, vars);
}
