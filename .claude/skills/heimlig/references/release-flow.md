# Release-Flow (Android + Web)

heimlig ist **live im Play Store** als Production-Release (kein geschlossener Alpha-Test mehr).
Web braucht keinen Build: Push auf `main` reicht, Vercel deployt automatisch.

Den aktuellen `versionCode` immer in `app.json` (`expo.android.versionCode`) nachsehen,
`version` (versionName) steht daneben — beides veraltet hier sonst bei jedem Release.

`app_config.latest_version_code` **steht in der Datenbank und wird dort abgefragt**, nicht in
dieser Datei gepflegt:

```sql
select latest_version_code from app_config where id = 1;
```

Ein Wert unterhalb des `versionCode` aus `app.json` ist normal, solange der Build noch nicht im
Play Store veröffentlicht ist — der In-App-Update-Hinweis feuert absichtlich erst nach dem
Rollout. Stand 01.09.2026: **80**.

## Die Schritte

### 1. `versionCode` **und** `expo.version` in `app.json` erhöhen

- Datei `app.json`, Pfad `expo.android.versionCode`
- **Aktuellen Wert vorher lesen, nicht annehmen.** Immer um genau 1 erhöhen
- **`expo.version` (versionName) wird jedes Mal mitgezählt** — den `versionCode` nie allein erhöhen:
  - Standard: **Patch +1** (`1.1.0` → `1.1.1`)
  - Sichtbare neue Funktion: **Minor +1, Patch auf 0** (`1.1.3` → `1.2.0`)
- Grund: Play leitet den **Release-Namen aus dem `versionName`** ab. Der stand monatelang auf
  `1.1.0`, während in der Play Console von Hand `1.1.7` und `1.1.8` vergeben wurden — dadurch
  stimmte weder die in der App sichtbare Version mit dem Store überein, noch ließ sich aus einem
  Play-Release der `versionCode` ablesen. Hat schon einmal eine Fehlersuche gekostet.
- Commit-Message-Muster: `chore: bump version for <thema> build`
- Dieser Bump darf direkt auf `main` (Ausnahme von der Branch-Regel), weil er den Build auslöst

### 2. EAS-Build starten

Zwei Wege, einer genügt:

**Automatisch (Regelfall):** Der Workflow `.github/workflows/eas-build.yml` startet bei **jedem**
Push auf `main` (kein `paths`-Filter mehr). Zusätzlich manuell startbar über GitHub → Actions →
"EAS Build (Android Production)" → "Run workflow" (`workflow_dispatch`).

**Manuell per CLI:**

```
eas build --platform android --profile production
```

Im Web oder auf dem Handy vorher `EXPO_TOKEN` als Env setzen, damit kein interaktiver Login nötig ist.

Profile in `eas.json`:

| Profil | Ausgabe | Zweck |
| --- | --- | --- |
| `development` | Dev-Client, `distribution: internal` | lokales Entwickeln |
| `preview` | **APK**, `distribution: internal` | schnelles Testen auf dem Gerät, `SENTRY_DISABLE_AUTO_UPLOAD: true` |
| `production` | **AAB** | Play-Store-Upload |

`preview` und `production` setzen `EXPO_PUBLIC_SUPABASE_URL` und `EXPO_PUBLIC_SUPABASE_ANON_KEY`
als Env (Publishable Key, absichtlich clientseitig). Kein `SENTRY_AUTH_TOKEN` hinterlegt — es
werden also keine Source Maps hochgeladen, Stacktraces in Sentry zeigen bis dahin nur
minifizierten Code.

Der Build läuft in der Cloud; Fortschritt und Download-Link im Expo-Dashboard unter dem Account
`fledderman`.

### 3. AAB in der Play Console hochladen und freigeben

**Macht der Betreiber selbst — kein API-Zugang, nicht automatisierbar.**

1. Fertige `.aab` aus dem Expo-Dashboard herunterladen
2. Play Console → **Produktion** → "Neuen Release erstellen"
3. AAB hochladen
4. Versionshinweise ins Feld **`<de-DE>`** eintragen: kurz, locker, Du-Form, 1–2 Sätze mit Emoji.
   Kein Betreff, keine Anrede, keine Signatur (das war nur für die alte Tester-Mail)
5. Release prüfen und veröffentlichen

### 4. `app_config.latest_version_code` in Supabase setzen

Erst **nach** der Veröffentlichung im Store — sonst werden Nutzer auf eine Version hingewiesen,
die es noch nicht gibt.

```sql
update app_config
set latest_version_code = <neuer versionCode>,
    update_message = '<kurzer Text, was neu ist>'
where id = 1;
```

Tabelle `app_config` hat genau eine Zeile (`id = 1`) mit `latest_version_code`, `update_message`
und `store_url`. `lib/appUpdate.ts` liest sie beim Start und zeigt das
"Update verfügbar"-Popup, wenn `latest_version_code` **größer** als der eigene `versionCode` ist.

### 5. Versionshinweise statt Tester-Mail

**Es gibt keine Ankündigungsmail mehr.** Die frühere Mail an
`haushalts-app-heimlig-tester@googlegroups.com` entfällt seit dem Production-Release — die App ist
öffentlich, es gibt keine Google-Group-Benachrichtigung mehr. Diese Regel ist verbindlich geklärt;
nicht wieder einführen.

