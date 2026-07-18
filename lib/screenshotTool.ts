// lib/screenshotTool.ts — web-only dev tool: rasterizes the current page and downloads it as a
// PNG. Backs the hidden "screenshot tool" row in household settings (owner-only, web-only) that
// walks every tab and saves a screenshot of each, for quickly refreshing store/marketing images
// after UI changes instead of taking them by hand on a device.
//
// This captures the web (react-native-web) layout, not the native Android layout — good enough
// for marketing use, but Play Store screenshots should still come from the real Android app.
import { Platform } from 'react-native';

export async function captureScreenshot(filename: string): Promise<void> {
  if (Platform.OS !== 'web') return;
  const html2canvas = (await import('html2canvas')).default;
  const target = (document.getElementById('root') ?? document.body) as HTMLElement;
  const canvas = await html2canvas(target, { backgroundColor: null, useCORS: true });
  const dataUrl = canvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
