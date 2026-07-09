// constants/theme.ts
//
// Heimlig Self bekommt bewusst eine eigene, von Heimlig (Grün) losgelöste Palette:
// tiefes Indigo/Violett für Mind & Soul, warmes Koralle für Body & Energie.
// Dark Mode ist der Startzustand (Vision: "Dark Mode" als Kernanforderung).

export const darkColors = {
  brand:         '#6C5CE7',
  brandLight:    '#A29BFE',
  brandPale:     '#241D40',
  brandDark:     '#3B2F87',

  accent:        '#FF8A65',
  accentLight:   '#3A2A22',

  background:    '#120F1A',
  surface:       '#1C1730',
  surfaceElevated: '#241D40',
  border:        '#2C2447',
  borderLight:   '#221B3B',

  text:          '#F1EEFB',
  textSecondary: '#B3A9D6',
  textMuted:     '#786E9E',
  textInverse:   '#120F1A',

  success:       '#4CAF7D',
  warning:       '#F4A94F',
  error:         '#FF6B6B',
  info:          '#4A90D9',
};

export const lightColors = {
  brand:         '#6C5CE7',
  brandLight:    '#A29BFE',
  brandPale:     '#EDE8FF',
  brandDark:     '#3B2F87',

  accent:        '#FF8A65',
  accentLight:   '#FFE4D8',

  background:    '#FAF7FF',
  surface:       '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  border:        '#EDE7FB',
  borderLight:   '#F4F0FC',

  text:          '#211B36',
  textSecondary: '#5C527A',
  textMuted:     '#9C93B8',
  textInverse:   '#FFFFFF',

  success:       '#4CAF7D',
  warning:       '#F4A94F',
  error:         '#E4574C',
  info:          '#4A90D9',
};

export type ColorPalette = typeof darkColors;

// Kept as alias so non-themed code compiles without threading useTheme() everywhere.
export const colors = darkColors;

export type ModuleKey = 'energy' | 'body' | 'mind' | 'growth' | 'purpose' | 'habits' | 'focus' | 'coach';

export interface ModuleDef {
  key: ModuleKey;
  emoji: string;
  color: string;
  labelDe: string;
  labelEn: string;
}

export const MODULES: ModuleDef[] = [
  { key: 'energy',  emoji: '⚡', color: '#F4A94F', labelDe: 'Energy',  labelEn: 'Energy' },
  { key: 'body',    emoji: '💪', color: '#FF6B6B', labelDe: 'Body',    labelEn: 'Body' },
  { key: 'mind',    emoji: '🧠', color: '#6C5CE7', labelDe: 'Mind',    labelEn: 'Mind' },
  { key: 'growth',  emoji: '🌱', color: '#4CAF7D', labelDe: 'Growth',  labelEn: 'Growth' },
  { key: 'purpose', emoji: '🧭', color: '#9C6ADE', labelDe: 'Purpose', labelEn: 'Purpose' },
  { key: 'habits',  emoji: '🔁', color: '#4ECDC4', labelDe: 'Habits',  labelEn: 'Habits' },
  { key: 'focus',   emoji: '🎯', color: '#4A90D9', labelDe: 'Focus',   labelEn: 'Focus' },
  { key: 'coach',   emoji: '✨', color: '#E0B03D', labelDe: 'AI Coach', labelEn: 'AI Coach' },
];

export const spacing = {
  xs:  4,
  sm:  8,
  md:  16,
  lg:  24,
  xl:  32,
  xxl: 48,
};

export const radius = {
  sm:   8,
  md:   12,
  lg:   16,
  xl:   24,
  full: 999,
};

export const typography = {
  h1:    { fontSize: 28, fontWeight: '700' as const, letterSpacing: -0.5 },
  h2:    { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.3 },
  h3:    { fontSize: 18, fontWeight: '600' as const },
  body:  { fontSize: 16, fontWeight: '400' as const },
  sm:    { fontSize: 14, fontWeight: '400' as const },
  xs:    { fontSize: 12, fontWeight: '400' as const },
  label: { fontSize: 13, fontWeight: '600' as const, letterSpacing: 0.5 },
};

export const shadow = {
  sm: {
    shadowColor: '#0A0714',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.20,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#0A0714',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.24,
    shadowRadius: 12,
    elevation: 5,
  },
  lg: {
    shadowColor: '#0A0714',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 24,
    elevation: 10,
  },
};

export const AVATAR_COLORS = [
  '#6C5CE7', '#FF8A65', '#4A90D9', '#4CAF7D',
  '#F4A94F', '#E4574C', '#4ECDC4', '#9C6ADE',
];
