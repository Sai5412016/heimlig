# Heimlig – Projektkontext (Handoff für Claude Code)

Diese Datei macht Claude Code überall (Desktop **und** mobil/Web) sofort arbeitsfähig.
Sie wird über `CLAUDE.md` automatisch in jede Session geladen.

## Über das Projekt
- **Heimlig** – Haushalts-App für Paare, WGs & Familien (Einkaufslisten, Aufgaben/Kalender, Budget, Rezepte, Gamification).
- Macher: **Andreas Schilling ("Andi")**, Firma **Gut Feeling Labs**. Sprache: Deutsch, Du-Form, locker. Zielgruppe 18+.
- Dunkles, mobile-first Design; Markengrün `#2D6A4F`.

## Tech-Stack
- **Expo SDK 54** + `expo-router`, React Native + **react-native-web**. ⚠️ Vor Code immer die versionierten Expo-Docs (v54) prüfen (siehe AGENTS.md).
- **Supabase** (Postgres + Auth + RLS + Edge Functions). Projekt-Ref: **`eabwlyihcmofkbqtbryz`**.
- **EAS Build** (Android AAB), Expo-Account **`fledderman`**, App-Package **`com.fledderman.heimlig`**.
- **Vercel**: Web-PWA, **auto-deploy bei jedem Push auf `main`** (kein manueller Schritt).
- **Sentry** (`@sentry/react-native`) für Crash-/Error-Reporting. Org `gut-feeling-labs`, Projekt `react-native`. DSN + Init in `lib/sentry.ts`, `ErrorBoundary` mit eigenem Fallback-Screen (`components/ErrorFallback.tsx`) in `app/_layout.tsx`. Kein `SENTRY_AUTH_TOKEN` hinterlegt (also noch kein Source-Map-Upload beim Build) — Stacktraces sind bis dahin nur auf minifizierten Code gemappt.
- Git: **`Sai5412016/heimlig`**, Branch **`main`**.

## Release-Flow (Android)
Heimlig ist **live im Play Store** (offizieller Production-Release, kein geschlossener Alpha-Test mehr). Es gibt eine EAS-GitHub-Integration, die bei Push auf `main` automatisch einen Build auslöst (unabhängig davon, ob `eas build` manuell/per CLI erfolgreich läuft).
1. `android.versionCode` in `app.json` um 1 erhöhen.
2. `eas build --platform android --profile production` (läuft in der Cloud; im Web/mobil `EXPO_TOKEN` als Env setzen, damit kein interaktiver Login nötig ist). Push auf `main` triggert den Build i.d.R. auch automatisch über die GitHub-Integration.
3. Fertige **AAB** in Play Console → **Production** → „Neuen Release erstellen" → Versionshinweise (de-DE) eintragen → hochladen → veröffentlichen. *(Upload macht Andi manuell – kein API-Zugang.)*
4. Nach Veröffentlichung: in Supabase `app_config.latest_version_code` auf den neuen versionCode setzen → löst das In-App-„Update verfügbar"-Popup für ältere Nutzer aus.
- **Web** braucht keinen Build – Push auf `main` reicht (Vercel).
- Stand zuletzt: **versionCode 54** gebaut & veröffentlicht; `app_config.latest_version_code` = **50** (noch nicht auf 54 hochgesetzt). versionName = `1.0.2`.
- Keine Tester-Ankündigungsmail mehr nötig (App ist live, keine Google-Group-Benachrichtigung mehr).

## Bekannte Play-Console-Warnungen ("Empfohlene Aktionen")
Zwei wiederkehrende Hinweise im Play-Console-Release-Dashboard, beide **kein Blocker**, keine weitere Aktion nötig:
- **„Nicht mehr unterstützte APIs für randlose Anzeige" (edge-to-edge)**: Ökosystem-weites, aktuell nicht app-seitig behebbares Problem (React Native Core / react-native-screens / Google Material Components nutzen intern noch die alten `Window.setStatusBarColor`/`setNavigationBarColor`-APIs). Kein eigener Code betroffen (geprüft: kein Treffer für diese APIs in unserem Code). Tracking: github.com/expo/expo#37459. Löst sich mit zukünftigen Expo/RN-Updates von selbst.
- **„Einschränkungen für Größenänderung/Ausrichtung entfernen" (Großbild-Support)**: `app.json` hat `"orientation": "default"` → erzeugt `android:screenOrientation="unspecified"` (nicht restriktiv). `app/_layout.tsx` sperrt Ausrichtung nur zur Laufzeit auf Handys (`Dimensions.get('screen')`, `smallestSide < 600`dp) via `expo-screen-orientation` — exakt das von Google offiziell empfohlene Pattern für Apps, die auf Handys Portrait behalten wollen (Android 16+ ignoriert `setRequestedOrientation` auf Großbildschirmen ohnehin automatisch). Kein `resizeableActivity`/`minAspectRatio`/`maxAspectRatio` irgendwo gesetzt (auch nicht in node_modules-Manifests). Die Warnung ist vermutlich ein generischer, nicht pro-Build neu bewerteter Hinweis der reinen Anwesenheit der Orientation-Lock-API im kompilierten Code – funktional ist die App bereits konform.

