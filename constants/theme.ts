// constants/theme.ts

export const lightColors = {
  // Brand
  brand:         '#2D6A4F',
  brandLight:    '#52B788',
  brandPale:     '#D8F3DC',
  brandDark:     '#1B4332',

  // Accent
  accent:        '#FF6B35',
  accentLight:   '#FFD6C4',

  // UI
  background:    '#F7F9F7',
  surface:       '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  border:        '#E5EDE9',
  borderLight:   '#F0F5F2',

  // Text
  text:          '#1A2E1F',
  textSecondary: '#5A7A65',
  textMuted:     '#9AB5A0',
  textInverse:   '#FFFFFF',

  // Semantic
  success:       '#2D6A4F',
  warning:       '#F59E0B',
  error:         '#EF4444',
  info:          '#3B82F6',

  // Categories
  lebensmittel:  '#10B981',
  drogerie:      '#8B5CF6',
  tiefkuehl:     '#3B82F6',
  obst:          '#F59E0B',
  fleisch:       '#EF4444',
  backwaren:     '#F97316',
  getraenke:     '#06B6D4',
  sonstiges:     '#6B7280',
};

export const darkColors = {
  // Brand (unchanged)
  brand:         '#2D6A4F',
  brandLight:    '#52B788',
  brandPale:     '#1B3D28',
  brandDark:     '#1B4332',

  // Accent (unchanged)
  accent:        '#FF6B35',
  accentLight:   '#4A2010',

  // UI
  background:    '#0D1F15',
  surface:       '#162A1C',
  surfaceElevated: '#1E3526',
  border:        '#2A4030',
  borderLight:   '#1E3526',

  // Text
  text:          '#E8F5EC',
  textSecondary: '#89B89A',
  textMuted:     '#5A7A65',
  textInverse:   '#0D1F15',

  // Semantic
  success:       '#52B788',
  warning:       '#F59E0B',
  error:         '#EF4444',
  info:          '#3B82F6',

  // Categories (unchanged — these are item/category colors, stay vivid)
  lebensmittel:  '#10B981',
  drogerie:      '#8B5CF6',
  tiefkuehl:     '#3B82F6',
  obst:          '#F59E0B',
  fleisch:       '#EF4444',
  backwaren:     '#F97316',
  getraenke:     '#06B6D4',
  sonstiges:     '#6B7280',
};

export type ColorPalette = typeof lightColors;

// Kept as alias so non-themed code (lib/, store/) still compiles
export const colors = lightColors;

// 🎨 Optional accent themes — re-skin the brand/accent colors (buttons, active states,
// checkmarks, FABs) while background/surface/text keep following the Hell/Dunkel toggle.
// Inspired by current pop-culture vibes, but deliberately named/colored around the mood
// rather than the trademarked property itself (no logos, no names of real people).
export interface AppTheme {
  id: string; label: string; emoji: string; brand: string; brandLight: string; brandDark: string; accent: string;
  // Optional original-mascot illustrations shown in empty states instead of the default emoji.
  illustrations?: { shoppingEmpty?: number; tasksEmpty?: number };
  // Full palette override + dark-mode lock, for themes that commit to one fixed look
  // (currently only "matrix") instead of following the Hell/Dunkel toggle.
  forceDark?: boolean;
  background?: string; surface?: string; surfaceElevated?: string;
  border?: string; borderLight?: string;
  text?: string; textSecondary?: string; textMuted?: string; textInverse?: string;
}

