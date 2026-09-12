# Heimlig — Projektüberblick

> Erstellt am 12.09.2026 aus dem tatsächlichen Code- und Datenbankstand (Branch `claude/google-logout`
> nach Build 102, Live-Abfragen gegen das Supabase-Projekt `eabwlyihcmofkbqtbryz`). Wo eine Zahl oder
> Aussage einer bestehenden Doku (`CONTEXT.md`, `.claude/skills/heimlig/...`) widerspricht, gilt hier
> die Messung — die Abweichung ist unten im Abschnitt "Bekannte offene Punkte und Altlasten" vermerkt,
> nicht stillschweigend übernommen.

## 1. Was Heimlig ist

Heimlig ist eine Haushalts-App für Paare, WGs und Familien: gemeinsame Einkaufslisten, Aufgaben/Kalender
mit Gamification (Punkte, Titel), ein Budget-Tracker mit CSV-Export, Rezepte mit Essensplanung und ein
Barcode-Scanner für Produkt-Scores. Macher ist Andreas Schilling ("Andi") unter der Firma
**Gut Feeling Labs**. Zielgruppe 18+, App-Sprache Du-Form, dunkles mobile-first Design (Markengrün
`#2D6A4F`), 17 wählbare Themes. UI auf Deutsch und Englisch, live im Google Play Store
(`com.fledderman.heimlig`) sowie als Web-PWA.

### Geschäftsmodell und Preis

Freemium mit einem Abo:

- **Kostenlos**: bis 3 Haushaltsmitglieder, 5 KI-Aktionen pro Kalendermonat (geteilter Pool aus
  Rezept-Import, Kassenbon-Scan und Termin-Erkennung aus Foto zusammen — **nicht** je 3 getrennt, wie
  eine ältere interne Notiz behauptet, siehe Altlasten-Abschnitt), kein CSV-Export im Budget.
- **heimlig Premium** — Produkt-ID `heimlig_premium_monthly`, Play-Billing-Abo, **2,99 €/Monat**
  (laut Play Console; ein früherer Testkauf zeigte 3,59 € an, vermutlich Netto-statt-Brutto-Anzeige,
  nicht im Repo klärbar), aktiv in 174 Ländern. Schaltet frei: bis 6 Mitglieder, unbegrenzte
  KI-Aktionen, CSV-Export.
- **Bestandsschutz (`grandfathered`)**: Haushalte, die schon existierten, bevor das Gating auslieferte,
  behalten vollen Zugriff ohne zu bezahlen und ohne dass das über einen echten Kauf läuft.

Die alleinige Zugriffsprüfung ist `hasPremiumAccess(household)` in `lib/premium.ts` — gespiegelt in der
Edge Function `extract-recipe` und im Postgres-Trigger `enforce_member_limit()`; alle drei müssen bei
einer Änderung der Regel gemeinsam angepasst werden.

## 2. Technischer Aufbau

### Stack

- **Expo SDK 54** (`expo ~54.0.34`), **expo-router 6**, React Native `0.81.5`, React `19.1.0`,
  `newArchEnabled: true`
- **Web**: `react-native-web`, Auslieferung über Vercel, Auto-Deploy bei jedem Push auf `main`
- **Supabase**: Postgres + Auth + Row Level Security + Edge Functions (Projekt-Ref
  `eabwlyihcmofkbqtbryz`), Schema wird direkt angewandt, nicht als Migrations-Historie getrackt
- **State**: `zustand`, ein einziger Store (`store/useStore.ts`)
- **i18n**: `i18next` + `react-i18next` + `expo-localization`, DE/EN
- **Billing**: `expo-iap` gegen Google Play Billing
- **Monitoring**: `@sentry/react-native` (aktuell **ohne** Source-Map-Upload, siehe Altlasten)
- **Build**: EAS (Expo-Account `fledderman`), Android AAB, GitHub-Actions-Workflow löst bei jedem Push
  auf `main` automatisch einen Production-Build aus — aber nur, wenn `app.json` im Push enthalten ist
- **Qualitätssicherung**: **kein** ESLint, kein Prettier, keine automatisierten Tests. Einzige Prüfung
  ist `npx tsc --noEmit` (TS `strict: true`)

### Verzeichnisstruktur (zentrale Dateien)

