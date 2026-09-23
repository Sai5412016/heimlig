// widgets/HeimligWidget.tsx — the Android home-screen widget UI (react-native-android-widget).
//
// Per-theme decoration (background wash, header badge, decorative row) — see the report for the
// analysis this is built from. Three hard rules drove every choice below:
// 1. No animation, no periodic redraw to fake one — RemoteViews are a static bitmap per redraw,
//    and "just update it every few minutes" was explicitly rejected as a battery drain, not a
//    workaround.
// 2. Nothing decorative sits behind or beside running text without a precomputed, passing
//    contrast number — see badgeMotifSvg and the per-theme gradient stops below, both chosen
//    from numbers computed against constants/theme.ts's actual palettes, not eyeballed.
// 3. The extra decorative row (skyline bars, streaks, starfield, matrix glyphs, mountains, …)
//    only renders once the widget has real room for it — see MIN_HEIGHT_FOR_DECOR_ROW. At the
//    app's own declared default size (320×110dp) it never appears; only a deliberately
//    resized-taller widget shows it. That is not a bug, it is the fix for the "does it still
//    look fine at the smallest size" question — see the report for which themes this applies to.
//
// Header badges are react-native-android-widget's SvgWidget (small inline SVG strings), not
// image assets. Why that's safe to do at all: this whole widget isn't built from real Android
// RemoteViews method calls under the hood — RNWidget.java (android/src/main/java/com/
// reactnativeandroidwidget/RNWidget.java) builds the entire tree as real, plain android.view.View
// objects off-screen, then rasterizes that view tree to a Bitmap (`rootView.draw(bitmapHolder)`)
// and ships it as one PNG inside an ImageView — only the clickable tap areas and list adapters go
// through actual RemoteViews calls (setOnClickPendingIntent, setRemoteAdapter). So `rotation`
// (BaseWidget.java's setRotation() calls plain `View.setRotation()`, present since API 11) and
// SvgWidget (AndroidSVG rendered into a PictureDrawable, SvgWidget.java) behave exactly like they
// would in a normal foreground screen, on every Android version this app supports — neither is
// constrained by RemoteViews' much smaller @RemotableViewMethod surface. The previous badge
// design avoided rotation anyway out of caution about exactly that restriction; this file's
// history is proof it was never actually at risk (racing/tactical-ops/red-light's DecorRow below
// still use `rotation` unchanged). The real bug that shipped in PR #76 was a design bug, not a
// rendering one: BADGE_SHAPE only ever chose a shape FAMILY (circle vs. square) filled with
// `colors.surfaceElevated` and outlined — literally an empty checkbox for every theme, never
// wired to that theme's actual motif from components/ThemeMotif.tsx.
import React from 'react';
import { FlexWidget, TextWidget, OverlapWidget, SvgWidget } from 'react-native-android-widget';
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
// green monospace glyphs, not a gradient (see MatrixRain.tsx). "dragon-eye" doesn't have an
// in-app full-screen backdrop component yet (see constants/theme.ts's comment on that theme) —
// its stops here are its own, not derived from one, picked to match the same dark-red glow its
// badge/decor sit on.
const THEME_GRADIENT: Record<string, { from: `#${string}`; to: `#${string}` }> = {
  'red-light':    { from: hex('#0F0710'), to: hex('#1A0E14') },
  'comic-hero':   { from: hex('#0B0F1E'), to: hex('#141B33') },
  'pitch-gold':   { from: hex('#0A160C'), to: hex('#0F1D12') },
  racing:         { from: hex('#0A0A0C'), to: hex('#16161A') },
  'witch-purple': { from: hex('#0B0616'), to: hex('#150B24') },
  'tactical-ops': { from: hex('#14171B'), to: hex('#20242A') },
  'dragon-eye':   { from: hex('#140303'), to: hex('#230808') },
};

const BADGE_SIZE = 18;

// One representative glyph from MatrixRain.tsx's own character pool (Katakana + digits) — this
// widget never imports that file (it's animated and this must stay static), just borrows one
// character from the same alphabet so the badge and the app's own rain read as the same idea.
const MATRIX_BADGE_GLYPH = 'ワ';
const MATRIX_ROW_GLYPHS = ['ア', 'ラ', 'ネ', '7', 'ズ'];

