// widgets/HeimligWidget.tsx — the Android home-screen widget UI (react-native-android-widget).
import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';

export interface WidgetData {
  openTasks: number;
  shoppingCount: number;
  nextTask?: string;
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