| Datei/Verzeichnis | Zweck |
| --- | --- |
| `app/_layout.tsx` | Root-Layout: Session-Check, Auth-Listener, Deep-Links, Orientierungs-Lock, Update-Check, Billing-Init |
| `app/onboarding.tsx` | Registrierung/Login, Haushalt anlegen oder per Code beitreten |
| `app/(tabs)/_layout.tsx` | Tab-Navigator plus Theme-Hintergründe/-Sprites |
| `app/(tabs)/index.tsx` | Start-Dashboard mit Kacheln und Pinnwand |
| `app/(tabs)/shopping.tsx` | Einkauf, mehrere Listen je Geschäft, Artikel-Autocomplete |
| `app/(tabs)/scan.tsx` | Barcode-Scan, Produkt-Gesundheits-Score |
| `app/(tabs)/recipes.tsx` | Rezepte, Favoriten, Essensplanung |
| `app/(tabs)/tasks.tsx` | Aufgaben/Kalender, Gamification, ICS-/TimeTree-Import |
| `app/(tabs)/budget.tsx` | Budget, CSV-Export/Import, wiederkehrende Buchungen |
| `app/(tabs)/household.tsx` | Mitglieder, Einladung, Haushalts-Switcher, alle Einstellungen, Abmelden |
| `app/konto-loeschen.tsx` | Self-Service-Kontolöschung (Play-Store-Pflicht) |
| `lib/supabase.ts` | Supabase-Client plus alle TS-Interfaces der DB-Zeilen |
| `lib/premium.ts` | `hasPremiumAccess()`, Mitglieder-/KI-Limits |
| `lib/billing.ts` | expo-iap-Anbindung: Kauf, Wiederherstellen, Server-Verifikation |
| `lib/googleAuth.ts` | Google-Anmeldung (nativ + Web) |
| `lib/budgetCategories.ts` | fester Budget-Kategorie-Katalog |
| `lib/i18n.ts`, `lib/locales/{de,en,types}.ts` | Übersetzungen, typisiert gegen ein gemeinsames Interface |
| `lib/gamification.ts` | Punkte pro Aufgabe, Titel-Stufen |
| `lib/inviteFunnel.ts` | Einladungs-Funnel-Tracking (mit explizitem Hinweis auf eine frühere Mess-Falle, siehe Altlasten) |
| `repositories/` | dünne Datenzugriffsschicht für Einkauf/Budget, damit UI nicht direkt mit Supabase spricht |
| `store/useStore.ts` | zentraler Zustand, inkl. `resetSession()` beim Abmelden |
| `hooks/useTheme.ts`, `constants/theme.ts` | Farb-/Theme-System, 17 Themes |
| `components/` | Modals und Theme-Dekoration (animierte Hintergründe/Sprites je Theme) |
| `supabase/functions/` | 7 Edge Functions, siehe Abschnitt 4 |
| `supabase/manual_migrations/` | SQL-Dokumentation der Schema-Änderungen (Referenz, keine automatische Kette) |
| `sql/` | Analytics-Views (Einladungs-Funnel, Paywall, Reviews) |
| `eas.json` | Build-Profile (`development`/`preview`/`production`) |
| `.github/workflows/eas-build.yml` | Löst EAS-Production-Build bei `app.json`-Änderung auf `main` aus |

## 3. Datenmodell

33 Tabellen im Schema `public` (Live-Stand, nicht aus Doku übernommen), RLS auf allen aktiv.
Zeilenzahlen sind eine Momentaufnahme vom 12.09.2026.

### Kern
- **`households`** (58 Zeilen) — der Haushalt selbst, Wurzel für fast alles. Wichtige Spalten:
  `name`, `invite_code`, `plan_tier` (`free`/`premium`/`premium_plus`/`family`), `grandfathered`,
  `gamification_enabled`, `digest_enabled`, `timetree_import_enabled`, `currency`, `timezone`, `country`.
- **`members`** (75) — verbindet einen Auth-Nutzer mit einem Haushalt. `user_id`, `household_id`,
  `display_name`, `avatar_color`, `role` (`admin`/`member`), `joined_at`. Unique `(user_id, household_id)`.

### Einkauf
- **`shopping_lists`** (77) — mehrere Listen je Haushalt, typisch pro Geschäft.
- **`shopping_items`** (147) — Artikel je Liste: `name`, `quantity`, `category` (fester Katalog),
  `brand`, `barcode`, `checked`, `sort_order`, optionale Verknüpfung zu Rezept/Essensplan.