// Per-theme header badge motif — a small (24×24 viewBox) inline SVG, loosely modelled on that
// theme's actual shape in components/ThemeMotif.tsx but simplified down to one or two flat shapes
// that still read at 18dp (a tiny multi-part illustration just turns to mud that small). Returns
// null for any theme with no motif simple enough to read there — that theme keeps the 🏡 emoji
// instead (see ThemeBadge below). "alpen" is one of those: its mountains get their own full-size
// background layer (see AlpenMountainBackground) rather than a badge-sized icon.
//
// Ink colors are picked per theme/mode from a real contrast pass against this badge's actual
// background (colors.surface for a flat theme, the gradient's `from` stop for the six gradient
// themes) — see the report for the full table. A few themes need a DIFFERENT ink in light vs.
// dark mode: their `brand` clears the 3:1 non-text floor in only one of the two modes, and in
// every case found here the opposite ink (brandDark, or vice versa) clears the other — same kind
// of mode-dependent fallback the old badge-border logic used to do. Where neither theme color
// works reliably, this falls back to `colors.text`, which is ≥4.5:1 against surface in every
// theme/mode by construction (same invariant the rest of this file already relies on).
function badgeMotifSvg(themeId: string, colors: ColorPalette, isDark: boolean): string | null {
  const pickByMode = (whenLight: string, whenDark: string) => (isDark ? whenDark : whenLight);
  switch (themeId) {
    case 'waldgeist': {
      // Leaf silhouette. brand only clears 3:1 in dark mode (2.92:1 in light); brandDark is the
      // exact mirror image (6.25:1 light, 2.43:1 dark) — pick whichever mode it actually passes.
      const fill = pickByMode(colors.brandDark, colors.brand);
      return `<svg viewBox="0 0 24 24"><path d="M12 21C12 21 4 16 4 9C4 5 8 2 12 2C16 2 20 5 20 9C20 16 12 21 12 21Z" fill="${fill}"/></svg>`;
    }
    case 'inselfreunde':
      // Palm tree (trunk + five fronds), one ink — brand clears 3:1 in both modes (3.52 / 4.31).
      return `<svg viewBox="0 0 24 24">
        <path d="M11 22V12" stroke="${colors.brand}" stroke-width="2" stroke-linecap="round"/>
        <path d="M12 12C12 12 6 9 4 11C4 11 8 14 12 12Z" fill="${colors.brand}"/>
        <path d="M12 12C12 12 18 9 20 11C20 11 16 14 12 12Z" fill="${colors.brand}"/>
        <path d="M12 12C12 12 8 6 5 6C5 6 8 11 12 12Z" fill="${colors.brand}"/>
        <path d="M12 12C12 12 16 6 19 6C19 6 16 11 12 12Z" fill="${colors.brand}"/>
        <path d="M12 12C12 12 10 4 12 2C14 4 12 12 12 12Z" fill="${colors.brand}"/>
      </svg>`;
    case 'blocky': {
      // Two unrounded blocks, same composition as ThemeMotif.tsx's "blocky" case. `accent` only
      // clears 3:1 in light mode (2.60:1 in dark) — colors.text stands in for the small block
      // there instead of a second theme color.
      const second = pickByMode(colors.accent, colors.text);
      return `<svg viewBox="0 0 24 24"><rect x="3" y="3" width="12" height="12" fill="${colors.brand}"/><rect x="13" y="13" width="8" height="8" fill="${second}"/></svg>`;
    }
    case 'battle-royale':
      // Helmet: brand circle, dark visor band, three accent dots — mirrors ThemeMotif.tsx.
      return `<svg viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" fill="${colors.brand}"/>
        <rect x="4" y="14" width="16" height="6" rx="3" fill="#1A1A1A"/>
        <circle cx="8" cy="17" r="1.3" fill="${colors.accent}"/>
        <circle cx="12" cy="17" r="1.3" fill="${colors.accent}"/>
        <circle cx="16" cy="17" r="1.3" fill="${colors.accent}"/>
      </svg>`;
    case 'red-light':
      // The Ampel-Puppe's face — brand circle, two pale eye dots. `accent` as the eye color
      // measures only 1.98:1 against `brand`; colors.text (pale, near-white) clears it (3.87:1).
      return `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="${colors.brand}"/><circle cx="8.5" cy="11" r="1.6" fill="${colors.text}"/><circle cx="15.5" cy="11" r="1.6" fill="${colors.text}"/></svg>`;
    case 'gothic': {
      // Pointed arch. brand clears 3:1 in light (9.90:1) but fails badly in dark (1.53:1) — same
      // theme/mode pair the old badge-border fallback already had to handle; colors.text again.
      const fill = pickByMode(colors.brand, colors.text);
      return `<svg viewBox="0 0 24 24"><path d="M12 2C6 2 4 8 4 13V22H20V13C20 8 18 2 12 2Z" fill="${fill}"/></svg>`;
    }
    case 'comic-hero':
      // Skyline bars — a night skyline reads as lit windows, not a dark cutout, so this uses
      // colors.text (pale) rather than a dark silhouette; accent measured only 2.85:1 here.
      return `<svg viewBox="0 0 24 24">
        <rect x="2" y="14" width="3" height="8" fill="${colors.text}"/>
        <rect x="6" y="9" width="3" height="13" fill="${colors.text}"/>
        <rect x="10" y="12" width="3" height="10" fill="${colors.text}"/>
        <rect x="14" y="6" width="3" height="16" fill="${colors.text}"/>
        <rect x="18" y="11" width="3" height="11" fill="${colors.text}"/>
      </svg>`;
    case 'cinema':
      // Film reel — brand disc, three surface-colored holes (a same-as-background "cutout",
      // same trick witch-purple's moon notch already uses, always safe by construction).
      return `<svg viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" fill="${colors.brand}"/>
        <circle cx="12" cy="7" r="2" fill="${colors.surface}"/>
        <circle cx="7.5" cy="14.5" r="2" fill="${colors.surface}"/>
        <circle cx="16.5" cy="14.5" r="2" fill="${colors.surface}"/>
      </svg>`;
    case 'sparkle-pop':
      // Four-point sparkle, one ink (brand clears both modes: 3.24 / 4.69) — simpler and more
      // legible at 18dp than the two-color version ThemeMotif.tsx uses at full app size.
      return `<svg viewBox="0 0 24 24"><path d="M12 2L14 10L22 12L14 14L12 22L10 14L2 12L10 10Z" fill="${colors.brand}"/></svg>`;
    case 'moody': {
      // Sunglasses. brand only clears 3:1 in dark mode (1.88:1 in light); brandDark mirrors it
      // (6.09:1 light, 2.49:1 dark) — same mode-swap pattern as waldgeist above.
      const fill = pickByMode(colors.brandDark, colors.brand);
      return `<svg viewBox="0 0 24 24"><rect x="2" y="9" width="8" height="6" rx="3" fill="${fill}"/><rect x="14" y="9" width="8" height="6" rx="3" fill="${fill}"/><rect x="10" y="11" width="4" height="1.5" fill="${fill}"/></svg>`;
    }
    case 'pitch-gold':
      // Center-circle ring + dot, accent (gold) clears the gradient background comfortably (8.81:1).
      return `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="${colors.accent}" stroke-width="2"/><circle cx="12" cy="12" r="1.6" fill="${colors.accent}"/></svg>`;
    case 'racing':
      // Simplified side-profile car — brand clears the gradient background, if narrowly (3.18:1).
      return `<svg viewBox="0 0 24 24">
        <rect x="3" y="11" width="18" height="5" rx="2.5" fill="${colors.brand}"/>
        <path d="M7 11L9 7H15L17 11Z" fill="${colors.brand}"/>
        <circle cx="7.5" cy="17" r="2.3" fill="#1A1A1A"/>
        <circle cx="16.5" cy="17" r="2.3" fill="#1A1A1A"/>
      </svg>`;
    case 'monster-fang':
      // Two-tone capsule — brand top arc, surface-colored bottom (blends into the background,
      // same cutout trick as cinema's reel holes), dark band, accent center dot.
      return `<svg viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" fill="${colors.surface}"/>
        <path d="M2 12A10 10 0 0 1 22 12Z" fill="${colors.brand}"/>
        <rect x="2" y="10.5" width="20" height="3" fill="#1A1A1A"/>
        <circle cx="12" cy="12" r="3" fill="${colors.accent}" stroke="#1A1A1A" stroke-width="1"/>
      </svg>`;
    case 'witch-purple':
      // Crescent moon, colors.text (pale) — comfortably clears the gradient background (16.96:1).
      return `<svg viewBox="0 0 24 24"><path d="M14 2C8 2 4 6.5 4 12C4 17.5 8 22 14 22C10 19 8 16 8 12C8 8 10 5 14 2Z" fill="${colors.text}"/></svg>`;
    case 'tactical-ops':
      // Crosshair/reticle, brand clears the gradient background well (6.27:1).
      return `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="none" stroke="${colors.brand}" stroke-width="2"/><path d="M12 1V6M12 18V23M1 12H6M18 12H23" stroke="${colors.brand}" stroke-width="2"/></svg>`;
    case 'dragon-eye':
      // Plain abstract eye — ring, iris, pupil, highlight, two lash rays — no tomoe/comma shapes,
      // same "inspired by a mood, not a specific franchise symbol" rule as every other theme here.
      // brandLight (ring/rays) and brand (iris) both clear the gradient background comfortably
      // (7.21:1 / 4.25:1); accent (highlight) even more so (15.40:1). brandDark is never used
      // here — see constants/theme.ts's comment on this theme for why.
      return `<svg viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" fill="none" stroke="${colors.brandLight}" stroke-width="1.2"/>
        <line x1="3" y1="8" x2="6.5" y2="10.5" stroke="${colors.brandLight}" stroke-width="1.2" stroke-linecap="round"/>
        <line x1="21" y1="8" x2="17.5" y2="10.5" stroke="${colors.brandLight}" stroke-width="1.2" stroke-linecap="round"/>
        <circle cx="12" cy="12" r="6" fill="${colors.brand}"/>
        <circle cx="12" cy="12" r="2.6" fill="#0A0202"/>
        <circle cx="14.3" cy="9.7" r="1.1" fill="${colors.accent}"/>
      </svg>`;
    default:
      return null;
  }
}

