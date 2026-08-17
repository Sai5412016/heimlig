# Billing, Premium und Feature-Gates

Alles zu Abo, Kauf-Verifikation und den Premium-Schranken. Stand: Abo eingerichtet, Client fertig,
**Server-Verifikation blockiert** (siehe "Aktueller Blocker" unten).

## Produkt

- Abo-Name **heimlig Premium**, Produkt-ID **`heimlig_premium_monthly`**
- Basisplan **`monthly-autorenewing`**, **2,99 €**, aktiv in 174 Ländern
- Produkt-ID im Code: `PREMIUM_PRODUCT_ID` in `lib/billing.ts`, gespiegelt als
  `EXPECTED_PRODUCT_ID` in `supabase/functions/verify-purchase/index.ts` (dort nur für eine
  Diagnose-Logzeile, die API-Abfrage nutzt ausschließlich den Purchase-Token)
- Preis und Länder stehen **nur** in der Play Console, nicht im Repo

## Client — `lib/billing.ts`

Bibliothek ist **`expo-iap ^5.0.0`**. `react-native-iap` ist archiviert, `expo-in-app-purchases`
eingestellt — nicht darauf zurückwechseln.

Ablauf:

1. `initBilling(householdId)` — `initConnection()`, dann `purchaseUpdatedListener` und
   `purchaseErrorListener` registrieren. Wird in `app/_layout.tsx` einmal beim Start aufgerufen,
   danach `restorePurchases(householdId)` (Play verlangt, dass wiederherstellbare Käufe bei jedem
   Start erneut auftauchen). Nur Android, `connected`-Guard macht Mehrfachaufrufe zum No-op.
2. `purchasePremium(householdId)` — `fetchProducts({ skus: [PREMIUM_PRODUCT_ID], type: 'subs' })`,
   dann `offerTokenAndroid` aus `subscriptionOffers[0]` ziehen und `requestPurchase()` aufrufen.
   `requestPurchase()` **löst nur aus**; das Ergebnis kommt asynchron über den Listener. Die
   Brücke zurück zum Promise ist die Modul-Variable `pendingResolve`.
3. `verifyAndFinish(purchase, householdId)` — schickt `purchaseToken`, `productId`,
   `platform: 'android'`, `householdId` an die Edge Function `verify-purchase`. Erst wenn die
   `{ valid: true }` liefert, folgt `finishTransaction({ purchase, isConsumable: false })`
   (Abo, kein Verbrauchsartikel — Token nicht konsumieren).
4. `translateVerifyError(serverError)` — vergleicht **exakt** auf den String
   `billing verification not configured yet` und zeigt dann `premiumModal.notConfigured`,
   sonst `premiumModal.verifyFailed`. Diesen String auf beiden Seiten synchron halten.

Der Client schreibt **nie** selbst in `purchases`. Ein Client könnte sonst einen Token erfinden
und sich Premium freischalten.

### Bekannte Schwächen

- **Eingefrorene Haushalts-ID**: `initBilling(householdId)` fängt die ID im Closure des
  `purchaseUpdatedListener` ein. Der `connected`-Guard verhindert ein erneutes Init, also bleibt
  die ID für die gesamte Verbindungsdauer fix. Wechselt der Nutzer den Haushalt und kauft dann,
  läuft die Verifikation gegen die **alte** ID. Ist die ID falsy, wird `verifyAndFinish` gar nicht
  aufgerufen (`householdId ? await verifyAndFinish(...) : { ok: false }`). Nicht gefixt.
- **Client-seitige Fehler ohne Server-Kontakt**: Wirft `supabase.functions.invoke()` bevor eine
  HTTP-Antwort kommt (offline, DNS, Timeout), landet das im Catch-All. Seit dem Sentry-Fix wird das
  als `client_invoke_failed` gemeldet und an Sentry geschickt — vorher verschwand es lautlos und
  war der Grund, warum ein Fehlschlag ohne jede Spur in den Supabase-Logs auftrat.

## Preis-Schätzung ≠ Billing

