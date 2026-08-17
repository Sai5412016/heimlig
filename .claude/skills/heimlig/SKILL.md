---
name: heimlig
description: "MUSS für ALLE Arbeit an heimlig gelesen werden — der Haushalts-App für Paare, WGs und Familien (Einkaufslisten, Aufgaben/Kalender, Budget, Rezepte, Gamification) von Gut Feeling Labs. Greift bei jeder Änderung in diesem Repo — Expo/React-Native/expo-router-Screens, Supabase-Schema und -Migrationen, RLS-Policies, Edge Functions (extract-recipe, extract-receipt, extract-event, notify-message, verify-purchase), i18n-Strings in lib/locales, Zustand-Store, Themes. Ebenso bei allem rund um Geld und Auslieferung — Play-Store-Release, EAS-Build, versionCode-Bump, app_config, Billing mit expo-iap, Abo heimlig_premium_monthly, Premium-Gates, hasPremiumAccess, grandfathered-Bestandsschutz, Mitglieder-Limit, Store-Listing und Screenshots. Enthält Stack, Konventionen, feste Kategorie-Kataloge, Release-Flow, Definition of Done und aktuelle Blocker. Auch bei scheinbar kleinen Änderungen zuerst lesen — die Kataloge und Gates sind an mehreren Stellen gespiegelt und brechen sonst still."
---

# heimlig — Projekt-Skill

Haushalts-App für Paare, WGs, Familien. Firma **Gut Feeling Labs**, Macher **Andreas Schilling ("Andi")**.
App-Sprachen **DE + EN**, Du-Form, locker, Zielgruppe 18+. Dunkles mobile-first Design, Markengrün `#2D6A4F`.
Live im Play Store. Repo `Sai5412016/heimlig`, Branch `main`.

> `CONTEXT.md` im Repo-Root ist die Historie ("warum wurde das so gebaut"). Dieser Skill ist der
> aktuelle Stand ("wie ist es gebaut"). Bei Widerspruch gewinnt der Code, danach dieser Skill.

## Arbeitsweise (wichtig)

Der Betreiber ist **kein ausgebildeter Entwickler**. Deshalb verbindlich:

- Schritte **vollständig ausschreiben**. Keine Abkürzungen wie "wie gehabt" oder "Standard-Flow".
- **Exakte Datei- und Klickpfade** nennen (`app/(tabs)/budget.tsx`, "Play Console → Monetarisierung → Produkte → Abos").
- Dateien **unter ca. 300 Zeilen vollständig ausgeben** statt Snippets. Bei größeren Dateien den vollständigen geänderten Block plus Zeilennummer.
- Nach jeder Code-Änderung immer drei Dinge liefern: **Testschritte**, **erwartetes Ergebnis**, **wahrscheinlichste Fehlerquelle**.
- Keine Fachbegriffe ohne einen Halbsatz Erklärung beim ersten Vorkommen.
- Nichts als "fertig" melden, was die **Definition of Done** unten nicht erfüllt.

## Stack

- **Expo SDK 54** (`expo ~54.0.34`), **expo-router 6**, React Native `0.81.5`, React `19.1.0`, `newArchEnabled: true`
- **Web**: `react-native-web ^0.21.0`, Auslieferung über **Vercel**, Auto-Deploy bei Push auf `main`, `vercel.json` = SPA-Rewrite auf `/index.html`
- **Supabase** (Postgres + Auth + RLS + Edge Functions), Projekt-Ref `eabwlyihcmofkbqtbryz`
- **State**: `zustand ^5.0.14`, ein einziger Store in `store/useStore.ts`
- **i18n**: `i18next ^26.3.6` + `react-i18next ^17.0.9` + `expo-localization`
- **Billing**: `expo-iap ^5.0.0` (react-native-iap ist archiviert, expo-in-app-purchases tot)
- **Monitoring**: `@sentry/react-native ^8.17.2`, Init in `lib/sentry.ts`, ErrorBoundary in `app/_layout.tsx`
- **Build**: EAS, Expo-Account `fledderman`, Package `com.fledderman.heimlig`
- **Android-Widget**: `react-native-android-widget`, Code in `widgets/`
- **TS**: `tsconfig.json` erweitert `expo/tsconfig.base`, `strict: true`
- **Kein ESLint, kein Prettier, keine Tests** im Repo. Einzige Prüfung ist `npx tsc --noEmit`
- `package.json`-Scripts sind nur `start` / `android` / `ios` / `web` — es gibt **kein** `npm run lint` / `test` / `typecheck`

