export const Colors = {
  background: '#0D0D0D',
  surface: '#1A1A1A',
  surfaceHigh: '#242424',
  border: '#2D2D2D',
  primary: '#C0392B',
  primaryLight: '#E74C3C',
  gold: '#D4A017',
  text: '#F0F0F0',
  textSecondary: '#999999',
  textMuted: '#666666',
  success: '#27AE60',
  warning: '#E67E22',
  danger: '#E74C3C',

  phase1: '#27AE60',
  phase2: '#2980B9',
  phase3: '#E67E22',
  phase4: '#E74C3C',
  phase5: '#8E44AD',

  comfortLow: '#E74C3C',
  comfortMid: '#E67E22',
  comfortHigh: '#27AE60',
} as const;

export function comfortColor(value: number): string {
  if (value <= 3) return Colors.comfortLow;
  if (value <= 6) return Colors.comfortMid;
  return Colors.comfortHigh;
}
