// hooks/useTheme.ts
import { useStore } from '../store/useStore';
import { lightColors, darkColors, type ColorPalette } from '../constants/theme';

export function useTheme(): { colors: ColorPalette; isDark: boolean } {
  const darkMode = useStore((s: { darkMode: boolean }) => s.darkMode);
  return { colors: darkMode ? darkColors : lightColors, isDark: darkMode };
}