`lib/pricing.ts` hat **nichts** mit dem Abo zu tun. Es schätzt die Kosten des Einkaufswagens aus
einer Tabelle deutscher Durchschnittspreise (`AVG_PRICES`, Rewe/Edeka/Aldi Mittelfeld) und liefert
`estimateItemPrice()` / `estimateCartTotal()`. Es gibt keine kostenlose, verlässliche Live-Preis-API
für deutsche Supermärkte — die Zahl ist ausdrücklich ein Näherungswert.

## Premium-Prüfung — `lib/premium.ts`

```
hasPremiumAccess(household) === household.plan_tier !== 'free' || household.grandfathered === true
```

**Einzige Quelle der Wahrheit.** Nie `plan_tier` allein prüfen — sonst geht der Bestandsschutz
verloren oder die ODER-Verknüpfung wird verdreht.

Diese Bedingung ist an **drei** Stellen gespiegelt. Ändert sich die Regel, müssen alle drei mit:

1. `lib/premium.ts` — `hasPremiumAccess()` (Client)
2. `supabase/functions/extract-recipe/index.ts` — Inline-Prüfung `hasUnlimitedImports`
3. Trigger-Funktion `enforce_member_limit()` in Postgres — `plan_tier <> 'free' or coalesce(grandfathered, false)`

### Bestandsschutz (`households.grandfathered`)

- `boolean`, `true` für jeden Haushalt, der schon existierte, als das Premium-Gating ausgeliefert wurde
- Gewährt dieselben Rechte wie ein echter Kauf, **ohne** `plan_tier` anzufassen — damit kann es nicht
  mit einem echten Kauf verwechselt oder davon überschrieben werden
- **Grandfathered-Haushalte können nicht kaufen**: `components/PremiumModal.tsx` setzt
  `alreadyPremium = hasPremiumAccess(household)` und zeigt dann statt der Kauf-Buttons den Hinweis
  `premiumModal.alreadyPremium`. Absicht — sie hätten für etwas bezahlt, das sie schon haben
- Tester-Haushalte stehen zusätzlich auf `plan_tier = 'premium'` (Freunde, zahlen nicht)

## Die Feature-Gates im Einzelnen

### 1. Mitglieder — 3 free / 6 premium

- Konstanten: `MEMBER_LIMIT_FREE = 3`, `MEMBER_LIMIT_PREMIUM = 6`, Helfer `memberLimit(household)`
  in `lib/premium.ts` — die steuern nur die **Anzeige**
- Durchsetzung serverseitig: `BEFORE INSERT`-Trigger **`trg_enforce_member_limit`** auf `members`,
  Funktion `enforce_member_limit()`. SQL liegt in
  `supabase/manual_migrations/2026-08-04_enforce_member_limit.sql`
- Bewusst als Trigger statt in `join_household_by_code`: greift für **jeden** Insert-Pfad
  (Join-RPC, Haushalts-Erstellung, künftige Pfade, direkte Client-Inserts) und lässt die bestehende
  SECURITY-DEFINER-RPC unberührt
- `select ... for update` sperrt die Haushalts-Zeile, damit zwei gleichzeitige Beitritte nicht beide
  die Zählprüfung passieren
- Fehler ist der nackte Marker `member_limit_reached` (errcode `P0001`). Der Client erkennt ihn über
  `isMemberLimitError()` in `lib/premium.ts` und zeigt eine übersetzte Meldung — der rohe Text
  erscheint nie im UI
- Haushalte, die schon über dem Limit liegen, bleiben unangetastet; der Trigger blockiert nur neue Inserts

### 2. Rezept-Import — 3 pro Kalendermonat für Free

- `supabase/functions/extract-recipe/index.ts`, Konstante `FREE_MONTHLY_IMPORT_LIMIT = 3`
- Zählung serverseitig gegen Tabelle **`recipe_import_events`**, ein von der Client-Seite gemeldeter
  Zähler wird nie geglaubt
- Prüfung läuft **vor** dem Anthropic-Call — ein Haushalt am Limit löst also nicht die Kosten aus,
  gegen die das Limit existiert
