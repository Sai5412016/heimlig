// widgets/HeimligWidget.tsx — the Android home-screen widget UI (react-native-android-widget).
import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';

export interface WidgetData {
  openTasks: number;
  shoppingCount: number;
  nextTask?: string;
  // Pre-formatted (e.g. "13 Grad - Sonnig - hoch 22 / tief 10"), or null/undefined to leave the
  // line out entirely — off switch, no coordinates yet, offline with no cache, whatever the
  // reason. See widgets/weather.ts; this component never talks to the network or i18n itself.
  weatherLine?: string | null;
}

export function HeimligWidget({ data }: { data: WidgetData }) {
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: '#162A1C',
        borderRadius: 16,
        padding: 14,
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      <TextWidget text="🏡 Heimlig" style={{ fontSize: 14, color: '#D8F3DC', fontWeight: 'bold' }} />
      {!!data.weatherLine && (
        <TextWidget text={data.weatherLine} style={{ fontSize: 11, color: '#89B89A' }} maxLines={1} truncate="END" />
      )}
      <TextWidget text={`✅ ${data.openTasks} Aufgaben offen`} style={{ fontSize: 14, color: '#FFFFFF' }} />
      <TextWidget text={`🛒 ${data.shoppingCount} Artikel fehlen`} style={{ fontSize: 14, color: '#FFFFFF' }} />
      <TextWidget
        text={data.nextTask ? `📌 ${data.nextTask}` : 'Alles erledigt 🎉'}
        style={{ fontSize: 12, color: '#89B89A' }}
        maxLines={1}
        truncate="END"
      />
    </FlexWidget>
  );
}