- **`item_catalog`** (262) — gelernter Autocomplete-Katalog je Haushalt inkl. `preferred_supermarket`.
- **`product_brands`** (0) — Community-Markendatenbank, länderübergreifend geteilt.

### Aufgaben und Kalender
- **`tasks`** (249) — Aufgaben und Kalendertermine in einer Tabelle: Titel, Zuweisung/Rotation,
  Fälligkeit, Wiederholung (`recurrence` + fester Anker-Tag `recurrence_day`), Punkte, Priorität,
  Anhänge, Google-Kalender-Verknüpfung.
- **`task_checklist_items`** (1) — Unterpunkte innerhalb eines Termins.

### Budget
- **`transactions`** (122) — Ausgaben/Einnahmen: `amount`, `type`, `category` (fester Katalog),
  `transaction_date`, Wiederholungslogik analog zu `tasks`.
- **`budget_limits`** (0) — monatliches Limit je Kategorie.
- **`settlements`** (0) — Ausgleichszahlungen zwischen zwei Mitgliedern.

### Rezepte und Essensplan
- **`recipes`** (51) — `ingredients`/`instructions` als JSONB, `category` ist der Gericht-**Typ**
  (nicht die Tageszeit).
- **`meal_plans`** (32) — was wann gegessen wird, `meal_type` ist die Tageszeit
  (`fruehstueck`/`mittag`/`abendessen`).
- **`recipe_import_events`** (1) — **Altlast**, wird von keiner Funktion mehr beschrieben, siehe
  Abschnitt 5.

### Gamification
- **`member_scores`** (33) — Wochenpunktestand, atomar über eine RPC hochgezählt.
- **`rewards`** (0) / **`reward_redemptions`** (0) — Belohnungs-Katalog und Einlösungen, angelegt aber
  0 Zeilen (ungenutzt oder noch kein UI-Einstieg breit genutzt).
- **`share_events`** (27) — Social-Media-Teilen, ein Punkt pro Plattform und Tag.

### Vorrat und Gesundheit
- **`pantry_items`** (1) — Vorratskammer mit Ablaufdatum.
- **`scan_history`** (24) — gescannte Produkte mit Score/Nutri-Score/Nova-Gruppe, pro Haushalt geteilt.

### Kommunikation und Standort
- **`household_messages`** (60) — Pinnwand/Chat, löst Push über `notify-message` aus.
- **`household_notes`** (2) — Notizen/Dokumente.
- **`member_locations`** (1) — geteilter Standort je Mitglied.

### Infrastruktur
- **`push_tokens`** (15) — Expo-Push-Tokens je Mitglied.
- **`push_debug`** (51) — Diagnose-Log für Push-Zustellung.
- **`edge_rate_limits`** (33) — Zähler-Tabelle für Rate-Limits der Edge Functions.
- **`app_config`** (1 Zeile, `id=1`) — `latest_version_code` (**Live-Wert: 100**, siehe Abschnitt 6),
  `update_message`, `store_url`. Treibt das In-App-Update-Popup.
- **`app_changelog`** (18) — Einträge für das "Was ist neu"-Modal.

### Billing
- **`purchases`** (1 Zeile — siehe Abschnitt 6 für die Einordnung) — `user_id`, `household_id`,
  `product_id`, `purchase_token` (unique), `platform`, `status`, `expires_at`. Nur eine SELECT-Policy,
  Schreiben ausschließlich über `verify-purchase` mit Service-Role.

### Analytics / Messung
- **`feedback`** (0) — In-App-Feedback, mit KI-Themencheck vorgefiltert (`status`, `reject_reason`).
- **`invite_funnel_events`** (140) — Einladungs-Funnel-Schritte (`invite_opened` → `join_completed`).
- **`ai_usage_events`** (6) — zählt die geteilten 5 KI-Aktionen/Monat (`action_type`:
  `recipe_import`/`receipt_scan`/`event_extract`) pro Haushalt.
- **`paywall_events`** (11) — wann die Paywall gezeigt wurde und woher.
- **`review_events`** (4) — Bewertungs-Anfrage-Tracking.

### Sicherheitsbausteine
Helferfunktionen `is_household_member(household_id)` / `is_household_admin(household_id)`, auf denen
fast alle RLS-Policies aufbauen. SECURITY-DEFINER-RPCs für Haushalt anlegen/beitreten sowie zwei
Punkte-Zähl-RPCs. Trigger `trg_enforce_member_limit` (3/6-Grenze) und
`trg_prevent_member_field_escalation` (macht `household_id`/`role`/`user_id` in `members` nach dem
Anlegen unveränderlich — schließt eine früher reale Rechte-Ausweitungslücke).