Stattdessen gehen die „Was ist neu"-Texte direkt ins **`<de-DE>`-Feld bei „Versionshinweise"** beim
Erstellen des Releases, also in Schritt 3. Format: kurz, locker, Du-Form, 1–2 Sätze mit Emoji.
Kein Betreff, keine Anrede, keine Signatur — das war nur für die alte Tester-Mail.

Optional zusätzlich für die Kommunikation in der App selbst: `update_message` in `app_config`
(Schritt 4) und ein Eintrag in `app_changelog`, den `components/WhatsNewModal.tsx` anzeigt.

### 6. Web

Nichts zu tun. Push auf `main` → Vercel baut und deployt die PWA automatisch.
`vercel.json` enthält nur den SPA-Rewrite (`/(.*)` → `/index.html`), damit expo-router-Routen beim
Direktaufruf nicht in einen 404 laufen.

## Vor jedem Release prüfen

- [ ] `npx tsc --noEmit` läuft ohne **neue** Fehler (die vorbestehenden Deno-Fehler in
      `supabase/functions/*` sind erwartet und herausfiltern)
- [ ] Auf einem **echten Android-Gerät** getestet, nicht nur Expo Go, nicht nur Web
- [ ] Neue Strings in `de.ts` **und** `en.ts` vorhanden
- [ ] Neue Tabellen haben RLS plus geprüfte Policies
- [ ] Geänderte Edge Functions sind deployt (`npx supabase functions deploy <name> --project-ref eabwlyihcmofkbqtbryz`)
      und der deployte Stand mit `get_edge_function` gegengeprüft
- [ ] Demo-Haushalte (`Familie Berger`, `Berger Family`) haben keinen gültigen Einladungscode mehr,
      der öffentlich sichtbar wäre

## Nach dem Rollout prüfen

- [ ] **Mitglied entfernen mit Tombstone** (ab Build 86). `test1234` steht absichtlich in
      `Demo Household` — er hat 2 Buchungen in `transactions.member_id` und ist damit der
      vorbereitete Fall für beide Hälften in einem Durchgang. Als `test123` entfernen:
      - er verschwindet aus der Mitgliederliste und bleibt nach dem Neuladen weg
      - seine 2 Buchungen sind weiterhin da und zeigen „Ehemaliges Mitglied"
      - in der DB: `members.deleted_at` gesetzt, `user_id` NULL, `display_name` leer,
        `role` zurück auf `member` — die Zeile ist ein Tombstone, nicht gelöscht
      Schlägt der erste Punkt fehl, läuft noch der alte Direkt-Delete-Pfad; bleibt der zweite
      leer, greift der Tombstone-Fallback nicht und die Fremdschlüssel haben stattdessen die
      Buchungen mitgerissen.

- [ ] **Einladungs-Trichter: Schritt 4 muss unter 100 % liegen** (ab Build 87, prüfbar ~2 Wochen
      nach dem Rollout):
      ```sql
      select * from analytics.v_invite_funnel;
      ```
      `join_completed` kann nicht häufiger sein als `join_opened` — es ist dieselbe Person
      nacheinander, also eine echte Teilmenge. Vor Build 87 stand der Wert bei **125 %**
      (5 gegen 4), weil `join_opened` nur an einer von drei Beitritts-Stellen geloggt wurde und
      `join_completed` an allen dreien. Build 87 hat die beiden fehlenden ergänzt
      (`app/onboarding.tsx`, `app/(tabs)/household.tsx`).

      Der Altbestand verwässert den Wert noch eine Weile; er sollte sich mit neuen Zeilen
      einpendeln. **Steht er zwei Wochen nach dem Rollout immer noch über 100 %, wurde ein
      Aufrufer übersehen** — dann alle `join_household_by_code`-Aufrufe suchen und prüfen, ob vor
      jedem auch `logJoinOpenedOnce` steht:
      ```
      grep -rn "join_household_by_code" app/
      ```
      Schritt 3 hat aus gutem Grund gar keinen Prozentwert, siehe
      `supabase/manual_migrations/2026-09-02_invite_funnel_pct_note.sql` — nicht mit diesem
      Kontrollwert verwechseln.

## Bekannte Play-Console-Warnungen — kein Blocker

Zwei wiederkehrende Hinweise im Release-Dashboard, beide bewusst offen gelassen:

- **"Nicht mehr unterstützte APIs für randlose Anzeige" (edge-to-edge)** — ökosystemweites Problem,
  React Native Core, react-native-screens und Google Material Components nutzen intern noch die
  alten `Window.setStatusBarColor` / `setNavigationBarColor`. Eigener Code ist nicht betroffen
  (geprüft). Tracking: `github.com/expo/expo#37459`. Löst sich mit künftigen Expo/RN-Updates
- **"Einschränkungen für Größenänderung/Ausrichtung entfernen"** — `app.json` hat
  `"orientation": "default"`, erzeugt also `android:screenOrientation="unspecified"`.
  `app/_layout.tsx` sperrt Portrait nur zur Laufzeit auf Handys (`Dimensions.get('screen')`,
  kleinste Seite < 600 dp) über `expo-screen-orientation` — genau das von Google empfohlene Muster.
  Kein `resizeableActivity`, `minAspectRatio` oder `maxAspectRatio` gesetzt. Funktional konform
