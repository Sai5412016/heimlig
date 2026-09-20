// hooks/useTheme.ts
import { useStore } from '../store/useStore';
import { resolveThemeColors, type ColorPalette } from '../constants/theme';

export function useTheme(): { colors: ColorPalette; isDark: boolean } {
  const darkMode = useStore((s: { darkMode: boolean }) => s.darkMode);
  const themeId = useStore((s: { themeId: string }) => s.themeId);
  return resolveThemeColors(themeId, darkMode);
}
