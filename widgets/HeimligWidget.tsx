// widgets/HeimligWidget.tsx — the Android home-screen widget UI (react-native-android-widget).
import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import { darkColors, lightColors } from '../constants/theme';

export interface WidgetData {
  openTasks: number;
  shoppingCount: number;
  nextTask?: string;
  // Pre-formatted (e.g. "13 Grad - Sonnig - hoch 22 / tief 10"), or null/undefined to leave the
  // line out entirely — off switch, no coordinates yet, offline with no cache, whatever the
  // reason. See widgets/weather.ts; this component never talks to the network or i18n itself.
  weatherLine?: string | null;
}

// The widget is always the dark palette regardless of the app's own Hell/Dunkel toggle (it's a
// home-screen surface, not a themed in-app screen) — same tokens constants/theme.ts uses for
// dark mode, not new colors invented for this component. brandPale comes from the LIGHT
// palette on purpose: darkColors.brandPale (#1B3D28) is itself a dark tone meant to sit behind
// light text, not to BE text on a dark background — lightColors.brandPale (#D8F3DC) is the pale
// mint that actually reads well here, which is why the title used it before this redesign too.
// constants/theme.ts types these as plain `string` (no `as const`), but every value in it is
// actually a hex literal — the widget library's ColorProp type wants that spelled out.
const hex = (v: string) => v as `#${string}`;
const WIDGET_BG = hex(darkColors.surface);        // #162A1C
const TILE_BG = hex(darkColors.surfaceElevated);  // #1E3526 — "a little lighter than the widget"
const TITLE_COLOR = hex(lightColors.brandPale);   // #D8F3DC
const MUTED_COLOR = hex(darkColors.textSecondary); // #89B89A
const NUMBER_COLOR = hex(darkColors.text);        // #E8F5EC

export function HeimligWidget({ data }: { data: WidgetData }) {
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: WIDGET_BG,
        borderRadius: 16,
        padding: 16,
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      {/* Header row: title left, weather right (muted, smaller). A single child in a
          space-between row sits at the start on its own, so when there's no weather line this
          naturally leaves just the title on the left — no separate no-weather layout needed. */}
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <TextWidget text="🏡 Heimlig" style={{ fontSize: 16, color: TITLE_COLOR, fontWeight: 'bold' }} />
        {!!data.weatherLine && (
          <TextWidget text={data.weatherLine} style={{ fontSize: 12, color: MUTED_COLOR }} maxLines={1} truncate="END" />
        )}
      </FlexWidget>

      {/* Two equal tiles. Each has its own clickAction, which — on the actual widget host —
          takes over the tap for its own area; OPEN_APP on the root FlexWidget above still
          handles every tap outside these two tiles. */}
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', flexGap: 10 }}>
        <FlexWidget
          clickAction="OPEN_URI"
          clickActionData={{ uri: 'heimlig://tasks' }}
          accessibilityLabel="Aufgaben öffnen"
          style={{
            flex: 1, backgroundColor: TILE_BG, borderRadius: 12, padding: 8,
            flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <TextWidget text={String(data.openTasks)} style={{ fontSize: 24, color: NUMBER_COLOR, fontWeight: 'bold' }} />
          <TextWidget text="Aufgaben" style={{ fontSize: 10, color: MUTED_COLOR }} />
        </FlexWidget>
        <FlexWidget
          clickAction="OPEN_URI"
          clickActionData={{ uri: 'heimlig://shopping' }}
          accessibilityLabel="Einkauf öffnen"
          style={{
            flex: 1, backgroundColor: TILE_BG, borderRadius: 12, padding: 8,
            flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <TextWidget text={String(data.shoppingCount)} style={{ fontSize: 24, color: NUMBER_COLOR, fontWeight: 'bold' }} />
          <TextWidget text="Einkauf" style={{ fontSize: 10, color: MUTED_COLOR }} />
        </FlexWidget>
      </FlexWidget>

      {/* Pinned task — omitted entirely when there is none, no "Alles erledigt" filler anymore. */}
      {!!data.nextTask && (
        <TextWidget text={`📌 ${data.nextTask}`} style={{ fontSize: 11, color: MUTED_COLOR }} maxLines={1} truncate="END" />
      )}
    </FlexWidget>
  );
}