## Projektstruktur

- `app/_layout.tsx` — Root-Layout: Session-Check, `onAuthStateChange`-Listener (Redirect bei Session-Verlust), Deep-Link `heimlig://join/CODE`, Orientierung (Handy Portrait, Tablet frei), Update-Check, Billing-Init
- `app/onboarding.tsx` — Registrierung/Login, Haushalt anlegen oder beitreten, Locale-Erkennung (Währung/Zeitzone/Land)
- `app/(tabs)/_layout.tsx` — Tab-Navigator plus Theme-Backdrops und -Sprites
- `app/(tabs)/index.tsx` — Start ("Start"), Dashboard-Kacheln, Pinnwand
- `app/(tabs)/shopping.tsx` — Einkauf, mehrere Listen (`ListPickerModal`), Artikel-Autocomplete
- `app/(tabs)/scan.tsx` — "Gesund", Barcode-Scan, Produkt-Score
- `app/(tabs)/recipes.tsx` — Rezepte, Favoriten, Essensplanung
- `app/(tabs)/tasks.tsx` — Aufgaben/Kalender, Gamification, ICS- und TimeTree-Import
- `app/(tabs)/budget.tsx` — Budget, CSV-Export/Import, wiederkehrende Buchungen
- `app/(tabs)/household.tsx` — Mitglieder, Einladung, Haushalts-Switcher, alle Einstellungen, Abmelden
- `app/join/[code].tsx`, `app/reset-password.tsx`, `app/impressum.tsx`, `app/datenschutz.tsx` — Einzel-Routen
- `lib/supabase.ts` — Supabase-Client plus **alle** TS-Interfaces der DB-Zeilen
- `lib/premium.ts` — `hasPremiumAccess()`, Mitglieder-Limits, `isMemberLimitError()`
- `lib/billing.ts` — expo-iap-Anbindung, Kauf, Wiederherstellen, Server-Verifikation
- `lib/pricing.ts` — Preis-**Schätzung** für den Einkaufswagen (Durchschnittspreise, keine Live-API)
- `lib/budgetCategories.ts` — fester Budget-Kategorie-Katalog plus Emojis, Farben, `categoryLabel()`
- `lib/i18n.ts` + `lib/locales/{de,en,types}.ts` — Übersetzungen
- `lib/gamification.ts` — Punkte pro Aufgabe, Titel-Stufen, `SHARE_POINTS`
- `lib/shareTemplates.ts` — vorformulierte Social-Media-Sätze, bewusst **ohne** Nutzerdaten
- Weitere `lib/`-Module: `alert.ts` (plattformübergreifender Alert-Wrapper), `appUpdate.ts` (`app_config`-Check), `brands.ts`, `changelog.ts`, `currency.ts`, `dataIO.ts` (CSV), `dateMath.ts`, `googleCalendar.ts`, `groceries.ts`, `holidays.ts`, `ics.ts`, `notifications.ts`, `productScore.ts`, `pushTokens.ts`, `receiptAttachments.ts`, `recipeAttachments.ts`, `screenshotTool.ts` (Owner-only, nur Web), `taskAttachments.ts`, `timetreeEvents.ts`, `timezones.ts`
- `repositories/` — `shoppingRepository.ts`, `budgetRepository.ts`: dünne Datenzugriffsschicht, damit Store/UI nicht direkt mit Supabase spricht
- `store/useStore.ts` — zentraler Zustand-Store, inklusive `resetSession()` (leert alles Nutzer-/Haushaltsbezogene beim Abmelden)
- `hooks/useTheme.ts` — liefert `{ colors, isDark }` aus `darkMode` + `themeId`
- `constants/theme.ts` — `lightColors`, `darkColors`, `APP_THEMES` (17 Einträge, 7 davon `forceDark`), `CATEGORY_COLORS`, `SHOPPING_CATEGORIES`, `spacing`, `radius`, `typography`, `motion`
- `constants/google.ts` — Google-Kalender-Konfiguration
- `components/` — Modals und Theme-Deko; Backdrops (`MatrixRain`, `PitchField`, `NightSky`, `NightTrack`, `OpsBackdrop`, `CitySkyline`, `ArenaBackdrop`) und Sprites (`PitchBall`, `FlyingWitch`, `RacingCar`, `BulletTracers`, `FlyingHero`, `RedLightDoll`)
- `supabase/functions/` — 5 Edge Functions: `extract-recipe`, `extract-receipt`, `extract-event`, `notify-message`, `verify-purchase`
- `supabase/manual_migrations/` — SQL zum **manuellen** Ausführen; Schema wird nicht als echte Migrations-Historie getrackt
- `eas.json` — Profile `development`, `preview` (APK), `production` (AAB); Supabase-URL und Publishable Key stehen dort als `EXPO_PUBLIC_*`-Env
- `.github/workflows/eas-build.yml` — startet EAS-Production-Build bei Push auf `main`, **aber nur wenn `app.json` geändert wurde** (`paths`-Filter), plus manuell per `workflow_dispatch`
- `graphify-out/` — automatisch erzeugte Code-Struktur-Karte, gitignored, nie als Wahrheit über Historie nutzen

