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
die Play Console:

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
