// hooks/useTheme.ts
import { useStore } from '../store/useStore';
import { lightColors, darkColors, APP_THEMES, type ColorPalette } from '../constants/theme';

// Appends an alpha suffix to a hex color, same convention already used across the app
// (e.g. category chip backgrounds) for a translucent tint of a solid color.
function withAlpha(hex: string, alpha: string): string {
  return hex + alpha;
}

export function useTheme(): { colors: ColorPalette; isDark: boolean } {
  const darkMode = useStore((s: { darkMode: boolean }) => s.darkMode);
  const themeId = useStore((s: { themeId: string }) => s.themeId);
  const theme = APP_THEMES.find(t => t.id === themeId);

  // Themes like "matrix" lock their own look regardless of the Hell/Dunkel toggle.
  const effectiveDark = theme?.forceDark || darkMode;
  const base = effectiveDark ? darkColors : lightColors;

  if (!theme || theme.id === 'standard') return { colors: base, isDark: effectiveDark };

  const colors: ColorPalette = {
    ...base,
    brand: theme.brand,
    brandLight: theme.brandLight,
    brandDark: theme.brandDark,
    brandPale: withAlpha(theme.brand, effectiveDark ? '2A' : '20'),
    accent: theme.accent,
    accentLight: withAlpha(theme.accent, effectiveDark ? '2A' : '20'),
    ...(theme.background !== undefined ? { background: theme.background } : {}),
    ...(theme.surface !== undefined ? { surface: theme.surface } : {}),
    ...(theme.surfaceElevated !== undefined ? { surfaceElevated: theme.surfaceElevated } : {}),
    ...(theme.border !== undefined ? { border: theme.border } : {}),
    ...(theme.borderLight !== undefined ? { borderLight: theme.borderLight } : {}),
    ...(theme.text !== undefined ? { text: theme.text } : {}),
    ...(theme.textSecondary !== undefined ? { textSecondary: theme.textSecondary } : {}),
    ...(theme.textMuted !== undefined ? { textMuted: theme.textMuted } : {}),
    ...(theme.textInverse !== undefined ? { textInverse: theme.textInverse } : {}),
  };
  return { colors, isDark: effectiveDark };
}
