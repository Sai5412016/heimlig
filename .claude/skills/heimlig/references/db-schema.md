# DB-Schema (Supabase, Projekt `eabwlyihcmofkbqtbryz`)

29 Tabellen im Schema `public`. **Bei allen ist RLS aktiv.** Zeilenzahlen sind Momentaufnahmen und
nur als Größenordnung zu lesen.

Schema-Änderungen werden **direkt** angewandt (Supabase-MCP `apply_migration` / `execute_sql` oder
SQL-Editor) und **nicht** als lokale Migrations-Historie getrackt. Zur Dokumentation der Absicht
liegt SQL in `supabase/manual_migrations/JJJJ-MM-TT_<thema>.sql` — diese Dateien sind Referenz,
keine automatisch ausgeführte Kette.

## Inhalt

- [Kern](#kern) — `households`, `members`
- [Einkauf](#einkauf) — `shopping_lists`, `shopping_items`, `item_catalog`, `product_brands`
- [Aufgaben und Kalender](#aufgaben-und-kalender) — `tasks`, `task_checklist_items`
- [Budget](#budget) — `transactions`, `budget_limits`, `settlements`
- [Rezepte und Essensplan](#rezepte-und-essensplan) — `recipes`, `meal_plans`, `recipe_import_events`
- [Gamification](#gamification) — `member_scores`, `rewards`, `reward_redemptions`, `share_events`
- [Vorrat und Gesundheit](#vorrat-und-gesundheit) — `pantry_items`, `scan_history`
- [Kommunikation und Standort](#kommunikation-und-standort) — `household_messages`, `household_notes`, `member_locations`
- [Infrastruktur](#infrastruktur) — `push_tokens`, `push_debug`, `edge_rate_limits`, `app_config`, `app_changelog`
- [Billing](#billing) — `purchases`
- [Sicherheitsbausteine](#sicherheitsbausteine) — Helferfunktionen, RPCs, Trigger
- [Regeln für neue Tabellen](#regeln-für-neue-tabellen)

## Kern

### `households` (~42 Zeilen)
Der Haushalt selbst. Wurzel für fast alles andere; die meisten Tabellen hängen per
`household_id` mit `on delete cascade` daran.

Wichtige Spalten: `name`, `invite_code` (Beitritts-Code, auch im Deep Link
`heimlig://join/CODE`), `plan_tier` (`free` | `premium` | `premium_plus` | `family`),
`grandfathered` (Bestandsschutz), `gamification_enabled`, `digest_enabled`,
`timetree_import_enabled`, `currency` (Default `'EUR'`), `timezone` (Default `'Europe/Berlin'`),
`country` (Default `'DE'`).

Einstellungen sind **haushaltsweit** und admin-only. Bewusst nicht pro Gerät, weil Budget zwischen
Mitgliedern gesplittet wird und gemischte Währungen keinen Sinn ergäben. Gegenbeispiel: Sprache,
Dark Mode und Theme sind reine **Geräte**-Einstellungen in AsyncStorage, nicht in der DB.

RLS: `households_select`, `households_update` (**admin-only** über `is_household_admin`),
`households_delete`. Kein INSERT für Clients — Anlegen läuft über die RPC
`create_household_for_user`.

### `members` (~49 Zeilen)
Verbindet einen Auth-Nutzer mit einem Haushalt. Ein Nutzer kann in mehreren Haushalten sein
(Multi-Haushalt-Switcher).

Spalten: `user_id` (FK auf `auth.users`, `on delete cascade`), `household_id`, `display_name`,
`avatar_color`, `role` (`admin` | `member`), `joined_at`.
Unique auf `(user_id, household_id)`.

**Wichtig:** `user_id` verlangt eine echte Zeile in `auth.users`. Für Demo-Mitglieder ohne Login
müssen Platzhalter-Zeilen in `auth.users` mit `.invalid`-Domain angelegt werden (RFC 2606,
garantiert nicht zustellbar) — eine beliebige UUID reicht nicht.

RLS: `members_select`, `members_update`, `members_delete`. Kein INSERT für Clients.
Zwei Trigger hängen daran, siehe [Sicherheitsbausteine](#sicherheitsbausteine).

## Einkauf

### `shopping_lists` (~54 Zeilen)
Mehrere Listen pro Haushalt, typisch je Geschäft (DM, Rossmann, Aldi …).
Spalten: `household_id`, `name`, `emoji`, `created_by` (→ `members.id`).
Beim Anlegen eines Haushalts wird automatisch eine Liste erzeugt — Name sprachabhängig
(`Einkaufsliste` / `Shopping List`) über den `p_language`-Parameter von `create_household_for_user`.

### `shopping_items` (~110 Zeilen)
Artikel einer Liste. Hängt an `list_id`, **nicht** direkt am Haushalt.
Spalten: `name`, `quantity` (Text, z. B. `"250 g"`), `category` (Default `'Sonstiges'`), `brand`,
`barcode`, `checked`, `checked_by`, `checked_at`, `added_by`, `sort_order`,
`meal_plan_id` (→ `meal_plans`, `cascade`), `recipe_id` (→ `recipes`, `set null`).

`category` ist ein **fester Katalog** — siehe SKILL.md. Insbesondere gibt es hier **kein**
`Haushalt`; Putzmittel gehören unter `Drogerie`.

### `item_catalog` (~205 Zeilen)
Gelernter Artikel-Katalog pro Haushalt für Autovervollständigung und häufige Artikel.
Enthält `name`, `name_key`, `category`, `count` und `preferred_supermarket` (merkt sich, wo ein
Artikel meist gekauft wird — treibt den Hinweis "Meist bei X — dort hinzufügen").
Wird über die SECURITY-DEFINER-RPC `bump_item_catalog` hochgezählt.

### `product_brands` (0 Zeilen)
Von der Community gepflegte Marken-Datenbank, matcht über den reinen Kettennamen und ist
länderübergreifend geteilt (Aldi und Lidl sind derselbe Händler in mehreren Ländern).

## Aufgaben und Kalender

### `tasks` (~197 Zeilen)
Aufgaben und Kalendertermine in einer Tabelle.
Spalten: `title`, `description`, `assigned_to`, `rotation` (Array von Member-IDs),
`created_by`, `due_date`, `due_time`, `completed_at`, `completed_by`, `category`
(Default `'Haushalt'`), `priority` (`low` | `normal` | `high`), `recurrence`
(`daily` | `weekly` | `monthly` | `yearly`), `recurrence_day`, `recurrence_interval`,
`points` (Default 10), `pinned`, `remind_time`, `location_url`, `google_event_id`,
`attachment_path`, `attachment_name`.

Details, die leicht kaputtgehen:
- **Punkte** gibt es nur für `HOUSEHOLD_CATEGORIES` = `Haushalt`, `Einkauf`, `Wartung`, `Garten`.
  Die Liste ist **doppelt** definiert (`store/useStore.ts`, `app/(tabs)/tasks.tsx`) — synchron halten
- Kategorie `Geburtstag` ist von der Punktewertung ausgenommen
- `recurrence_day` ist ein **fester Anker-Tag** für monatliche und jährliche Wiederholungen. Ohne
  ihn würde ein Kurzmonat-Clamp (31. → 28. im Februar) sich dauerhaft festsetzen
- Lokale Erinnerungen nutzen `identifier: taskId`, damit `cancelScheduledNotificationAsync(taskId)`
  beim Löschen, Erledigen oder Bearbeiten funktioniert

### `task_checklist_items` (~1 Zeile)
Unterpunkte innerhalb eines Termins.

## Budget

### `transactions` (~87 Zeilen)
Ausgaben und Einnahmen.
Spalten: `household_id`, `member_id` (nullable — Einnahmen ohne Zuordnung), `amount` (numeric),
`type` (`expense` | `income`, Default `expense`), `category` (Default `'Sonstiges'`),
`description`, `receipt_url`, `bank_tx_id`, `transaction_date` (Default `current_date`),
`recurrence`, `recurrence_interval`, `recurrence_next`.

`category` ist der feste Katalog aus `lib/budgetCategories.ts` — **kein** `Wohnen`, Strom und
Nebenkosten laufen unter `Miete`. Beträge sind reine Zahlen **ohne** Währungstag; die Währung
kommt aus `households.currency`, ein späterer Wechsel rechnet nichts um, sondern zeigt nur anders an.
Bei Vorlagen für Wiederholungen dient `transaction_date` der Vorlagenzeile als Anker (gleiche Logik
wie `tasks.recurrence_day`).

### `budget_limits` (0 Zeilen)
Monatliches Limit je Kategorie: `household_id`, `category`, `monthly_limit`.

### `settlements` (0 Zeilen)
Ausgleichszahlungen zwischen zwei Mitgliedern: `from_member`, `to_member`, `amount`.

## Rezepte und Essensplan

### `recipes` (~21 Zeilen)
Spalten: `household_id`, `name`, `source_url`, `source_text`, `source_image_path`,
`ingredients` (**jsonb**, Default `'[]'`), `instructions` (**jsonb**, Array von Schritt-Strings),
`is_favorite`, `category`, `created_by`.

`ingredients` ist ein JSON-Array von Objekten `{ name, quantity, category, include }` (siehe
`RecipeIngredient` in `lib/supabase.ts`) — **keine** eigene Tabelle. `category` ist der feste
Rezept-**Typ**-Katalog (Gericht-Art, nicht Tageszeit).

### `meal_plans` (~17 Zeilen)
Was wann gegessen wird: `recipe_id`, `recipe_name`, `planned_date`,
`meal_type` (`fruehstueck` | `mittag` | `abendessen`).
Das ist die **Tageszeit** — nicht zu verwechseln mit `recipes.category`.

### `recipe_import_events` (0 Zeilen)
Zählt Rezept-Importe für das Free-Limit (3 pro Kalendermonat).
Geschrieben und gezählt **serverseitig** in `supabase/functions/extract-recipe/index.ts`.
RLS: `recipe_import_events_select`, `recipe_import_events_insert`.

## Gamification

### `member_scores` (~23 Zeilen)
**Wochen**-Punktestand: `member_id`, `household_id`, `week_start` (date), `points`, `tasks_done`.
Wird über die SECURITY-DEFINER-RPC `bump_member_score` atomar hochgezählt (ersetzt ein früheres
Lesen-dann-Schreiben).

Achtung, zwei getrennte Mechaniken:
- **Wochenansicht** (`app/(tabs)/household.tsx`) liest `member_scores`
- **Monatsansicht** (`components/Scoreboard.tsx`, `monthlyScores()`) berechnet live aus
  `tasks.completed_at` plus `share_events` und liest `member_scores` **nicht**

### `rewards` (0 Zeilen) / `reward_redemptions` (0 Zeilen)
Belohnungs-Katalog (`title`, `emoji`, `cost`) und Einlösungen.

### `share_events` (~1 Zeile)
Social-Media-Teilen: `household_id`, `user_id`, `platform`, `shared_at`.
Unique auf `(user_id, platform, shared_date)` — das erzwingt "ein Punkt pro Plattform pro Tag"
(`SHARE_POINTS` in `lib/gamification.ts`). Ein Unique-Verstoß (`23505`) heißt "heute schon geteilt"
und wird im Client bewusst geschluckt.
RLS: `share_events_select`, `share_events_insert`.

## Vorrat und Gesundheit

### `pantry_items` (0 Zeilen)
Vorratskammer mit Ablaufdatum: `name`, `emoji`, `quantity`, `expiry_date`, `barcode`, `added_by`.

### `scan_history` (~13 Zeilen)
Gescannte Produkte, pro Haushalt geteilt: `barcode`, `name`, `brand`, `score` (0–100),
`rating_label`, `nutri_score` (`a`–`e`), `nova_group` (1–4), `image_url`, `added_by`.

`rating_label` muss zu den Bändern in `lib/productScore.ts` passen: ab 75 "Ausgezeichnet",
ab 50 "Gut", ab 25 "Mittelmäßig", darunter "Schlecht" (englisch: Excellent, Good, Moderate, Poor).

## Kommunikation und Standort

### `household_messages` (~23 Zeilen)
Pinnwand / Chat: `member_id`, `text`. Neue Nachrichten lösen einen Push über die Edge Function
`notify-message` aus (Best-Effort, blockiert das Senden nie).

### `household_notes` (~1 Zeile)
Notizen und Dokumente: `title`, `content`, `updated_at`.

### `member_locations` (~1 Zeile)
Geteilter Standort: `member_id`, `household_id`, `lat`, `lng`, `accuracy`, `updated_at`.

Für `member_locations`, `household_messages` und `push_debug` prüfen die Policies zusätzlich, dass
die angegebene `member_id` wirklich zur **eigenen** Mitgliedschaft im jeweiligen Haushalt gehört —
sonst könnte man fremde Mitglieder-IDs vortäuschen.

## Infrastruktur

### `push_tokens` (~8 Zeilen)
Expo-Push-Tokens je Mitglied. Quelle für `notify-message` **und** den Tages-Digest.

### `push_debug` (~28 Zeilen)
Diagnose-Log für Push-Zustellung.

### `edge_rate_limits` (~19 Zeilen)
Zähler-Tabelle hinter der RPC `rl_hit(p_bucket, p_limit)`, mit der Edge Functions ihre Aufrufe
begrenzen: `extract-recipe` 30/h, `verify-purchase` 20/h.

### `app_config` (1 Zeile, `id = 1`)
`latest_version_code`, `update_message`, `store_url`. Treibt das In-App-"Update verfügbar"-Popup
(`lib/appUpdate.ts`). **Steht aktuell auf 50, während `app.json` bei 73 ist** — nach jedem
Store-Release nachziehen.

### `app_changelog` (~18 Zeilen)
Einträge für `components/WhatsNewModal.tsx` (`lib/changelog.ts`).

## Billing

### `purchases` (0 Zeilen)
`user_id`, `household_id`, `product_id`, `purchase_token` (unique), `platform`, `status`,
`expires_at`.

RLS aktiv mit **nur** `purchases_select`. Es gibt bewusst **keine** INSERT- oder UPDATE-Policy für
Clients: geschrieben wird ausschließlich von `supabase/functions/verify-purchase/index.ts` mit dem
Service-Role-Client. Sonst könnte ein Client einen Token erfinden und sich Premium freischalten.
Vollständige Erklärung in `references/billing.md`.

## Sicherheitsbausteine

**Helferfunktionen**, auf denen die Policies aufbauen:
- `is_household_member(household_id)` — Standardprüfung für Lese- und Schreibzugriff
- `is_household_admin(household_id)` — für Admin-Aktionen (Haushalt umbenennen, Währung, Zeitzone,
  Land, Gamification, Digest)

**SECURITY-DEFINER-RPCs** (umgehen RLS bewusst und kontrolliert):
- `create_household_for_user(p_name, p_display_name, p_avatar_color, p_language)` — legt Haushalt,
  Admin-Mitglied und erste Einkaufsliste an. `p_language` steuert den Listennamen, Default `'de'`.
  Wird **nur** in `app/onboarding.tsx` aufgerufen — deshalb lässt sich über die UI kein zweiter
  Haushalt erstellen
- `join_household_by_code(p_invite_code, p_display_name, p_avatar_color)` — Beitritt über Code.
  Aufgerufen in `app/onboarding.tsx`, `app/join/[code].tsx`, `app/(tabs)/household.tsx`
- `bump_item_catalog` — prüft `is_household_member(p_household)`, EXECUTE nur für `authenticated`
- `bump_member_score` — atomares Punkte-Upsert
- `send_daily_digest()` — reine Postgres-Funktion, EXECUTE nur für `postgres` und `service_role`.
  Läuft ausschließlich über den `pg_cron`-Job `daily-digest-hourly` (stündlich, UTC) und prüft
  selbst pro Haushalt `now() at time zone h.timezone = 8 Uhr`. Dieses Self-Gating löst das
  Sommerzeit-Problem. Sendet nur an Haushalte mit `digest_enabled = true` und nur wenn an dem Tag
  offene Termine anstehen. Nutzt `pg_net` direkt gegen Expos Push-Endpunkt, kein Edge-Function-Umweg

**Trigger:**
- `trg_enforce_member_limit` (`BEFORE INSERT` auf `members`) — Mitglieder-Limit 3 free / 6 premium.
  Sperrt die Haushalts-Zeile mit `for update` gegen gleichzeitige Beitritte, wirft
  `member_limit_reached`. Siehe `references/billing.md`
- `trg_prevent_member_field_escalation` (`BEFORE UPDATE` auf `members`) — macht `household_id`,
  `role` und `user_id` nach dem Anlegen unveränderlich. Schließt eine kritische Lücke: die alte
  `members_update`-Policy prüfte nur `user_id = auth.uid()`, wodurch sich jeder eingeloggte Nutzer
  in einen fremden Haushalt versetzen oder sich `role = 'admin'` geben konnte

## Regeln für neue Tabellen

1. SQL nach `supabase/manual_migrations/JJJJ-MM-TT_<thema>.sql` schreiben (Absicht dokumentieren)
2. Anwenden über Supabase-MCP `apply_migration` oder den SQL-Editor
3. **`enable row level security` plus Policies** — ohne RLS liegt die Tabelle offen.
   Muster: `is_household_member(household_id)` für normalen Zugriff,
   `is_household_admin(household_id)` für Admin-Aktionen
4. `household_id` als FK auf `households(id)` mit `on delete cascade`
5. Verweise auf Personen zeigen auf `members(id)`, **nicht** auf `auth.users` — Ausnahme ist
   `members.user_id` selbst
6. TS-Interface in `lib/supabase.ts` ergänzen
7. Lade- und Schreibfunktionen in `store/useStore.ts` oder `repositories/`, neues Feld in
   `resetSession()` eintragen
8. RLS aus der App prüfen: einmal als Mitglied, einmal als Fremder. Ein Test mit Service-Role
   beweist nichts, weil der RLS ohnehin umgeht