- Bei Überschreitung: `{ error: 'import_limit_reached', limit: 3 }`;
  `components/RecipeImportModal.tsx` fängt das ab und öffnet das `PremiumModal`
- Zusätzlich eine allgemeine Rate-Begrenzung: RPC `rl_hit` mit 30 Aufrufen pro Stunde und Nutzer
  (Tabelle `edge_rate_limits`)

### 3. Budget-CSV-Export — nur Premium

- `app/(tabs)/budget.tsx`: `if (!hasPremiumAccess(household)) { setShowPremium(true); return; }`
  vor dem Export
- **Import bleibt kostenlos** — bewusst, damit niemand seine eigenen Daten nur gegen Bezahlung
  hineinbekommt
- Hilfsfunktionen in `lib/dataIO.ts`. CSV-Header bleiben deutsch (Datenformat, keine UI-Chrome)

Die im `PremiumModal` beworbenen Vorteile stehen in `BENEFIT_KEYS`
(`members`, `unlimitedImports`, `csvExport`) und müssen zum Play-Store-Eintrag passen.

## Server — `supabase/functions/verify-purchase/index.ts`

Ablauf und Antworten (alle Fehlercodes snake_case im Body):

| Prüfung | HTTP | `error` |
| --- | --- | --- |
| Kein Bearer-Token | 401 | `unauthorized` |
| `auth.getUser()` schlägt fehl | 401 | `unauthorized` |
| Rate-Limit `rl_hit` erschöpft (20/h) | 429 | deutscher Text |
| Pflichtfeld fehlt | 400 | `missing_fields` |
| Aufrufer nicht im Haushalt | 403 | `not_household_member` |
| Plattform nicht `android` | 400 | `platform_not_supported` |
| Secret nicht gesetzt | 503 | `billing verification not configured yet` |
| Google-OAuth scheitert | 502 | `google_auth_failed` |
| Play-API-Fehler | 502 | `play_api_error` |
| Abo nicht aktiv | 402 | `not_active` |
| Schreiben in `purchases` scheitert | 502 | `db_write_failed` |
| Unerwartete Ausnahme | 500 | `internal_error` |
| Erfolg | 200 | — (`{ valid: true, expiresAt }`) |

- **Endpunkt**: `GET https://androidpublisher.googleapis.com/androidpublisher/v3/applications/com.fledderman.heimlig/purchases/subscriptionsv2/tokens/{purchaseToken}` —
  also `purchases.subscriptionsv2.get`. Richtig für ein **Abo**. `purchases.subscriptions` (v3) ist
  veraltet, `purchases.products` wäre für Einmalkäufe und hier falsch
- Als aktiv gelten `SUBSCRIPTION_STATE_ACTIVE` und `SUBSCRIPTION_STATE_IN_GRACE_PERIOD`
- **OAuth**: Service-Account-JWT-Bearer-Flow, von Hand über die Web-Crypto-API gebaut
  (`crypto.subtle.importKey` mit `RSASSA-PKCS1-v1_5`/SHA-256), weil im Deno-Edge-Runtime keine
  JWT-Bibliothek verfügbar ist. Scope `https://www.googleapis.com/auth/androidpublisher`
- Secret-Name: **`GOOGLE_SERVICE_ACCOUNT_JSON`** (kompletter JSON-Key als Supabase-Secret).
  Nur der Name gehört in Dokumentation, niemals der Inhalt
- Schreibt mit **Service-Role-Client** (umgeht RLS) in `purchases` per Upsert auf `purchase_token`,
  danach `households.plan_tier = 'premium'` — aber nur `.eq('plan_tier', 'free')`, damit ein bereits
  höherer Tarif oder ein manuell gesetzter Tester-Status nicht heruntergestuft wird
- Schlägt der `households`-Update fehl, ist das **nicht** fatal: die `purchases`-Zeile ist die Quelle
  der Wahrheit, `restorePurchases()` versucht es beim nächsten Start erneut
