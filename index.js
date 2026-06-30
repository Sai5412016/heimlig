// index.js — app entry. Boots expo-router, then registers the Android home-screen widget
// handler (no-op on web/iOS via the platform-split widget-entry module).
import 'expo-router/entry';
import './widget-entry';
