// widgets/widgetTaskHandler.tsx — renders the widget from a small AsyncStorage snapshot the app writes.
import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { HeimligWidget, type WidgetData } from './HeimligWidget';

export const WIDGET_SNAPSHOT_KEY = '@heimlig/widget';

async function readData(): Promise<WidgetData> {
  const fallback: WidgetData = { openTasks: 0, shoppingCount: 0, nextTask: '' };
  try {
    const raw = await AsyncStorage.getItem(WIDGET_SNAPSHOT_KEY);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  switch (props.widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED': {
      const data = await readData();
      props.renderWidget(<HeimligWidget data={data} />);
      break;
    }
    default:
      break;
  }
}