## Supabase-Client-Setup

- `lib/supabase.ts` liest `process.env.EXPO_PUBLIC_SUPABASE_URL` und `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- Session-Storage: `localStorage` auf Web, `AsyncStorage` auf Native
- `autoRefreshToken: true`, `persistSession: true`, **`detectSessionInUrl: false`** — der Passwort-Reset-Flow verarbeitet die Tokens selbst in `app/reset-password.tsx`, deshalb darf der Client die URL nicht anfassen
- Realtime auf 10 Events/Sekunde begrenzt

## Konventionen

- **Naming**: Routen kleingeschrieben (`app/(tabs)/budget.tsx`), Komponenten PascalCase (`components/PremiumModal.tsx`), `lib/`- und `repositories/`-Module camelCase
- **Sprache im Code**: Kommentare und Commit-Messages Englisch, UI-Strings über `t()`, Datenwerte in der DB bleiben deutsche Schlüssel
- **Daten vs. Anzeige (zentrales Prinzip)**: Kategorien und ähnliche Kataloge werden als **deutsche Schlüssel** gespeichert und erst in der UI übersetzt (`categoryLabel(t, key)` mit `defaultValue: key`). Niemals übersetzte Werte in die DB schreiben — sonst brechen Filter, Farben und Emojis, und die Anzeige fällt auf den Rohtext zurück
- **State**: alles Gemeinsame in `store/useStore.ts`; lokaler UI-Zustand mit `useState` im Screen. Neue haushaltsbezogene Felder **immer** auch in `resetSession()` eintragen
- **Datenzugriff**: neue Lese-/Schreibfunktionen für Einkauf und Budget gehören in `repositories/`, nicht direkt in den Screen
- **Theme**: Farben ausschließlich über `useTheme()`, niemals Hex-Werte im Screen. Styles über `makeStyles(colors)` plus `useMemo`
- **Web-Fixes** mit `Platform.OS === 'web'` kennzeichnen (z. B. Modals oben verankern, damit die Tastatur nichts verdeckt)
- **Alerts** über `lib/alert.ts`, nicht direkt `react-native`s `Alert` (Web-Kompatibilität)
- **Nach jeder Änderung**: `npx tsc --noEmit`. Es gibt bekannte, **vorbestehende** Fehler in `supabase/functions/*` (Deno-Imports und `Deno`-Namespace sind dem RN-tsconfig unbekannt) — die herausfiltern und nicht als Regression melden

### Neuen Screen oder Route anlegen

1. Datei unter `app/` anlegen; im Tab-Bereich `app/(tabs)/<name>.tsx`, sonst `app/<name>.tsx`
2. Bei neuem Tab: `<Tabs.Screen name="<name>" ... />` in `app/(tabs)/_layout.tsx` ergänzen, Label über `t('tabs.<name>')`
3. Bei neuer Nicht-Tab-Route: `<Stack.Screen name="<name>" />` in `app/_layout.tsx` ergänzen
4. Im Screen: `const { colors } = useTheme();`, `const { t } = useTranslation();`, `const styles = useMemo(() => makeStyles(colors), [colors]);`
5. Alle Texte durch `t()` — keine hartcodierten Strings

### Strings in i18n eintragen

1. Key in `lib/locales/types.ts` ins `AppTranslations`-Interface aufnehmen
2. Denselben Key in `lib/locales/de.ts` **und** `lib/locales/en.ts` füllen
3. Fehlt ein Key in einer Sprache, ist das dank des Interfaces ein **TypeScript-Fehler** — das ist die Absicht
4. In `.tsx` über den Hook `useTranslation()`, in reinen `lib/*.ts`-Modulen ohne React-Baum über `i18n.t()` direkt
5. Bewusst **deutsch belassen** (Daten, keine UI-Chrome): Impressum und Datenschutz (rechtlich gebunden), Artikel-Katalog `lib/groceries.ts`, Marken- und Supermarktnamen `lib/brands.ts`, CSV-Export-Header `lib/dataIO.ts`. Feiertagsnamen in `lib/holidays.ts` stehen je Land in der Landessprache

### Neue Tabelle anbinden

1. SQL in `supabase/manual_migrations/JJJJ-MM-TT_<thema>.sql` schreiben (dokumentiert die Absicht)
2. Über Supabase-MCP `apply_migration` anwenden oder im SQL-Editor ausführen
3. **`alter table ... enable row level security;` plus Policies** — ohne RLS ist die Tabelle für alle offen. Muster: Zugriff über `is_household_member(household_id)`, Admin-Aktionen über `is_household_admin(household_id)`
4. TS-Interface in `lib/supabase.ts` ergänzen
5. Lade- und Schreibfunktionen in `store/useStore.ts` (oder `repositories/`), neues Feld in `resetSession()` eintragen
6. RLS aus der App heraus prüfen: einmal als Mitglied, einmal als Fremder — nicht nur mit Service-Role testen

## Feste Kataloge — nicht eigenmächtig ändern

Diese Werte stehen so in Bestandsdaten. Ändern nur nach Rückfrage und mit Datenmigration.

**`shopping_items.category`** (Quelle `constants/theme.ts` → `CATEGORY_COLORS` / `SHOPPING_CATEGORIES`):
`Lebensmittel`, `Obst & Gemüse`, `Tiefkühl`, `Fleisch & Fisch`, `Drogerie`, `Backwaren`, `Getränke`, `Sonstiges`
→ **kein** `Haushalt` (das ist eine Aufgaben-/Budget-Kategorie). Putzmittel gehören unter `Drogerie`.

**Rezept-Typen `recipes.category`** (Quelle `app/(tabs)/recipes.tsx` → `RECIPE_CATEGORIES`):
`Hauptgericht`, `Backen & Dessert`, `Frühstück`, `Salat & Beilage`, `Suppe`, `Snack`, `Getränk`, `Sonstiges`
→ Das sind **Gericht-Typen, keine Tageszeiten**. "Abendessen"/"Mittagessen" existieren hier nicht. Tageszeit ist ein separates Feld: `meal_plans.meal_type` mit `fruehstueck` / `mittag` / `abendessen`.

**Budget-Kategorien** (Quelle `lib/budgetCategories.ts` → `CAT_EMOJIS`):
`Lebensmittel`, `Miete`, `Transport`, `Freizeit`, `Gesundheit`, `Kleidung`, `Haushalt`, `Kinder`, `Haustiere`, `Sparen`, `Restaurant`, `Urlaub`, `Elektronik`, `Sport`, `Sonstiges`
→ **kein** `Wohnen`. Strom, Miete und Nebenkosten laufen unter `Miete`.

**Aufgaben-Kategorien**: punktebringend sind nur `Haushalt`, `Einkauf`, `Wartung`, `Garten` (`HOUSEHOLD_CATEGORIES`, **doppelt** definiert in `store/useStore.ts` und `app/(tabs)/tasks.tsx` — beide gleich halten). `Geburtstag` ist von der Punktewertung ausgenommen.

## Definition of Done

Ohne erfüllte Kriterien nichts als "fertig" melden, sondern das offene Kriterium benennen.

**Feature fertig, wenn:**
- in `main` gemergt
- auf echtem Android-Gerät getestet (nicht Expo Go, nicht nur Web)
- DE- und EN-Strings vorhanden
- RLS-Policy für neue Tabellen gesetzt und geprüft
- `versionCode` in `app.json` erhöht

**Release fertig, wenn:**
- EAS-Build hochgeladen und in der Play Console freigegeben
- `app_config.latest_version_code` in Supabase gesetzt
- Versionshinweise im `<de-DE>`-Feld der Play Console eingetragen — das ersetzt die frühere
  Ankündigungsmail an die Tester-Google-Group, die seit dem Production-Release entfällt

**Bugfix fertig, wenn:**
- Ursache benannt statt nur Symptom weg
- Reproduktionsschritt vor dem Fix dokumentiert
- derselbe Schritt danach erfolgreich

**Meilenstein Umsatz erreicht, wenn:**
- ein Kauf von einem Konto, das weder dem Betreiber gehört noch Tester ist, in `purchases` als verifiziert liegt

## Bekannte offene Punkte und Blocker

**BLOCKER — `verify-purchase` liefert keinen bestätigten Kauf.**
Play Developer API `purchases.subscriptionsv2.get` antwortet mit HTTP 401 `permissionDenied`.
Bereits ausgeschlossen: Cloud-Projekt existiert, Google Play Android Developer API aktiviert,
Service-Account hat App- und Kontoberechtigungen in der Play Console, Secret ist gesetzt,
Package-Name stimmt mit `app.json` überein, Endpunkt ist der richtige (Abo, nicht Einmalkauf).
Ursache offen. Details und Diagnose-Reihenfolge in `references/billing.md`.

**Deploy-Stand der Edge Functions prüfen, bevor Logs interpretiert werden.**
Ein Deploy aus einem Verzeichnis ohne den aktuellen Branch schiebt alten Code hoch; die
Versionsnummer zählt trotzdem hoch. Mit Supabase-MCP `get_edge_function` den echten
deployten Quelltext holen und mit `main` vergleichen. Das hat schon einmal eine halbe
Fehlersuche gekostet.

**`app_config.latest_version_code` ist veraltet.** Steht auf `50`, `app.json` ist bei `73`.
Der In-App-Update-Hinweis feuert dadurch nicht. Nach dem nächsten Play-Store-Upload nachziehen.

**`lib/billing.ts`** — `initBilling(householdId)` friert die Haushalts-ID einmalig im
`purchaseUpdatedListener`-Closure ein (`connected`-Guard verhindert erneutes Init). Wechselt der
Nutzer danach den Haushalt, läuft die Verifikation gegen die alte ID; ist die ID falsy, wird
`verifyAndFinish` nie aufgerufen. Noch nicht gefixt.

**Kaufdialog zeigte 3,59 € statt 2,99 €** — Preis in der Play Console vermutlich netto gesetzt.
Nicht im Repo prüfbar, gehört in die Play Console.

**Zweiter Haushalt lässt sich nicht anlegen.** `create_household_for_user` wird nur in
`app/onboarding.tsx` aufgerufen (verifiziert). Wer schon Mitglied ist, kann über die UI zwar
**beitreten** (`join_household_by_code` in `onboarding.tsx`, `app/join/[code].tsx`,
`app/(tabs)/household.tsx`), aber keinen neuen Haushalt **erstellen**.

**Demo-Haushalte für Store-Screenshots** (nur Anzeigedaten, Platzhalter-Auth-User auf
`.invalid`-Domain, kein Login möglich):
- `Familie Berger` — `6b0d45a7-cff4-41d0-80e3-14f6861124ce` (deutsch)
- `Berger Family` — `3437ed67-9667-412b-a888-f9d98e255e7f` (englisch)
Beide auf `plan_tier = 'premium'`. **Vor Veröffentlichung Einladungscode ersetzen**, danach
Haushalt löschen oder Code neu generieren.

**Roadmap:** Google-Kalender-OAuth-Sync (ICS-Import existiert bereits); Store-Marketing mit
7 neuen DE-Screenshots, danach EN-Lokalisierung mit keyword-optimiertem Eintrag.
Abo-Downgrade bei Kündigung oder Ablauf ist **nicht** implementiert (bräuchte Real-time
Developer Notifications).

## Nicht anfassen ohne Rückfrage

- **Feste Kataloge** oben — Bestandsdaten hängen an den Werten
- **`hasPremiumAccess()` in `lib/premium.ts`** — dieselbe Bedingung ist in
  `supabase/functions/extract-recipe/index.ts` und im Trigger `enforce_member_limit()` gespiegelt.
  Ändern heißt: an allen drei Stellen ändern
- **Zahlen der Feature-Gates** (3/6 Mitglieder, 3 Rezept-Importe pro Monat)
- **`supabase/functions/verify-purchase/index.ts`** — sicherheitskritisch, verhindert
  Gratis-Premium per gefälschtem Token. Der 503-Text `billing verification not configured yet`
  wird von `translateVerifyError()` in `lib/billing.ts` per exaktem String-Vergleich ausgewertet
- **RLS-Policies, `is_household_member`, `is_household_admin`, SECURITY-DEFINER-RPCs**
  (`create_household_for_user`, `join_household_by_code`, `bump_item_catalog`,
  `bump_member_score`, `send_daily_digest`) und der Trigger
  `trg_prevent_member_field_escalation` — dort steckt die Absicherung gegen fremde Haushalte
- **`app.json`** `package`, `versionCode`, `googleServicesFile`, Plugin-Liste
- **`detectSessionInUrl: false`** in `lib/supabase.ts` — Umstellen bricht den Passwort-Reset
- **Direkt auf `main` pushen** — Feature-Arbeit läuft über Branch und PR. Ausnahme sind reine
  `versionCode`-Bumps auf ausdrückliche Anweisung
- **Produktionsdaten** — nur streng auf eine `household_id` gescopt und mit Guard, der abbricht,
  falls Name und ID nicht zusammenpassen
- **Theme-Komponenten**: jede Sprite- oder Backdrop-Komponente muss **genau eine feste
  Wurzel-`View`** zurückgeben (kein Fragment mit variabler Kinderzahl) und animierte Werte nur an
  `Animated.View` übergeben. Beides hat je einen Produktions-Crash verursacht
- **EAS-Build oder Play-Store-Upload starten** — macht der Betreiber selbst

## Weiterführende Dateien

- **`references/billing.md`** — lesen bei allem zu Kauf, Abo, Premium-Gates, `verify-purchase`,
  `purchases`-Tabelle oder wenn der 401-Blocker weiter untersucht wird.
- **`references/release-flow.md`** — lesen vor jedem Release, `versionCode`-Bump, EAS-Build oder
  wenn die In-App-Update-Meldung oder die Tester-Ankündigung dran ist.
- **`references/db-schema.md`** — lesen bevor eine Tabelle angelegt, verändert oder abgefragt wird,
  und wenn unklar ist, wo ein Feature seine Daten ablegt.
