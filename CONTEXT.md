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
- Git: **`Sai5412016/heimlig`**, Branch **`main`**.

## Release-Flow (Android)
1. `android.versionCode` in `app.json` um 1 erhöhen.
2. `eas build --platform android --profile production` (läuft in der Cloud; im Web/mobil `EXPO_TOKEN` als Env setzen, damit kein interaktiver Login nötig ist).
3. Fertige **AAB** in Play Console → **Geschlossener Test (Alpha)** → „Neuen Release erstellen" → hochladen → veröffentlichen. *(Upload macht Andi manuell – kein API-Zugang.)*
4. Nach Veröffentlichung: in Supabase `app_config.latest_version_code` auf den neuen versionCode setzen → löst das In-App-„Update verfügbar"-Popup für ältere Nutzer aus.
- **Web** braucht keinen Build – Push auf `main` reicht (Vercel).
- Stand zuletzt: **versionCode 22** gebaut; `app_config.latest_version_code` = **21** (auf 22 setzen, sobald 22 veröffentlicht). versionName = `1.0.2`.

## Supabase / Datenbank
- Schema-Änderungen werden **direkt** angewandt (Supabase-MCP `apply_migration`/`execute_sql` oder SQL-Editor) – **nicht** als lokale Migrations-Dateien getrackt.
- Wichtige Tabellen: `households`, `members`, `shopping_lists`, `shopping_items`, `tasks`, `transactions`, `recipes`, `meal_plans`, `member_scores`, `item_catalog`, `app_config`.
- RLS nutzt `is_household_member(household_id)`. SECURITY-DEFINER-RPCs: `create_household_for_user`, `join_household_by_code`, `bump_item_catalog`.
- Edge Function `extract-recipe` (Rezept-Extraktion aus URL/Text/Bild via Claude). `ANTHROPIC_API_KEY` ist ein Supabase-Secret. Deploy via `npx supabase functions deploy extract-recipe --project-ref eabwlyihcmofkbqtbryz` (verify_jwt an lassen!).
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

## Google-Group-Nachricht (festes Format für jeden Release)
Plain Text, **kein** Fettdruck, **mit** Betreff-Zeile. Aufbau:
```
Betreff: <kurzer Titel mit Emoji>

Hey zusammen,

<ein Satz, was neu ist>

<Emoji> <Kurztitel> — <Beschreibung>.

<Emoji> <Kurztitel> — <Beschreibung>.

Probiert's aus und gebt mir Feedback! Danke fürs Testen 💪

Viele Grüße

Andi
```
Gruppe: `haushalts-app-heimlig-tester@googlegroups.com`.

## Offene Roadmap / Tester-Wünsche
- 🛒 **Mehrere Einkaufslisten pro Geschäft** (DM/Rossmann/Aldi) + umschalten/sortieren. Backend (`shopping_lists`) kann das schon – es fehlt die UI. (Nächster geplanter Release.)
- 🎨 **Kalender schöner/farbiger** (Kategorie-Farben, farbige Event-Balken).
- 📅 **Google-Kalender-Sync (OAuth)** – großer Brocken, braucht Google-Cloud-Projekt/OAuth. *(ICS-Import ist als einfachere Alternative bereits umgesetzt.)*
- 🏪 Optional: Artikel einem Laden zuordnen + Liste nach Laden filtern (statt Produkt-DB pro Supermarkt).