function ThemeBadge({ themeId, colors, isDark }: { themeId: string; colors: ColorPalette; isDark: boolean }) {
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
  const svg = badgeMotifSvg(themeId, colors, isDark);
  if (!svg) {
    // "standard", "alpen" (its mountains live in the background layer instead), and any future
    // theme with no motif simple enough to read at 18dp — the 🏡 emoji, same as it always was, is
    // a better badge than another generic shape (see the file header).
    return <TextWidget text="🏡" style={{ fontSize: 16 }} />;
  }
  return <SvgWidget svg={svg} style={{ width: BADGE_SIZE, height: BADGE_SIZE }} />;
}

// The extra decorative row between the header and the tiles — only for the seven gradient themes
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
    case 'dragon-eye':
      // Same ring+pupil grammar as PitchGold's center-circle treatment above, just red-tinted —
      // brandLight (ring) and brand (pupil) both clear the gradient background comfortably.
      return (
        <FlexWidget style={{ width: 'match_parent', height: 14, alignItems: 'center', justifyContent: 'center' }}>
          <FlexWidget style={{ width: 14, height: 14, borderRadius: 7, borderWidth: 1, borderColor: hex(colors.brandLight), alignItems: 'center', justifyContent: 'center' }}>
            <FlexWidget style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: hex(colors.brand) }} />
          </FlexWidget>
        </FlexWidget>
      );
    default:
      return null;
  }
}

