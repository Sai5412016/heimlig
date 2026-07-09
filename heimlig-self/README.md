# Heimlig Self

Das persönliche Gegenstück zu [Heimlig](../README.md) — siehe [`VISION.md`](./VISION.md) für
die volle Produktvision. Dieser Ordner ist ein **eigenständiges Expo-Projekt** mit eigenem
`package.json`/`app.json`/Supabase-Backend; die Haupt-App (`/`) bleibt davon unberührt.

Aktueller Stand: **Grundgerüst** — Login/Registrierung, Sprachwahl (DE/EN), Dark Mode, eigenes
Farbdesign, Tab-Navigation mit Platzhalter-Screens für alle 8 Module aus der Vision. Die
eigentlichen Tracking-Features sind noch nicht gebaut.

## Setup

```bash
cd heimlig-self
npm install
cp .env.example .env   # dann echte Supabase-URL + anon key eintragen
npx expo start --web   # oder --android / --ios
```

`.env` wird nicht committet (siehe `.gitignore`). `EXPO_PUBLIC_*`-Variablen landen im Client-
Bundle, das ist bei Expo so vorgesehen — der anon key ist bewusst öffentlich, RLS macht die
Tabellen sicher (siehe `supabase/schema.sql`).

## Backend

Eigenes Supabase-Projekt, getrennt von Heimligs Household-Datenbank. Schema in
[`supabase/schema.sql`](./supabase/schema.sql) — einmalig im SQL-Editor des neuen Projekts
ausführen (oder per Supabase-MCP `apply_migration`). Enthält aktuell nur `profiles`
(Anzeigename, Avatarfarbe, Sprache, Dark-Mode) — die Modul-Datenmodelle (Energy/Body/Mind/…)
kommen, sobald die jeweiligen Features gebaut werden.

## Offene Follow-ups (bewusst nicht Teil des Grundgerüsts)

- **`eas init`**: `app.json` hat noch keine `extra.eas.projectId`. Braucht einen interaktiven
  `eas login` (oder `EXPO_TOKEN` env var) — einmalig lokal/CI ausführen:
  `npx eas init` im Ordner `heimlig-self/`, danach `eas.json`-Env-Blöcke mit den echten
  Supabase-Keys befüllen (aktuell `TODO_set_after_eas_init`).
- **Vercel-Web-Deploy**: noch keine `vercel.json`/Projekt-Verknüpfung für Heimlig Self.
- **Echte Modul-Features**: Energy Score, Body-Tracking, Mind/Journal, Growth, Purpose,
  Habits, Focus und der AI Coach sind aktuell nur Platzhalter-Screens
  (`components/ModuleStub.tsx`, `app/module/[key].tsx`).
- **App-Icons/Illustrationen**: `assets/*.png` sind einfarbige Platzhalter in Brand-Lila,
  kein finales Icon-Design.

## Konventionen

Gleiche Muster wie die Haupt-App (`heimlig/`): `constants/theme.ts` + `hooks/useTheme.ts` für
Farben/Spacing, `zustand`-Store in `store/useStore.ts`, Supabase-Client in `lib/supabase.ts`.
Sprache läuft über `lib/i18n.ts` (`useT()`-Hook, Dictionary-Keys statt Freitext in Components).
