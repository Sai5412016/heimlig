# Heimlig

Haushalts-App für Paare, WGs & Familien — Einkaufslisten, Aufgaben/Kalender, Budget, Rezepte, Gamification.
Live im Google Play Store (`com.fledderman.heimlig`) und als Web-PWA unter [heimlig.vercel.app](https://heimlig.vercel.app).

> Für Business-/Release-Kontext (Play-Store-Flow, Supabase-Projekt-Refs, offene Roadmap) siehe [`CONTEXT.md`](./CONTEXT.md). Dieses README ist die technische Orientierung für Entwickler.

## Tech-Stack

| Bereich | Technologie |
|---|---|
| App-Framework | [Expo SDK 54](https://docs.expo.dev/versions/v54.0.0/) + `expo-router` (file-based Routing), React Native + `react-native-web` |
| Sprache | TypeScript |
| State | [Zustand](https://github.com/pmndrs/zustand) (`store/useStore.ts`, ein zentraler Store) |
| Backend | [Supabase](https://supabase.com) (Postgres, Auth, Row Level Security, Edge Functions) |
| Build | [EAS Build](https://docs.expo.dev/eas/) (Android AAB), Auto-Build bei Push auf `main` via GitHub-Integration |
| Hosting Web | Vercel, Auto-Deploy bei Push auf `main` |
| Error-Tracking | [Sentry](https://sentry.io) (`@sentry/react-native`) |

## Setup

```bash
npm install
```

Lege eine `.env.local` an (wird von Expo automatisch geladen, nicht committen):

```
EXPO_PUBLIC_SUPABASE_URL=https://eabwlyihcmofkbqtbryz.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<siehe eas.json, ist ein öffentlicher anon key, durch RLS abgesichert>
```

Dann:

```bash
npm run start   # Metro Bundler, QR-Code für Expo Go / Dev Client
npm run web     # Web-Version im Browser
npm run android # Android-Emulator/-Gerät
npm run ios     # iOS-Simulator (nur auf macOS)
```

Nach jeder Code-Änderung: `npx tsc --noEmit` sollte fehlerfrei durchlaufen (die paar Fehler in `supabase/functions/**` sind erwartet — `tsc` kennt Deno-Globals nicht, das ist kein Bug).

## Projektstruktur

```
app/                      Screens (Expo Router — Dateiname = Route)
  _layout.tsx              Root: Session-Laden, Deep-Links, Sentry-ErrorBoundary, Update-Check
  onboarding.tsx            Login/Registrierung/Haushalt erstellen oder beitreten
  join/[code].tsx           Einladungslink-Handler
  impressum.tsx, datenschutz.tsx, reset-password.tsx
  (tabs)/                   Haupt-App nach Login (Bottom-Tab-Navigation)
    index.tsx                 Dashboard (Übersicht, Chat, Geburtstage)
    shopping.tsx               Einkaufslisten (mehrere pro Haushalt, Laden-Zuordnung, Rezept-Import, Scanner)
    tasks.tsx                   Aufgaben/Kalender, Gamification, ICS-Import
    budget.tsx                  Budget, CSV-Export/Import, wiederkehrende Transaktionen
    recipes.tsx                 Rezepte (Favoriten, Meal-Planning)
    household.tsx                Mitglieder, Einladung, Multi-Haushalt, Einstellungen
    scan.tsx                     Barcode-Scanner-Screen

store/useStore.ts         Zentraler Zustand-Store — Household/Member-State, Shopping/Tasks/Budget-Actions,
                           lädt Daten via repositories/ und schreibt direkt gegen Supabase wo (noch) kein
                           Repository existiert

repositories/              Kapselt Supabase-Queries pro Domäne (aktuell: shopping, budget — nicht überall
                            konsequent durchgezogen, viele Supabase-Calls liegen noch direkt im Store)

lib/                        Utilities ohne React-Abhängigkeit
  supabase.ts                 Client-Init + alle DB-Typen (Household, Member, ShoppingItem, Task, ...)
  sentry.ts                   Sentry-Init (DSN, Release/Dist-Tagging)
  groceries.ts                 Offline-Artikel-Katalog (Autocomplete + Auto-Kategorie)
  brands.ts                    Crowdsourced Marken pro Supermarkt
  pricing.ts                   Preisschätzung fürs Budget
  gamification.ts              Punkte/Titel-Berechnung
  googleCalendar.ts, ics.ts    Kalender-Sync/-Import
  dataIO.ts                    CSV-Export/Import
  pushTokens.ts, notifications.ts   Push-Registrierung (Expo Push Service) + lokale Erinnerungen
  appUpdate.ts                 Vergleicht app_config.latest_version_code gegen die installierte Version
  changelog.ts, productScore.ts, taskAttachments.ts, alert.ts

components/                 Wiederverwendbare UI-Bausteine & Modals (ein File pro Modal/Feature)
hooks/useTheme.ts           Liefert Farbpalette je nach gewähltem Design + Dark/Light Mode
constants/theme.ts          Design-Tokens (Farben, Spacing, Typografie), APP_THEMES (12 Akzent-Designs)
constants/google.ts         Google-Kalender-OAuth-Konstanten

widgets/                    Android-Homescreen-Widget (react-native-android-widget)
supabase/functions/         Edge Functions: extract-recipe (Rezept-Extraktion via Claude-API),
                             notify-message (Push bei neuer Haushalts-Nachricht via Expo Push Service)
```

## Architektur-Notizen

- **Routing**: Expo Router — jede Datei unter `app/` ist eine Route. `(tabs)` ist eine Route-Group für die
  Bottom-Navigation nach dem Login.
- **State**: Ein einziger Zustand-Store (`store/useStore.ts`, mittlerweile recht groß). Enthält sowohl reinen
  Client-State als auch async Actions, die direkt gegen Supabase schreiben. Neuere Features (Shopping, Budget)
  ziehen die DB-Zugriffe zunehmend in `repositories/` raus — beim Erweitern lieber diesem Muster folgen statt
  neue Supabase-Calls direkt in den Store zu schreiben.
- **Backend**: Kein eigenes Server-Backend — Supabase übernimmt Auth, Datenhaltung und Realtime-Sync zwischen
  Haushaltsmitgliedern. Row Level Security (`is_household_member(household_id)`) sorgt dafür, dass Nutzer nur
  Daten ihres eigenen Haushalts sehen. Ein paar SECURITY-DEFINER-RPCs (`create_household_for_user`,
  `join_household_by_code`, `bump_item_catalog`, ...) kapseln Aktionen, die mehr Rechte brauchen als RLS erlaubt.
  Schema-Änderungen laufen direkt gegen die Live-DB (Supabase-MCP/SQL-Editor), es gibt **keine** lokal
  getrackten Migration-Dateien.
- **Error-Tracking**: `Sentry.wrap()` + `Sentry.ErrorBoundary` in `app/_layout.tsx` fangen Crashes ab und zeigen
  `components/ErrorFallback.tsx` statt eines weißen Bildschirms. DSN liegt in `lib/sentry.ts` (unkritisch, siehe
  Kommentar dort). Für lesbare Stacktraces (Source Maps) fehlt aktuell noch ein `SENTRY_AUTH_TOKEN` im EAS-Build.
- **Mehrsprachigkeit**: Es gibt keine — die App ist komplett auf Deutsch (Du-Form), das ist Absicht, keine Lücke.
- **Web-Eigenheiten**: An ein paar Stellen `Platform.OS === 'web'`-Verzweigungen, meist für Modal-Positionierung
  (Tastatur verdeckt sonst Inhalte) oder native-only APIs (Haptics, Kalender, Kamera).

## Release-Flow

Kurzfassung (Details in `CONTEXT.md`):

1. `android.versionCode` in `app.json` hochzählen.
2. Push auf `main` → EAS-GitHub-Integration baut automatisch ein Android AAB.
3. AAB manuell in der Play Console hochladen und veröffentlichen (Production-Track, App ist live).
4. `app_config.latest_version_code` in Supabase auf den neuen Wert setzen → triggert das In-App-Update-Popup.
5. Web braucht keinen eigenen Build — Vercel deployt automatisch bei jedem Push auf `main`.

## Bekannte Eigenheiten

- Die zwei früher hier liegenden, komplett unabhängigen Projekte (`iron-crotch-trainer`, `real-estate-agent`)
  wurden entfernt — falls sie in älteren Branches/History auftauchen, gehören sie nicht zu Heimlig.