- **Logging-Regel**: nur Statuscodes, Fehlertexte und "Wert vorhanden ja/nein". Niemals Secrets,
  Tokens oder den `purchase_token` im Klartext. Bei DB-Fehlern nur `.code` und `.message` loggen —
  `.details` kann bei einer Unique-Verletzung den Token zurückspiegeln
- `verify_jwt` bleibt **an**

## Tabelle `purchases`

- Spalten: `user_id`, `household_id`, `product_id`, `purchase_token` (unique), `platform`,
  `status`, `expires_at`
- RLS aktiv, **nur eine `SELECT`-Policy** (`purchases_select`). Es gibt bewusst **keine** INSERT-
  oder UPDATE-Policy für Clients — geschrieben wird ausschließlich von der Edge Function mit
  Service-Role
- Aktuell **0 Zeilen** — kein Kauf wurde bisher erfolgreich verifiziert

## Aktueller Blocker — 401 permissionDenied

`purchases.subscriptionsv2.get` antwortet mit **HTTP 401 `permissionDenied`**.

Bereits geprüft und ausgeschlossen:

- Google-Cloud-Projekt existiert, **Google Play Android Developer API** ist aktiviert
- Service-Account (`heimlig-play-billing@…`) ist in der Play Console eingeladen und hat
  App-Berechtigungen sowie Kontoberechtigungen ("Finanzdaten einsehen", "Bestellungen und Abos verwalten")
- Secret `GOOGLE_SERVICE_ACCOUNT_JSON` ist gesetzt
- `ANDROID_PACKAGE_NAME` in der Function stimmt mit `app.json` → `android.package` überein
  (`com.fledderman.heimlig`)
- Der Endpunkt ist der richtige für ein Abo
- Ein echter Testkauf existierte auf Google-Seite (Bestellnummer `GPA.3331-1214-4247-20042`)

Noch nicht ausgeschlossen, in dieser Reihenfolge prüfen:

1. **Deploy-Stand.** Zuerst mit Supabase-MCP `get_edge_function` (Slug `verify-purchase`) den
   **tatsächlich deployten** Quelltext holen und gegen `main` vergleichen. Ein Deploy aus einem
   Verzeichnis ohne den aktuellen Branch schiebt alten Code hoch, die Versionsnummer zählt aber
   trotzdem hoch. Das ist hier schon einmal passiert und hat eine Fehlersuche entwertet.
2. **Berechtigungs-Propagation.** Nach dem Einladen eines Service-Accounts in der Play Console
   dauert die Freischaltung teils Stunden bis Tage.
3. **Verknüpfung Cloud-Projekt ↔ Play Console.** Play Console → Einstellungen → API-Zugriff: ist
   *genau dieses* Cloud-Projekt verknüpft und der Service-Account dort gelistet?
4. **Kontoebene vs. App-Ebene.** Manche Konten brauchen die Rechte auf Kontoebene, nicht nur für
   die einzelne App.
5. **Exakter Antwort-Body.** Der geloggte Google-Fehlertext unterscheidet
   "Service-Account kennt die App nicht" von "API im Projekt nicht aktiviert" — jetzt vollständig
   in den Logs, vorher fehlte er.

Logs abfragen: Supabase-MCP `query_logs`, Quelle `function_edge_logs` für HTTP-Status,
`function_logs` für `console.*`-Ausgaben der Function.

Deploy-Befehl (führt der Betreiber selbst aus, aus einem Checkout des aktuellen Stands):

```
npx supabase functions deploy verify-purchase --project-ref eabwlyihcmofkbqtbryz
```

## Kauf manuell testen

1. Testkonto in der Play Console als Lizenz-Tester hinterlegen
2. App als echten Release-Build (kein Expo Go) auf einem echten Gerät installieren
3. Haushalt → "Jetzt freischalten" → Kaufdialog
4. Danach in Supabase prüfen: `select * from purchases order by created_at desc limit 5;`
5. Bei Fehlschlag Supabase-Logs der Function lesen, **nicht** nur die Meldung im UI — die ist für
   fast alle Fehlerfälle derselbe generische Text