// Alpen's mountains as a full-size BACKGROUND layer, visible at every widget size (not gated
// behind MIN_HEIGHT_FOR_DECOR_ROW like every other theme's extra decoration) — an earlier version
// of this put them in a footer row that only appeared once the widget was resized taller, which
// left the default/minimum size (320×110dp) showing a plain white card. Rendered inside an
// OverlapWidget (see HeimligWidget below): this is layer 1, docked to the bottom, full-bleed;
// the header/tiles/pin-line content stacks on top of it as layer 2, with a translucent tile
// background so the mountains show through underneath the tiles instead of being fully hidden
// (see ALPEN_TILE_BG's own comment for the contrast math behind that specific opacity).
//
// Height: clamp(36, round(heightDp * 0.35), 70) — scales with the widget but never shrinks below
// a legible sliver or grows tall enough to crowd the tiles at a small widget height. heightDp
// falls back to 110 (app.json's declared default/minimum) when the host hasn't reported a real
// size yet, same convention MIN_HEIGHT_FOR_DECOR_ROW's own comment already uses elsewhere in this
// file. At 110dp: round(110*0.35)=39, inside [36,70] → 39dp. At 180dp: round(180*0.35)=63dp.
//
// Width: explicit widthDp (WidgetInfo.width, dp) on both the SvgWidget's own layout style AND the
// raw <svg width="…">  attribute, with viewBox="0 0 100 20" and preserveAspectRatio="none" on the
// root <svg> — SvgWidget is a plain ImageView under the hood (see the file header) with Android's
// default FIT_CENTER scaleType, which does NOT stretch a mismatched aspect ratio to fill, only
// preserves it (letterboxing at most widget widths otherwise, see the report's Risiken section).
// Setting the <svg>'s own width/height to the actual current widget width makes AndroidSVG itself
// do the non-uniform stretch of the 100:20 viewBox into that exact box at render time — the
// Picture it hands to the ImageView already has the right final size, so FIT_CENTER afterwards is
// a no-op instead of a second (wrong) fit pass. Falls back to 320dp (app.json's declared default
// width) on a missing/zero widthDp, same treatment as the height fallback above.
//
// Colors: two blue tones, the back ridge (two shorter peaks) lighter and the front ridge (the
// tallest, snow-capped peak) darker — "hinten heller". Dark mode shifts both one step darker
// ("im Darkmode dunklere Töne"): the front peak's dark-mode color (#15325A) isn't one of alpen's
// four defined theme colors (brand/brandLight/brandDark/accent all already spoken for elsewhere,
// and brandDark is needed as the LIGHT-mode front peak), so this is one hand-picked custom hex, a
// darker step in the same "Himmel tief" blue family — contrast-checked against alpen's own fixed
// white surface like everything else here (12.84:1, see the report). brandLight was tried first
// for the light-mode back peak but only clears 2.69:1 against white — brand/brandDark (which both
// clear 3:1, 5.15:1 and 9.33:1) are used for the two ridges instead, still lighter-vs-darker
// relative to each other even though neither is literally "brandLight".
function alpenMountainSvg(colors: ColorPalette, isDark: boolean, widthDp: number, mountainHeightDp: number): string {
  const backFill = isDark ? colors.brandDark : colors.brand;
  const frontFill = isDark ? '#15325A' : colors.brandDark;
  return `<svg width="${widthDp}" height="${mountainHeightDp}" viewBox="0 0 100 20" preserveAspectRatio="none">
    <path d="M0 20L20 8L38 18L58 6L78 17L100 12L100 20L0 20Z" fill="${backFill}"/>
    <path d="M0 20L25 16L50 2L75 16L100 20Z" fill="${frontFill}"/>
    <path d="M50 2L57 9L43 9Z" fill="${colors.surface}"/>
  </svg>`;
}

