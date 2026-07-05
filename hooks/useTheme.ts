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
  const base = darkMode ? darkColors : lightColors;

  const theme = APP_THEMES.find(t => t.id === themeId);
  if (!theme || theme.id === 'standard') return { colors: base, isDark: darkMode };

  const colors: ColorPalette = {
    ...base,
    brand: theme.brand,
    brandLight: theme.brandLight,
    brandDark: theme.brandDark,
    brandPale: withAlpha(theme.brand, darkMode ? '2A' : '20'),
    accent: theme.accent,
    accentLight: withAlpha(theme.accent, darkMode ? '2A' : '20'),
  };
  return { colors, isDark: darkMode };
}
