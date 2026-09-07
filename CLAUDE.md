@AGENTS.md
@CONTEXT.md

## graphify (code structure graph)

A SessionStart hook regenerates `graphify-out/graph.json` from the current code (AST-only,
no LLM cost) if the `graphify` CLI is installed in this environment — otherwise it's a silent
no-op. If `graphify-out/graph.json` exists, prefer it over grepping around for structural
questions:
- `graphify query "<question>"` — scoped answer with sources
- `graphify path "<A>" "<B>"` — how two things connect
- `graphify explain "<concept>"` — a node and its neighbors
- `graphify-out/GRAPH_REPORT.md` — god nodes, communities, architecture overview

This is a structural map of what the code currently looks like, not a log of past decisions —
for "why was this built this way", CONTEXT.md is still the source of truth.

## Builds sammeln, nicht einzeln auslösen

`app.json` wird **nicht bei jedem PR angefasst**. `versionCode` und `version` bleiben unverändert,
solange Andi nicht ausdrücklich einen Build will.

- Ein PR **ohne** Änderung an `app.json` löst **keinen** EAS-Build aus. Das ist beabsichtigt und
  spart Credits — der `paths`-Filter in `.github/workflows/eas-build.yml` hört allein auf
  `app.json`, das Anfassen dieser einen Datei entscheidet also über den Build.
- Sagt Andi **„Build"**, kommt ein **eigener kleiner PR, der NUR `app.json` ändert**: `versionCode`
  plus eins, `version` passend nach der Regel unten. Alles, was seit dem letzten Build gemergt
  wurde, geht dann gemeinsam raus.
- In den Versionshinweisen für diesen Build stehen **alle gesammelten Änderungen**, nicht nur die
  letzte. Dafür die Merges seit dem vorigen Bump durchgehen, nicht aus dem Gedächtnis schreiben.
- Im Abschlussbericht **jedes** PRs ohne Build-Bump steht ausdrücklich:
  **„Kein Build ausgelöst, `app.json` unverändert."**

Grund: Zwischen dem 05.09. und dem 07.09. sind sieben Builds entstanden, weil in jedem PR der
`versionCode` mitgezogen wurde. EAS-Credits sind knapp, und jeder dieser Builds war ein AAB, das
nie in den Store ging.

## Versionsname mitziehen

Bei **jedem** Bump von `expo.android.versionCode` in `app.json` wird `expo.version` (der
Versionsname) mitgezählt. Standard ist **Patch +1** (`1.1.0` → `1.1.1`). Bringt das Release eine
für Nutzer **sichtbare neue Funktion**, stattdessen **Minor +1 und Patch auf 0** (`1.1.3` → `1.2.0`).
Den `versionCode` **nie allein** erhöhen.

Grund: Play leitet den Release-Namen aus dem `versionName` ab. Der stand monatelang auf `1.1.0`,
während in der Play Console von Hand `1.1.7` und `1.1.8` vergeben wurden — dadurch stimmte weder
das, was Nutzer in der App sehen, mit dem Store überein, noch ließ sich aus einem Play-Release der
`versionCode` ablesen. Das hat schon einmal eine Fehlersuche gekostet.

## Release Notes

Immer wenn der `versionCode` in `app.json` erhöht wird, gehören in denselben Bericht fertige
Play-Store-Versionshinweise für de-DE und en-US, in genau diesem Format zum Direkt-Einfügen in
die Play Console. Da Builds gesammelt werden (siehe oben), decken diese Texte **alles ab, was seit
dem letzten Bump nach `main` gegangen ist** — nicht nur den PR, der den Bump enthält:

```
<de-DE>
...
</de-DE>
<en-US>
...
</en-US>
```

Regeln für den Text:
- Aus Nutzersicht schreiben, nicht aus Entwicklersicht. Keine Dateinamen, keine Funktionsnamen,
  keine internen Begriffe.
- Maximal 500 Zeichen pro Sprache (Play-Limit).
- Erste Zeile ist ein Satz, der sagt was sich für den Nutzer ändert. Danach maximal drei
  Stichpunkte.
- Nichts erfinden und nichts aufblasen: wenn ein Release für Nutzer kaum sichtbare Änderungen
  bringt, sag das nüchtern statt Marketing zu texten.
- Beide Sprachen inhaltlich identisch, kein Google-Translate-Deutsch.

## Nur gemessene Ergebnisse berichten

In Berichten steht nur, was der Lauf ausgegeben hat. Kein Satz aus `CONTEXT.md`, `SKILL.md` oder
einem früheren Bericht wird als Ergebnis übernommen. Widersprechen sich eine Notiz und ein Lauf,
**gewinnt der Lauf**, und die Notiz wird **im selben Zug** korrigiert.

Gilt für jede Zeile, die wie eine Messung aussieht: `tsc`-Ergebnisse, Zeilen- und Trefferzahlen,
Datenbank-Zustände, Build- und Deploy-Status, „X Stellen geprüft".

Grund — zwei Fälle in einer Woche, dieselbe Fehlerklasse (eine dokumentierte Annahme als Messung
ausgegeben):
- Eine leere Analytics-Tabelle wurde als „das Feature wurde nie benutzt" berichtet. Eine leere
  Tabelle belegt nur, dass nichts geschrieben wurde — nie, dass nichts passiert ist. Der Insert
  war stillschweigend abgelehnt worden (`supabase-js` liefert `{ error }` zurück, statt zu
  werfen, deshalb fängt ein `try`/`catch` allein gar nichts).
- „Bekannter, vorbestehender tsc-Fehler in `store/useStore.ts`" stand als Konvention in
  `CONTEXT.md` und wurde in einen Abschlussbericht übernommen, ohne `npx tsc --noEmit` laufen zu
  lassen. Den Fehler gab es in der gesamten vorhandenen Git-Historie nicht; die Notiz war
  veraltet. Der Nutzer hatte sich an dem Tag mehrfach auf diese Zeile verlassen.

## Abschlussbericht zum Kopieren

Jede abgeschlossene Aufgabe endet mit einem Bericht in einem Codeblock — gedacht zum 1:1-Kopieren
zwischen dieser Claude-Code-Session und einem separaten Claude-Chat-Fenster (claude.ai), in beide
Richtungen. Der Bericht muss deshalb für sich allein verständlich sein, ohne Bezug auf den
vorherigen Chat-Verlauf.

Format wie bereits etabliert (je nach Aufgabe, nicht jeder Punkt ist immer zutreffend):
- Ursache/Kontext in Kurzform
- geänderte Dateien
- Testschritte mit erwartetem Ergebnis
- Ergebnis von `npx tsc --noEmit` (vorher/nachher, falls Code geändert wurde)
- PR-Link und Merge-Commit
- bei einem `versionCode`-Bump: die Play-Store-Versionshinweise nach der Regel oben

Gilt zusätzlich zu den einzelnen Aufgaben-Instruktionen des Nutzers, nicht als Ersatz dafür.
