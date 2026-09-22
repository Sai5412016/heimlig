// widgets/refreshWidget.tsx — lets the FOREGROUND app (household.tsx's settings screen) ask the
// widget to redraw right now, instead of waiting for the next native ~30-minute cycle
// (app.json's updatePeriodMillis) or the next WIDGET_RESIZED. Only ever imported from foreground
// code, never from the headless path — widgets/widgetTaskHandler.tsx (registered as the headless
// task handler) is completely unchanged by this file's existence, it just exports two functions
// this one reuses instead of duplicating.
import React from 'react';
import { Platform } from 'react-native';
import { requestWidgetUpdate } from 'react-native-android-widget';
import { HeimligWidget } from './HeimligWidget';
import { readData, getWeatherLineSafely } from './widgetTaskHandler';

// Must match app.json's react-native-android-widget plugin config ("widgets"[0].name).
const WIDGET_NAME = 'Heimlig';

// Best-effort, like the rest of the widget code: never throws. No widget added to a home screen
// (widgetNotFound) and no network for the weather line are both ordinary, not errors — the
// caller shows the same "done" feedback either way, there's nothing actionable to tell the user.
export async function refreshWidgetNow(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    const data = await readData();
    const weatherLine = await getWeatherLineSafely();
    const fullData = weatherLine ? { ...data, weatherLine } : data;
    await requestWidgetUpdate({
      widgetName: WIDGET_NAME,
      renderWidget: () => <HeimligWidget data={fullData} />,
      widgetNotFound: () => {},
    });
  } catch (e) {
    console.log('[widget] manual refresh failed:', e);
  }
}