export const APP_THEMES: AppTheme[] = [
  { id: 'standard', label: 'Standard', emoji: '🏡', brand: '#2D6A4F', brandLight: '#52B788', brandDark: '#1B4332', accent: '#FF6B35' },
  {
    id: 'waldgeist', label: 'Waldgeist', emoji: '🌿', brand: '#6FA377', brandLight: '#A8CBA0', brandDark: '#3A6B42', accent: '#E8A9A0',
    illustrations: {
      shoppingEmpty: require('../assets/themes/waldgeist/shopping-empty.png'),
      tasksEmpty: require('../assets/themes/waldgeist/tasks-empty.png'),
    },
  },
  {
    id: 'inselfreunde', label: 'Inselfreunde', emoji: '🏝️', brand: '#4C9A2A', brandLight: '#F4A65E', brandDark: '#2E5E18', accent: '#FF9F8C',
    illustrations: {
      shoppingEmpty: require('../assets/themes/inselfreunde/shopping-empty.png'),
      tasksEmpty: require('../assets/themes/inselfreunde/tasks-empty.png'),
    },
  },
  {
    id: 'blocky', label: 'Blocky Grün', emoji: '🟩', brand: '#4C9A2A', brandLight: '#7CC24A', brandDark: '#2E5E18', accent: '#8B5A2B',
    illustrations: {
      shoppingEmpty: require('../assets/themes/blocky/shopping-empty.png'),
      tasksEmpty: require('../assets/themes/blocky/tasks-empty.png'),
    },
  },
  {
    id: 'battle-royale', label: 'Battle Royale Neon', emoji: '🎮', brand: '#8B5CF6', brandLight: '#C4B5FD', brandDark: '#4C1D95', accent: '#22D3EE',
    illustrations: {
      shoppingEmpty: require('../assets/themes/battle-royale/shopping-empty.png'),
      tasksEmpty: require('../assets/themes/battle-royale/tasks-empty.png'),
    },
  },
  {
    // Full dark-arena backdrop (see components/ArenaBackdrop.tsx) — same forceDark +
    // transparent-background pattern as "matrix", so it locks to its own look regardless
    // of the Hell/Dunkel toggle instead of just re-skinning brand/accent.
    id: 'red-light', label: 'Rotlicht Arena', emoji: '🦑', brand: '#E0286B', brandLight: '#FF6B9D', brandDark: '#7A1338', accent: '#00C2A8',
    forceDark: true,
    background: 'transparent', surface: '#1A0E14', surfaceElevated: '#241420',
    border: '#4A2038', borderLight: '#33182A',
    text: '#FBEAF2', textSecondary: '#D69EBB', textMuted: '#7A4A63', textInverse: '#0F0710',
    illustrations: {
      shoppingEmpty: require('../assets/themes/red-light/shopping-empty.png'),
      tasksEmpty: require('../assets/themes/red-light/tasks-empty.png'),
    },
  },
  {
    id: 'gothic', label: 'Gothic Akademie', emoji: '🖤', brand: '#5B2A86', brandLight: '#8B5FBF', brandDark: '#2E1245', accent: '#1A1A1A',
    illustrations: {
      shoppingEmpty: require('../assets/themes/gothic/shopping-empty.png'),
      tasksEmpty: require('../assets/themes/gothic/tasks-empty.png'),
    },
  },
  {
    // Full night-skyline backdrop (see components/CitySkyline.tsx) — same forceDark pattern.
    id: 'comic-hero', label: 'Comic Held', emoji: '🦸', brand: '#D62828', brandLight: '#F4A100', brandDark: '#7A1010', accent: '#1D4ED8',
    forceDark: true,
    background: 'transparent', surface: '#141B33', surfaceElevated: '#1C2444',
    border: '#2C355C', borderLight: '#222B4A',
    text: '#F2F4FF', textSecondary: '#AAB4DD', textMuted: '#5C6790', textInverse: '#0B0F1E',
    illustrations: {
      shoppingEmpty: require('../assets/themes/comic-hero/shopping-empty.png'),
      tasksEmpty: require('../assets/themes/comic-hero/tasks-empty.png'),
    },
  },
  {
    id: 'cinema', label: 'Abenteuer Kino', emoji: '🎬', brand: '#C9820A', brandLight: '#F2B84B', brandDark: '#6B4408', accent: '#0E7C7B',
    illustrations: {
      shoppingEmpty: require('../assets/themes/cinema/shopping-empty.png'),
      tasksEmpty: require('../assets/themes/cinema/tasks-empty.png'),
    },
  },
  {
    id: 'sparkle-pop', label: 'Glitzer Pop', emoji: '✨', brand: '#E85D9C', brandLight: '#FBC7DE', brandDark: '#8A2B5C', accent: '#B08BE0',
    illustrations: {
      shoppingEmpty: require('../assets/themes/sparkle-pop/shopping-empty.png'),
      tasksEmpty: require('../assets/themes/sparkle-pop/tasks-empty.png'),
    },
  },
  {
    id: 'moody', label: 'Moody Neon', emoji: '🖤', brand: '#9ACD32', brandLight: '#C6E877', brandDark: '#4F6B14', accent: '#1A1A1A',
    illustrations: {
      shoppingEmpty: require('../assets/themes/moody/shopping-empty.png'),
      tasksEmpty: require('../assets/themes/moody/tasks-empty.png'),
    },
  },
  {
    // Full night-pitch backdrop (see components/PitchField.tsx) — same forceDark pattern.
    id: 'pitch-gold', label: 'Rasen Gold', emoji: '⚽', brand: '#2E8B3D', brandLight: '#6FCB6F', brandDark: '#154019', accent: '#D4AF37',
    forceDark: true,
    background: 'transparent', surface: '#0F1D12', surfaceElevated: '#15271A',
    border: '#234A2E', borderLight: '#1A3220',
    text: '#EAF7EC', textSecondary: '#9FC9A8', textMuted: '#5C8265', textInverse: '#08130A',
    illustrations: {
      shoppingEmpty: require('../assets/themes/pitch-gold/shopping-empty.png'),
      tasksEmpty: require('../assets/themes/pitch-gold/tasks-empty.png'),
    },
  },
  {
    // Full night-track backdrop (see components/NightTrack.tsx) — same forceDark pattern.
    id: 'racing', label: 'Rennsport Rot', emoji: '🏎️', brand: '#C1121F', brandLight: '#E85D4E', brandDark: '#680C13', accent: '#8D99AE',
    forceDark: true,
    background: 'transparent', surface: '#16161A', surfaceElevated: '#1E1E24',
    border: '#2E2E36', borderLight: '#242429',
    text: '#F5F5F7', textSecondary: '#A8A8B0', textMuted: '#5C5C64', textInverse: '#0A0A0C',
    illustrations: {
      shoppingEmpty: require('../assets/themes/racing/shopping-empty.png'),
      tasksEmpty: require('../assets/themes/racing/tasks-empty.png'),
    },
  },
  {
    id: 'monster-fang', label: 'Taschenmonster Rot-Gelb', emoji: '⚡', brand: '#E3350D', brandLight: '#FF6B4A', brandDark: '#8A1F08', accent: '#FFCB05',
    illustrations: {
      shoppingEmpty: require('../assets/themes/monster-fang/shopping-empty.png'),
      tasksEmpty: require('../assets/themes/monster-fang/tasks-empty.png'),
    },
  },
  {
    // Full night-sky backdrop (see components/NightSky.tsx) — same forceDark pattern.
    id: 'witch-purple', label: 'Hexen Lila', emoji: '🧹', brand: '#6B3FA0', brandLight: '#A784D1', brandDark: '#3A2058', accent: '#4CAF50',
    forceDark: true,
    background: 'transparent', surface: '#150B24', surfaceElevated: '#1D1132',
    border: '#3A2058', borderLight: '#2A1642',
    text: '#F1E9FF', textSecondary: '#B6A0D9', textMuted: '#6B5590', textInverse: '#0B0616',
    illustrations: {
      shoppingEmpty: require('../assets/themes/witch-purple/shopping-empty.png'),
      tasksEmpty: require('../assets/themes/witch-purple/tasks-empty.png'),
    },
  },
  {
    // Deliberately black regardless of the Hell/Dunkel toggle — the whole point is the
    // near-black backdrop, so this one locks forceDark and overrides the full surface
    // stack instead of just brand/accent like the other 12 themes.
    id: 'matrix', label: 'Matrix', emoji: '🟢', brand: '#39FF6E', brandLight: '#B9FFD1', brandDark: '#1E8A44', accent: '#FFB020',
    forceDark: true,
    // "background" is transparent on purpose: <MatrixRain> paints the actual near-black
    // + animated glyphs once behind the tab navigator (see app/(tabs)/_layout.tsx), and
    // every screen's own SafeAreaView reads this token for its container — leaving it
    // transparent lets that single animated layer show through everywhere instead of
    // every screen painting over it with a flat color.
    background: 'transparent', surface: '#0D1410', surfaceElevated: '#101A13',
    border: '#163322', borderLight: '#0F2417',
    text: '#E7FFEF', textSecondary: '#8FC9A3', textMuted: '#4D7A5C', textInverse: '#041A0C',
  },
  {
    // Tactical-ops vibe (orange/gunmetal), inspired by the mood of competitive tactical
    // shooters — deliberately not named/branded after a specific game, same convention as
    // every other theme in this list.
    id: 'tactical-ops', label: 'Task Force Orange', emoji: '🎯',
    brand: '#FF6A13', brandLight: '#FFB073', brandDark: '#B33D00', accent: '#5A6270',
    // Full ops-backdrop (see components/OpsBackdrop.tsx) — same forceDark pattern.
    forceDark: true,
    background: 'transparent', surface: '#20242A', surfaceElevated: '#2A2F36',
    border: '#3A4048', borderLight: '#2E343C',
    text: '#F2F3F5', textSecondary: '#A9AFB8', textMuted: '#616872', textInverse: '#14171B',
  },
];