## 4. Die sieben Edge Functions

| Function | Zweck |
| --- | --- |
| **`verify-purchase`** | Prüft einen Android-Kauf-Token gegen die Google Play Developer API und schreibt bei Erfolg `purchases` + `plan_tier`. Sicherheitskritisch — ein Client könnte sonst einen Token erfinden und sich Premium freischalten. Lehnt seit der letzten Änderung einen Token ab, der bereits einem anderen Nutzer gehört, erlaubt aber den Haushaltswechsel desselben Nutzers mit bestehendem Abo. |
| **`extract-recipe`** | Liest Zutaten/Zubereitung aus URL, Text oder Foto eines Rezepts via Claude, zählt gegen den gemeinsamen 5/Monat-KI-Pool für Free-Haushalte. |
| **`extract-receipt`** | Liest Positionen von einem fotografierten Kassenbon via Claude Vision, für den Budget-Import. Zählt gegen denselben KI-Pool. |
| **`extract-event`** | Liest Termindetails (Titel, Datum, Ort) aus einem fotografierten Flyer/einer Einladung via Claude Vision. Zählt gegen denselben KI-Pool. |
| **`notify-message`** | Schickt eine Push-Benachrichtigung an die anderen Haushaltsmitglieder, wenn jemand eine Pinnwand-Nachricht schreibt. |
| **`delete-account`** | Self-Service-Kontolöschung (Play-Store-Pflicht): übergibt Admin-Rollen, anonymisiert oder entfernt Mitgliedschaften, löscht danach den Auth-User. |
| **`submit-feedback`** | Nimmt In-App-Feedback entgegen, lässt einen leichten KI-Themencheck gegen Spam/Off-Topic laufen (im Zweifel wird durchgelassen), speichert in `feedback`. Max. 5 Einsendungen pro Nutzer und Tag. |

## 5. Bekannte offene Punkte und Altlasten — ehrlich

- **`verify-purchase`-Blocker laut bestehender Doku, aber Messung widerspricht teilweise**: Die
  Referenz-Doku (`.claude/skills/heimlig/references/billing.md`) beschreibt einen anhaltenden
  HTTP-401-`permissionDenied`-Blocker bei der Play-API und behauptet "aktuell 0 Zeilen — kein Kauf
  wurde bisher erfolgreich verifiziert" in `purchases`. Die Live-Abfrage zeigt jedoch **1 Zeile**: ein
  Kauf für den Haushalt "Birkensteig" vom 19.08.2026, Gültigkeitsfenster nur ca. 5 Minuten
  (`created_at` 10:20:09 UTC, `expires_at` 10:25:06 UTC) — das Muster eines
  Play-Console-Lizenztester-Testabos, nicht eines echten Kunden, und der Haushalt ist ohnehin bereits
  `grandfathered`. Die Doku ist also in diesem Punkt veraltet und sollte korrigiert werden; unklar
  bleibt, ob der 401-Blocker inzwischen (zumindest für Lizenztester) behoben ist oder dieser eine Kauf
  vor einer erneuten Regression durchkam. **Der Umsatz-Meilenstein (Kauf von einem Konto, das weder
  dem Betreiber noch einem Tester gehört) ist laut dieser Messung nicht erreicht.**
- **KI-Limit-Doku war falsch**: `billing.md` beschreibt "3 Rezept-Importe pro Kalendermonat" über eine
  eigene Zählung in `recipe_import_events`. Im aktuellen Code (`lib/premium.ts`,
  `FREE_MONTHLY_AI_ACTIONS = 5`, gespiegelt in allen drei `extract-*`-Functions) ist das längst ein
  gemeinsamer Pool von 5 KI-Aktionen/Monat über Rezept-Import, Kassenbon-Scan und Termin-Erkennung
  zusammen, gezählt in `ai_usage_events`. `recipe_import_events` wird von keiner Funktion mehr
  beschrieben (0 Treffer im Code) — die Tabelle mit ihrer einen Zeile ist eine tote Altlast.
- **Haushaltswechsel mit bestehendem Abo lässt das alte `plan_tier` stehen**: Wechselt ein Nutzer mit
  aktivem Abo den Haushalt, verschiebt `verify-purchase` die `purchases`-Zeile korrekt auf den neuen
  Haushalt, stuft den alten Haushalt aber **nicht** zurück auf `free` — der bleibt dauerhaft auf
  `premium` stehen, obwohl das Abo nicht mehr zu ihm gehört. Bekannt, bewusst noch nicht behoben
  (siehe Commit-Historie dieses Branches).
