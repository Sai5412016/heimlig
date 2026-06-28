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