export const CATEGORY_COLORS: Record<string, string> = {
  'Lebensmittel':       colors.lebensmittel,
  'Obst & Gemüse':      colors.obst,
  'Tiefkühl':           colors.tiefkuehl,
  'Fleisch & Fisch':    colors.fleisch,
  'Drogerie':           colors.drogerie,
  'Backwaren':          colors.backwaren,
  'Getränke':           colors.getraenke,
  'Sonstiges':          colors.sonstiges,
};

export const SHOPPING_CATEGORIES = Object.keys(CATEGORY_COLORS);

export const BUDGET_CATEGORIES = [
  'Lebensmittel', 'Miete', 'Transport', 'Freizeit',
  'Gesundheit', 'Kleidung', 'Haushalt', 'Kinder',
  'Haustiere', 'Sparen', 'Sonstiges'
];

export const TASK_CATEGORIES = [
  'Haushalt', 'Einkauf', 'Wartung', 'Garten', 'Büro', 'Familie', 'Sonstiges'
];

export const spacing = {
  xs:   4,
  sm:   8,
  md:   16,
  lg:   24,
  xl:   32,
  xxl:  48,
};

export const radius = {
  sm:   8,
  md:   12,
  lg:   16,
  xl:   24,
  full: 999,
};

export const typography = {
  h1:   { fontSize: 28, fontWeight: '700' as const, letterSpacing: -0.5 },
  h2:   { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.3 },
  h3:   { fontSize: 18, fontWeight: '600' as const },
  body: { fontSize: 16, fontWeight: '400' as const },
  sm:   { fontSize: 14, fontWeight: '400' as const },
  xs:   { fontSize: 12, fontWeight: '400' as const },
  label:{ fontSize: 13, fontWeight: '600' as const, letterSpacing: 0.5 },
};

export const shadow = {
  sm: {
    shadowColor: '#1A2E1F',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#1A2E1F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 5,
  },
  lg: {
    shadowColor: '#1A2E1F',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 10,
  },
};

export const AVATAR_COLORS = [
  '#2D6A4F', '#FF6B35', '#3B82F6', '#8B5CF6',
  '#F59E0B', '#EC4899', '#06B6D4', '#10B981',
];

// Consistent timing so every micro-interaction (checkbox pulse, success toast, progress
// bar fill) feels like it belongs to the same app instead of picking a random duration.
export const motion = {
  duration: { fast: 150, base: 250, slow: 400 },
  spring: { useNativeDriver: true, speed: 20, bounciness: 6 },
};

// Minimum tappable size (Apple HIG / Material both land on ~44dp) — use for icon-only
// buttons that would otherwise render smaller than their visual glyph suggests.
export const touchTarget = { min: 44 };