- **`initBilling(householdId)` friert die Haushalts-ID ein**: Die ID wird einmalig im
  `purchaseUpdatedListener`-Closure eingefangen. Wechselt der Nutzer danach den Haushalt und kauft
  dann, läuft die Verifikation gegen die alte ID (bei fehlender ID wird gar nicht erst verifiziert).
  Nicht gefixt.
- **Kaufpreis-Anzeige**: ein Testkauf zeigte 3,59 € statt der in der Play Console hinterlegten 2,99 €
  — vermutlich Netto/Brutto-Verwechslung, nicht aus dem Repo klärbar.
- **Zweiter Haushalt lässt sich über die UI nicht anlegen**: `create_household_for_user` wird nur in
  `app/onboarding.tsx` aufgerufen. Bestehende Mitglieder können nur **beitreten**, nicht zusätzlich
  einen eigenen Haushalt gründen.
- **Sentry ohne Source-Map-Upload**: kein `SENTRY_AUTH_TOKEN` hinterlegt, Stacktraces aus dem Release-
  Build sind bis dahin nur auf minifizierten Code gemappt.
- **Zwei Demo-Haushalte für Store-Screenshots** (`Familie Berger`/`Berger Family`, beide
  `plan_tier=premium`) enthalten einen wiederverwendbaren Einladungscode — muss vor öffentlichem
  Marketing-Einsatz rotiert oder der Haushalt gelöscht werden.
- **TimeTree-Direktimport nutzt eine inoffizielle API** (kein offizieller Export/Sync von TimeTree
  verfügbar) — ToS-Risiko, kann jederzeit ohne Vorwarnung brechen. Bewusst nur für zwei Haushalte
  freigeschaltet, nicht global.
- **Keine automatisierten Tests, kein Linter**: einzige Prüfung im Repo ist `npx tsc --noEmit`.
  Regressionen außerhalb von Typfehlern fallen nur durch manuelles Testen auf.
- **`app_config.latest_version_code` hinkt strukturell hinterher** (aktuell 100, `app.json` steht bei
  102) — das ist laut Release-Prozess normal: der Wert wird erst nach der tatsächlichen
  Store-Veröffentlichung von Andi manuell nachgezogen, nicht automatisch bei jedem Build.
- **Play-Console-Warnungen "randlose Anzeige" und "Größenänderung/Ausrichtung"**: laut vorheriger
  Prüfung Ökosystem-weite bzw. Anzeige-Altlasten ohne eigenen fehlerhaften Code — hier nicht erneut
  nachgemessen, nur aus bestehender Notiz übernommen, mit diesem Vorbehalt gekennzeichnet.
- **Keine Real-time Developer Notifications**: ein Abo-Downgrade bei Kündigung/Ablauf durch den Nutzer
  in der Play-Konsole selbst wird nicht automatisch nachvollzogen (nur die serverseitige Neuprüfung
  beim App-Start deckt das teilweise ab).
- **Google-Kalender-OAuth-Sync**: weiterhin offene Roadmap, nicht begonnen (ICS-Import existiert als
  einfachere Alternative bereits).

## 6. Zahlen (gemessen am 12.09.2026)

- **Auth-Nutzer gesamt**: 63
- **Haushalte gesamt**: 58 (davon 2 reine Demo-Haushalte für Store-Screenshots ohne echten Login)
- **Haushalte mit `plan_tier` ≠ `free`**: 4
- **Haushalte mit Bestandsschutz (`grandfathered`)**: 39
- **Verifizierte Käufe (`purchases`)**: 1 Zeile, siehe Einordnung in Abschnitt 5 — kein bestätigter
  Umsatz von einem echten externen Kunden
- **Umsatz**: **0 €** nach der im Projekt selbst definierten Messlatte (ein Kauf von einem Konto, das
  weder dem Betreiber noch einem Tester gehört)
- **Build-Stand**: `app.json` → `versionCode` 102, `version` 1.8.1 (Build 102, gemergt nach `main` als
  Commit `9e9e1c4`). `app_config.latest_version_code` in der Datenbank steht auf 100 — normal, wird
  erst nach dem tatsächlichen Play-Store-Rollout von Build 101/102 hochgesetzt.
