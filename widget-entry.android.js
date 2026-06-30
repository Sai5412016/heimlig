// widget-entry.android.js — Android only: register the home-screen widget task handler.
import { registerWidgetTaskHandler } from 'react-native-android-widget';
import { widgetTaskHandler } from './widgets/widgetTaskHandler';

registerWidgetTaskHandler(widgetTaskHandler);
