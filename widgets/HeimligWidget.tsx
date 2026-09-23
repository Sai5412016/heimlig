// widgets/HeimligWidget.tsx — the Android home-screen widget UI (react-native-android-widget).
//
// Per-theme decoration (background wash, header badge, decorative row) — see the report for the
// analysis this is built from. Three hard rules drove every choice below:
// 1. No animation, no periodic redraw to fake one — RemoteViews are a static bitmap per redraw,
//    and "just update it every few minutes" was explicitly rejected as a battery drain, not a
//    workaround.
// 2. Nothing decorative sits behind or beside running text without a precomputed, passing
//    contrast number — see BADGE_BORDER_FALLBACK and the per-theme gradient stops below, both
//    chosen from numbers computed against constants/theme.ts's actual palettes, not eyeballed.
// 3. The extra decorative row (skyline bars, streaks, starfield, matrix glyphs, …) only renders
//    once the widget has real room for it — see MIN_HEIGHT_FOR_DECOR_ROW. At the app's own
//    declared default size (320×110dp) it never appears; only a deliberately resized-taller
//    widget shows it. That is not a bug, it is the fix for the "does it still look fine at the
//    smallest size" question — see the report for which themes this applies to.
import React from 'react';
import { FlexWidget, TextWidget, OverlapWidget } from 'react-native-android-widget';
import { resolveThemeColors, type ColorPalette } from '../constants/theme';

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

// Only widgetInfo.height (dp) actually reported by react-native-android-widget on
// WIDGET_ADDED/WIDGET_UPDATE/WIDGET_RESIZED counts as "enough room" — comfortably above the
// declared default/minimum (320×110dp, app.json), so a widget left at its default size never
// shows the extra row, only a deliberately-enlarged one does. Missing/unknown height (undefined,
// 0 — e.g. the very first render before the host reports a size) is treated as "not enough room",
// same fallback-to-plain convention as a missing theme/darkMode elsewhere in this file.
const MIN_HEIGHT_FOR_DECOR_ROW = 150;

// 2-stop approximation of each forceDark theme's full backdrop scene (components/ArenaBackdrop.tsx
// etc. all use a 3-stop gradient; backgroundGradient only supports 2, so this keeps the two OUTER
// stops — the ones that actually carry the visual identity — and drops the middle highlight).
// Matrix is deliberately absent: its surface color is already near-black, and its identity is the
// green monospace glyphs, not a gradient (see MatrixRain.tsx).
const THEME_GRADIENT: Record<string, { from: `#${string}`; to: `#${string}` }> = {
  'red-light':    { from: hex('#0F0710'), to: hex('#1A0E14') },
  'comic-hero':   { from: hex('#0B0F1E'), to: hex('#141B33') },
  'pitch-gold':   { from: hex('#0A160C'), to: hex('#0F1D12') },
  racing:         { from: hex('#0A0A0C'), to: hex('#16161A') },
  'witch-purple': { from: hex('#0B0616'), to: hex('#150B24') },
  'tactical-ops': { from: hex('#14171B'), to: hex('#20242A') },
};

// Header badge shape per theme, replacing the plain 🏡 emoji everywhere except "standard". Circle
// and square only — no rotated "diamond": a rotated shape's visual bounds can spill past its
// unrotated layout box, and this badge sits directly next to the "Heimlig" title text with no
// margin to spare (see rule 2 above). Rotation is only used further down, in the decorative row,
// which has a full empty row to itself.
const BADGE_SHAPE: Record<string, 'circle' | 'square'> = {
  waldgeist: 'circle', inselfreunde: 'circle', blocky: 'square', 'battle-royale': 'square',
  'red-light': 'square', gothic: 'square', 'comic-hero': 'circle', cinema: 'circle',
  'sparkle-pop': 'circle', moody: 'circle', 'pitch-gold': 'circle', racing: 'square',
  'monster-fang': 'circle', 'witch-purple': 'circle', 'tactical-ops': 'square', alpen: 'square',
};
const BADGE_SIZE = 18;

// Precomputed exceptions where the theme's own `brand` color, used as the badge's border, would
// read below the 3:1 non-text contrast floor against that mode's surface color (checked against
// every theme/mode combination — see the report's table). Falls back to `colors.text` instead,
// which is already ≥4.5:1 against surface in every theme/mode by construction (same audit as the
// theme-awareness work). racing and witch-purple are forceDark (only ever run "dark"), so they
// don't need a light-mode entry at all.
const BADGE_BORDER_FALLBACK: Record<string, { light?: true; dark?: true }> = {
  waldgeist: { light: true },
  moody: { light: true },
  gothic: { dark: true },
  racing: { dark: true },
  'witch-purple': { dark: true },
};

