// widgets/HeimligWidget.tsx — the Android home-screen widget UI (react-native-android-widget).
import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import { resolveThemeColors } from '../constants/theme';

export interface WidgetData {
  openTasks: number;
  shoppingCount: number;
  nextTask?: string;
  // Pre-formatted (e.g. "13 Grad - Sonnig - hoch 22 / tief 10"), or null/undefined to leave the
  // line out entirely — off switch, no coordinates yet, offline with no cache, whatever the
  // reason. See widgets/weather.ts; this component never talks to the network or i18n itself.
  weatherLine?: string | null;
  // Mirrors store/useStore.ts's themeId/darkMode, read straight from AsyncStorage by
  // widgetTaskHandler.tsx (see THEME_ID_KEY/DARK_MODE_KEY there) — undefined whenever the keys
  // are missing (e.g. an install that never touched the theme picker), in which case this
  // component falls back to the widget's original always-dark look, unchanged.
  themeId?: string;
  darkMode?: boolean;
}

// constants/theme.ts types ColorPalette values as plain `string` (no `as const`), but every value
// in it is actually a hex literal — the widget library's ColorProp type wants that spelled out.
const hex = (v: string) => v as `#${string}`;

export function HeimligWidget({ data }: { data: WidgetData }) {
  // 'standard' + darkMode=true reproduces exactly the palette this widget always used before
  // theme-awareness (darkColors, unmodified) — so a missing/unknown theme keeps today's look.
  const { colors } = resolveThemeColors(data.themeId ?? 'standard', data.darkMode ?? true);
  const WIDGET_BG = hex(colors.surface);
  const TILE_BG = hex(colors.surfaceElevated);
  const TILE_BORDER = hex(colors.border);
  const TITLE_COLOR = hex(colors.text);
  const MUTED_COLOR = hex(colors.textSecondary);
  const NUMBER_COLOR = hex(colors.text);

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
          handles every tap outside these two tiles. A theme-derived border keeps the tile shape
          visible even for the themes/modes where surface and surfaceElevated resolve to the same
          color (e.g. standard in light mode) — otherwise the tiles would blend into the
          background there. */}
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', flexGap: 10 }}>
        <FlexWidget
          clickAction="OPEN_URI"
          clickActionData={{ uri: 'heimlig://tasks' }}
          accessibilityLabel="Aufgaben öffnen"
          style={{
            flex: 1, backgroundColor: TILE_BG, borderRadius: 12, padding: 8,
            borderColor: TILE_BORDER, borderWidth: 1,
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
            borderColor: TILE_BORDER, borderWidth: 1,
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