## Supabase / Datenbank
- Schema-Änderungen werden **direkt** angewandt (Supabase-MCP `apply_migration`/`execute_sql` oder SQL-Editor) – **nicht** als lokale Migrations-Dateien getrackt.
- Wichtige Tabellen: `households`, `members`, `shopping_lists`, `shopping_items`, `tasks`, `transactions`, `recipes`, `meal_plans`, `member_scores`, `item_catalog`, `app_config`.
- RLS nutzt `is_household_member(household_id)`. SECURITY-DEFINER-RPCs: `create_household_for_user`, `join_household_by_code`, `bump_item_catalog`.
- Edge Function `extract-recipe` (Rezept-Extraktion aus URL/Text/Bild via Claude). `ANTHROPIC_API_KEY` ist ein Supabase-Secret. Deploy via `npx supabase functions deploy extract-recipe --project-ref eabwlyihcmofkbqtbryz` (verify_jwt an lassen!).
- **Tages-Digest-Push**: `pg_cron` (stündlich) + `pg_net` rufen `send_daily_digest()` auf — reine Postgres-Funktion (kein Edge-Function-Umweg, kein Service-Role-Key nötig). Die Funktion selbst gated auf „aktuelle Uhrzeit in Europe/Berlin == 8 Uhr" (self-gating löst das DST-Problem, da der Cron in UTC läuft). Sendet nur an Haushalte mit `households.digest_enabled = true` und nur wenn an dem Tag offene Termine anstehen. Direkt an Expos Push-Endpunkt, gleiche Token-Quelle (`push_tokens`) wie die `notify-message`-Funktion.
- Edge Function `timetree-import` (siehe „TimeTree-Wechsel" unten) – nutzt TimeTrees inoffizielle API, kein Secret nötig (Nutzer gibt eigene TimeTree-Zugangsdaten pro Aufruf ein, wird nicht gespeichert).
- Tester-Haushalte stehen auf `plan_tier = 'premium'` (Freunde, zahlen nicht).

## Wichtige Dateien
- `app/(tabs)/shopping.tsx` – Einkauf + Rezept-Import-Trigger + Artikel-Autocomplete (`lib/groceries.ts`, `item_catalog`).
- `app/(tabs)/tasks.tsx` – Kalender/Aufgaben, Gamification-Badge/Scoreboard, ICS-Import (`lib/ics.ts`), Aufgaben-Detail + Bearbeiten.
- `app/(tabs)/budget.tsx` – Budget, CSV-Export/Import (`lib/dataIO.ts`), wiederkehrende Transaktionen.
- `app/(tabs)/household.tsx` – Mitglieder, Einladung/Beitreten, Multi-Haushalt-Switcher, Einstellungen (Name, Passwort, Gamification, Haushalt verlassen).
- `app/(tabs)/recipes.tsx` + `components/RecipeImportModal.tsx` – Rezept-Menü (Favoriten, planen) + Import (Link/Text/Foto).
- `app/_layout.tsx` – Session-Laden, Deep-Link `heimlig://join/CODE`, Orientierung (Handy Portrait/Tablet frei), Update-Check (`lib/appUpdate.ts`).
- `store/useStore.ts` – zentraler Zustand (Zustand/`zustand`).
- `lib/gamification.ts` – Punkte + Titel (monatlich, aus `tasks.completed_at`).

## Konventionen
- Web-spezifische Layout-Fixes mit `Platform.OS === 'web'` (z.B. Modals oben verankern, damit Tastatur nichts verdeckt).
- Bekannter, **vorbestehender** tsc-Fehler in `store/useStore.ts` (completeTask `completed_at` null vs undefined) – harmlos, blockiert den Metro-Build nicht.
- Nach Code-Änderung: `npx tsc --noEmit` über die geänderten Dateien laufen lassen.

## Play-Store-Versionshinweise (statt Google-Group-Mail)
Seit dem Production-Release gibt's **keine Tester-Ankündigungsmail mehr**. Stattdessen kommen die „Was ist neu"-Texte direkt ins `<de-DE>`-Feld bei „Versionshinweise" in der Play Console beim Release erstellen. Kurz, locker, Du-Form, 1-2 Sätze mit Emoji reichen (kein Betreff/Anrede/Signatur nötig, das ist nur für die alte Tester-Mail).

## TimeTree-Wechsel (Onboarding für Umsteiger)
TimeTree hat **keine offizielle Export-/Sync-API** (offiziell bestätigt von TimeTree Support) — deshalb zwei Wege in `app/(tabs)/tasks.tsx`, beide mit derselben Duplikat-Erkennung (`isDuplicateTask`, matcht wiederkehrende Termine über Titel+Wiederholung, einmalige über Titel+Datum+Zeit):
- 🔄 **Quickstart** (`TimeTreeQuickstartModal`) – für alle sichtbar. Schnelles manuelles Nacherfassen der wichtigsten wiederkehrenden Termine, kein Login nötig.
- 🔗 **Direkter TimeTree-Import** (`components/TimeTreeWebViewModal.tsx`, nativ-only) – nur sichtbar wenn `households.timetree_import_enabled = true`. Lädt TimeTrees echte Login-Seite (`https://timetreeapp.com/signin`) in einer WebView, sodass auch Google/Facebook-Login funktioniert. Nach dem Login wird per `injectJavaScript` **innerhalb der TimeTree-Seite** gegen TimeTrees inoffizielle API gefetcht (`/calendars`, `/calendar/{id}/events/sync`) — der Browser hängt die Session-Cookie automatisch an (auch HttpOnly), Heimlig sieht nie Passwort noch Cookie, nur die fertigen Termin-Daten zurück per `postMessage`. Mapping in `lib/timetreeEvents.ts`.
  - **Bewusst nur für ausgewählte Haushalte freigeschaltet** (aktuell: „Birkensteig" + „Dörschis"), weil das inoffizielle TimeTree-Endpunkte nutzt (ToS-Risiko, kann jederzeit brechen). Freischalten: `update households set timetree_import_enabled = true where id = '...'`.
  - API-Endpunkte identifiziert über [eoleedi/TimeTree-Exporter](https://github.com/eoleedi/TimeTree-Exporter) (Python-Referenzimplementierung). Frühere Variante nutzte eine Edge Function mit direkter E-Mail/Passwort-Abfrage — durch den WebView-Ansatz abgelöst (unterstützt Google-Login, kein Passwort-Handling mehr nötig).

## Bereits umgesetzt (nicht mehr offen)
- ✅ **Mehrere Einkaufslisten pro Geschäft** (DM/Rossmann/Aldi etc.) + umschalten/erstellen/löschen – volle UI in `shopping.tsx` (`ListPickerModal`, „Listen ▾"-Button, „Schnell erstellen"-Chips pro Supermarkt) + Store-Funktionen `switchList`/`createShoppingList`/`deleteShoppingList`.
- ✅ **Kalender farbiger** – Kategorie-Farben in Aufgabenliste & Monatsansicht (seit versionCode 45).
- ✅ **12 Akzent-Designs voll illustriert** – eigene Maskottchen + Empty-State-Illustrationen für Einkauf & Aufgaben (seit versionCode 49).
- ✅ **Artikel einem Laden zuordnen** – `item_catalog.preferred_supermarket` merkt sich, wo ein Artikel meist gekauft wird; Hinweis-Chip „Meist bei X — dort hinzufügen" im Add-Item-Sheet routet den Artikel automatisch in die passende Laden-Liste (seit versionCode 50).
- ✅ **TimeTree-Feature-Parität** (Session Juli 2026, „Heimlig soll TimeTree überbieten"): WebView-TimeTree-Import (Google-Login), Feiertage im Kalender (`lib/holidays.ts`), Termine anpinnen (`tasks.pinned`), Countdown-Badge im Termin-Detail, Tages-Digest-Push (`send_daily_digest()` via pg_cron), Checklisten in Terminen (`task_checklist_items`), KI-Termin aus Foto (`extract-event` Edge Function), gemeinsame Stundenansicht (👥-View-Mode, `MemberDayView`). Alles in `app/(tabs)/tasks.tsx` + `app/(tabs)/household.tsx`.

## Offene Roadmap / Tester-Wünsche
- 📅 **Google-Kalender-Sync (OAuth)** – großer Brocken, braucht Google-Cloud-Projekt/OAuth. *(ICS-Import ist als einfachere Alternative bereits umgesetzt.)*