// One representative glyph from MatrixRain.tsx's own character pool (Katakana + digits) — this
// widget never imports that file (it's animated and this must stay static), just borrows one
// character from the same alphabet so the badge and the app's own rain read as the same idea.
const MATRIX_BADGE_GLYPH = 'ワ';
const MATRIX_ROW_GLYPHS = ['ア', 'ラ', 'ネ', '7', 'ズ'];

function ThemeBadge({ themeId, colors, isDark }: { themeId: string; colors: ColorPalette; isDark: boolean }) {
  if (themeId === 'standard') {
    return <TextWidget text="🏡" style={{ fontSize: 16 }} />;
  }
  if (themeId === 'matrix') {
    return (
      <FlexWidget
        style={{
          width: BADGE_SIZE, height: BADGE_SIZE, borderRadius: 4,
          borderWidth: 1, borderColor: hex(colors.brand), backgroundColor: hex(colors.surfaceElevated),
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        <TextWidget text={MATRIX_BADGE_GLYPH} style={{ fontSize: 11, color: hex(colors.brand), fontFamily: 'monospace' }} />
      </FlexWidget>
    );
  }
  const shape = BADGE_SHAPE[themeId];
  if (!shape) return <TextWidget text="🏡" style={{ fontSize: 16 }} />;
  const fallback = BADGE_BORDER_FALLBACK[themeId];
  const useFallback = isDark ? fallback?.dark : fallback?.light;
  const borderColor = hex(useFallback ? colors.text : colors.brand);
  return (
    <FlexWidget
      style={{
        width: BADGE_SIZE, height: BADGE_SIZE,
        borderRadius: shape === 'circle' ? BADGE_SIZE / 2 : 4,
        borderWidth: 1.5, borderColor, backgroundColor: hex(colors.surfaceElevated),
      }}
    />
  );
}

// The extra decorative row between the header and the tiles — only for the six gradient themes
// plus Matrix (whose "gradient" is really just its already-near-black surface). Every shape here
// is purely decorative (no information, nothing a screen reader would need — the tiles and title
// carry all of that), so the 4.5:1 text bar doesn't apply; the ones that use a theme color rather
// than a translucent wash still land well above it regardless (see the report).
function DecorRow({ themeId, colors }: { themeId: string; colors: ColorPalette }) {
  switch (themeId) {
    case 'red-light':
      // Three small rotated-square "guard marks", echoing ArenaBackdrop.tsx's diamond scatter.
      return (
        <FlexWidget style={{ width: 'match_parent', height: 14, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' }}>
          {[0, 1, 2].map(i => (
            <FlexWidget key={i} style={{ width: 7, height: 7, borderWidth: 1, borderColor: hex(colors.accent), rotation: 45 }} />
          ))}
        </FlexWidget>
      );
    case 'comic-hero': {
      // A row of short bars at varying heights, bottom-aligned — a minimal skyline silhouette
      // standing in for CitySkyline.tsx (its window dots don't survive at this scale).
      const heights = [5, 9, 6, 11, 7];
      return (
        <FlexWidget style={{ width: 'match_parent', height: 14, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end' }}>
          {heights.map((h, i) => (
            <FlexWidget key={i} style={{ width: 5, height: h, backgroundColor: hex('#0A0D1C') }} />
          ))}
        </FlexWidget>
      );
    }
    case 'pitch-gold':
      // Center-circle outline, alone — the closest single motif to PitchField.tsx's pitch marking
      // that still reads at 14dp tall (full stripe rows would just be noise at this height).
      return (
        <FlexWidget style={{ width: 'match_parent', height: 14, alignItems: 'center', justifyContent: 'center' }}>
          <FlexWidget style={{ width: 14, height: 14, borderRadius: 7, borderWidth: 1, borderColor: hex('#FFFFFF33') }} />
        </FlexWidget>
      );
    case 'racing':
      // Two short rotated streaks, echoing NightTrack.tsx's diagonal light streaks. Fixed dp
      // widths, not percentages — the library's width prop only accepts a number, 'wrap_content'
      // or 'match_parent', no percentage strings. 130/90dp comfortably fits the widget's declared
      // 320dp default minus its 16dp padding on each side.
      return (
        <FlexWidget style={{ width: 'match_parent', height: 14, flexDirection: 'column', justifyContent: 'center', flexGap: 3 }}>
          <FlexWidget style={{ width: 130, height: 2, backgroundColor: hex('#FFFFFF26'), rotation: -4 }} />
          <FlexWidget style={{ width: 90, height: 2, backgroundColor: hex('#FFFFFF1A'), rotation: -4 }} />
        </FlexWidget>
      );
    case 'witch-purple':
      // Crescent moon (two offset circles, the "biting" one filled with the theme's own surface
      // color so it reads as a notch against this exact background — see NightSky.tsx's
      // moonBase/moonNotch) on one side, a scatter of tiny stars on the other.
      return (
        <FlexWidget style={{ width: 'match_parent', height: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <OverlapWidget style={{ width: 14, height: 14 }}>
            <FlexWidget style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: hex('#EDE3FF22') }} />
            <FlexWidget style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: hex(colors.surface), marginLeft: 5, marginTop: -3 }} />
          </OverlapWidget>
          <FlexWidget style={{ flexDirection: 'row', flexGap: 6, alignItems: 'center' }}>
            {[0, 1, 2].map(i => (
              <FlexWidget key={i} style={{ width: 2, height: 2, borderRadius: 1, backgroundColor: hex('#F1E9FF55') }} />
            ))}
          </FlexWidget>
        </FlexWidget>
      );
    case 'tactical-ops':
      // Same streak treatment as racing, warm-tinted — echoes OpsBackdrop.tsx's diagonal stripes.
      // Same fixed-dp reasoning as racing's case above.
      return (
        <FlexWidget style={{ width: 'match_parent', height: 14, flexDirection: 'column', justifyContent: 'center', flexGap: 3 }}>
          <FlexWidget style={{ width: 130, height: 2, backgroundColor: hex('#FF6A1322'), rotation: -6 }} />
          <FlexWidget style={{ width: 90, height: 2, backgroundColor: hex('#FF6A1315'), rotation: -6 }} />
        </FlexWidget>
      );
    case 'matrix':
      // A handful of static glyphs from MatrixRain.tsx's own alphabet — deliberately NOT
      // animated, NOT re-rolled on redraw (that would be the "periodic update as a trick" this
      // was explicitly asked not to do). brand green vs. surface computes to ~14:1 — see report.
      return (
        <FlexWidget style={{ width: 'match_parent', height: 14, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' }}>
          {MATRIX_ROW_GLYPHS.map((g, i) => (
            <TextWidget key={i} text={g} style={{ fontSize: 10, color: hex(colors.brand), fontFamily: 'monospace' }} />
          ))}
        </FlexWidget>
      );
    default:
      return null;
  }
}

export function HeimligWidget({ data, heightDp }: { data: WidgetData; heightDp?: number }) {
  // 'standard' + darkMode=true reproduces exactly the palette this widget always used before
  // theme-awareness (darkColors, unmodified) — so a missing/unknown theme keeps today's look.
  const themeId = data.themeId ?? 'standard';
  const { colors, isDark } = resolveThemeColors(themeId, data.darkMode ?? true);
  const WIDGET_BG = hex(colors.surface);
  const TILE_BG = hex(colors.surfaceElevated);
  const TILE_BORDER = hex(colors.border);
  const TITLE_COLOR = hex(colors.text);
  const MUTED_COLOR = hex(colors.textSecondary);
  const NUMBER_COLOR = hex(colors.text);

  const gradient = THEME_GRADIENT[themeId];
  const isGothic = themeId === 'gothic';
  const showDecorRow = !data.nextTask && (heightDp ?? 0) >= MIN_HEIGHT_FOR_DECOR_ROW && (!!gradient || themeId === 'matrix');

  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        height: 'match_parent',
        width: 'match_parent',
        ...(gradient ? { backgroundGradient: { from: gradient.from, to: gradient.to, orientation: 'TOP_BOTTOM' } } : { backgroundColor: WIDGET_BG }),
        borderRadius: 16,
        padding: 16,
        flexDirection: 'column',
        justifyContent: 'space-between',
        // Gothic gets a dashed outline instead of a background scene — the App has no dedicated
        // "gothic" backdrop to approximate, so this is its own, cheap treatment.
        ...(isGothic ? { borderWidth: 1.5, borderColor: hex(colors.border), borderStyle: 'dashed' as const } : {}),
      }}
    >
      {/* Header row: badge + title left, weather right (muted, smaller). A single child in a
          space-between row sits at the start on its own, so when there's no weather line this
          naturally leaves just the title on the left — no separate no-weather layout needed. */}
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', flexGap: 6 }}>
          <ThemeBadge themeId={themeId} colors={colors} isDark={isDark} />
          <TextWidget text="Heimlig" style={{ fontSize: 16, color: TITLE_COLOR, fontWeight: 'bold' }} />
        </FlexWidget>
        {!!data.weatherLine && (
          <TextWidget text={data.weatherLine} style={{ fontSize: 12, color: MUTED_COLOR }} maxLines={1} truncate="END" />
        )}
      </FlexWidget>

      {showDecorRow && <DecorRow themeId={themeId} colors={colors} />}

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