function AlpenMountainBackground({ colors, isDark, heightDp, widthDp }: { colors: ColorPalette; isDark: boolean; heightDp?: number; widthDp?: number }) {
  const effectiveHeightDp = heightDp && heightDp > 0 ? heightDp : 110;
  const effectiveWidthDp = widthDp && widthDp > 0 ? widthDp : 320;
  const mountainHeightDp = Math.min(70, Math.max(36, Math.round(effectiveHeightDp * 0.35)));
  const svg = alpenMountainSvg(colors, isDark, effectiveWidthDp, mountainHeightDp);
  return (
    <FlexWidget style={{ width: 'match_parent', height: 'match_parent', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <SvgWidget svg={svg} style={{ width: effectiveWidthDp, height: mountainHeightDp }} />
    </FlexWidget>
  );
}

// Alpen's tile background needs to be translucent so the mountain layer behind it (see
// AlpenMountainBackground above) actually shows through — but the tile captions use
// colors.textSecondary, and worst-case (text sitting over the darkest front peak, dark mode:
// #15325A) that dropped below the required 4.5:1 at the 0.85 opacity first tried: 4.22:1,
// measured, not assumed. 0.92 clears it in every measured case (light front peak 4.89:1, dark
// front peak 4.84:1, dark back peak 4.89:1, light back peak 5.01:1, no overlap 5.59:1) — see the
// report for the full table. The main number text (colors.text) was never at risk (7.39–9.80:1
// across the same cases) but is included in that same measured pass for completeness.
const ALPEN_TILE_BG = 'rgba(255, 255, 255, 0.92)';

export function HeimligWidget({ data, heightDp, widthDp }: { data: WidgetData; heightDp?: number; widthDp?: number }) {
  // 'standard' + darkMode=true reproduces exactly the palette this widget always used before
  // theme-awareness (darkColors, unmodified) — so a missing/unknown theme keeps today's look.
  const themeId = data.themeId ?? 'standard';
  const { colors, isDark } = resolveThemeColors(themeId, data.darkMode ?? true);
  const WIDGET_BG = hex(colors.surface);
  const TILE_BG = themeId === 'alpen' ? ALPEN_TILE_BG : hex(colors.surfaceElevated);
  const TILE_BORDER = hex(colors.border);
  const TITLE_COLOR = hex(colors.text);
  const MUTED_COLOR = hex(colors.textSecondary);
  const NUMBER_COLOR = hex(colors.text);

  const gradient = THEME_GRADIENT[themeId];
  const isGothic = themeId === 'gothic';
  const showDecorRow = !data.nextTask && (heightDp ?? 0) >= MIN_HEIGHT_FOR_DECOR_ROW && (!!gradient || themeId === 'matrix');

  // Alpen: mountains as a background layer behind the header/tiles/pin-line, visible at every
  // size — not gated behind MIN_HEIGHT_FOR_DECOR_ROW like showDecorRow above (see
  // AlpenMountainBackground's own comment for why). This is its own separate render path (the
  // OverlapWidget structure only applies here) rather than a themeId branch woven into the single
  // return below, specifically so the other 15 themes' own render path stays byte-for-byte what
  // it already was.
  if (themeId === 'alpen') {
    return (
      <OverlapWidget
        clickAction="OPEN_APP"
        style={{ width: 'match_parent', height: 'match_parent', borderRadius: 16, backgroundColor: WIDGET_BG, overflow: 'hidden' }}
      >
        <AlpenMountainBackground colors={colors} isDark={isDark} heightDp={heightDp} widthDp={widthDp} />
        <FlexWidget style={{ width: 'match_parent', height: 'match_parent', flexDirection: 'column', justifyContent: 'space-between', padding: 16 }}>
          <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', flexGap: 6 }}>
              <ThemeBadge themeId={themeId} colors={colors} isDark={isDark} />
              <TextWidget text="Heimlig" style={{ fontSize: 16, color: TITLE_COLOR, fontWeight: 'bold' }} />
            </FlexWidget>
            {!!data.weatherLine && (
              <TextWidget text={data.weatherLine} style={{ fontSize: 12, color: MUTED_COLOR }} maxLines={1} truncate="END" />
            )}
          </FlexWidget>

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

          {!!data.nextTask && (
            <TextWidget text={`📌 ${data.nextTask}`} style={{ fontSize: 11, color: MUTED_COLOR }} maxLines={1} truncate="END" />
          )}
        </FlexWidget>
      </OverlapWidget>
    );
  }

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
