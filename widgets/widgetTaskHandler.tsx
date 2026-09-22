// widgets/widgetTaskHandler.tsx — renders the widget from a small AsyncStorage snapshot the app writes.
import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { HeimligWidget, type WidgetData } from './HeimligWidget';

export const WIDGET_SNAPSHOT_KEY = '@heimlig/widget';
const WEATHER_ENABLED_KEY = '@heimlig/weatherWidgetEnabled';
// Same two keys store/useStore.ts's toggleDarkMode()/selectTheme() already write on every
// change — read directly here rather than added to WIDGET_SNAPSHOT_KEY, same "own dedicated
// AsyncStorage key, read straight from the widget task" pattern widgets/weather.ts already uses
// for its own settings. Nothing else has to change to keep these current: app/(tabs)/index.tsx
// never needs to know about theme/dark-mode at all.
const THEME_ID_KEY = '@heimlig/themeId';
const DARK_MODE_KEY = '@heimlig/darkMode';

// Exported so widgets/refreshWidget.tsx (foreground-only, see that file) can reuse the exact
// same data-gathering instead of duplicating it — this function itself is unchanged and still
// only ever runs the local AsyncStorage reads it always did.
export async function readData(): Promise<WidgetData> {
  const fallback: WidgetData = { openTasks: 0, shoppingCount: 0, nextTask: '' };
  try {
    // All three are local AsyncStorage reads (no network), same risk class as the snapshot
    // read this function already did — safe to do before the first render, unlike weather's
    // network call below.
    const [raw, themeId, darkModeRaw] = await Promise.all([
      AsyncStorage.getItem(WIDGET_SNAPSHOT_KEY),
      AsyncStorage.getItem(THEME_ID_KEY),
      AsyncStorage.getItem(DARK_MODE_KEY),
    ]);
    const snapshot = raw ? JSON.parse(raw) : {};
    return {
      ...fallback,
      ...snapshot,
      // undefined (key missing, e.g. an install that never set it) lets HeimligWidget fall
      // back to today's look — never a crash, never an unstyled/blank color.
      themeId: themeId || undefined,
      darkMode: darkModeRaw === '1' ? true : darkModeRaw === '0' ? false : undefined,
    };
  } catch {
    return fallback;
  }
}

// Fetches the weather line, but is deliberately kept OUT of the module's top-level imports —
// `import('./weather')` here, not `import { getWeatherLine } from './weather'` up top. That
// module pulls in lib/i18n.ts (i18next + react-i18next), which — unlike everything else this
// handler touched before the weather feature shipped — this headless-JS execution path had
// never loaded before. When the weather line went blank-widget-for-everyone in build 104, the
// working theory is exactly that: loading i18next in this specific context broke module
// evaluation, and since the previous version did `await getWeatherLine()` BEFORE
// renderWidget(), that took the whole handler down with it, weather switch on or off. Deferring
// the import behind the enabled-check below means a device with the (default-off) switch off
// never loads that module at all in this path, and even with it on, a failure here can only
// ever throw into the try/catch a few lines down — never before renderWidget() has already run.
export async function getWeatherLineSafely(): Promise<string | null> {
  try {
    const enabled = await AsyncStorage.getItem(WEATHER_ENABLED_KEY);
    if (enabled !== '1') {
      console.log('[widget] weather skipped (switch off)');
      return null;
    }
    console.log('[widget] weather enabled, fetching…');
    const { getWeatherLine } = await import('./weather');
    const line = await getWeatherLine();
    console.log('[widget] weather line:', line ?? '(none)');
    return line;
  } catch (e) {
    // getWeatherLine() already has its own internal try/catch and should never reach here —
    // this is a second, independent safety net (e.g. against the dynamic import itself
    // failing), not a substitute for that one.
    console.log('[widget] weather failed, leaving line out:', e);
    return null;
  }
}

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  console.log('[widget] handler start:', props.widgetAction);
  switch (props.widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED': {
      const data = await readData();
      // Tasks/shopping/pinned task draw FIRST, unconditionally, no matter what weather does —
      // the widget must never sit blank while something else is still loading or a network
      // call is in flight.
      props.renderWidget(<HeimligWidget data={data} />);
      console.log('[widget] base render done');

      const weatherLine = await getWeatherLineSafely();
      if (weatherLine) {
        // Second render, additive: updates the already-visible widget in place once (and only
        // if) a weather line is actually available.
        props.renderWidget(<HeimligWidget data={{ ...data, weatherLine }} />);
        console.log('[widget] weather render done');
      }
      break;
    }
    default:
      break;
  }
}
