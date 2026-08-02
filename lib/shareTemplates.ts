// lib/shareTemplates.ts — pre-written, person-independent sentences for sharing Heimlig on
// social media. Deliberately NO dynamic user data (names, birthdays, household specifics) —
// only generic lines that fit any household the same way, so this can never accidentally leak
// private data into a public post (this rules out reusing e.g. the birthday-reminder feature's
// text, which is name-specific by design).
import type { SupportedLanguage } from './i18n';

const STORE_URL = 'https://play.google.com/store/apps/details?id=com.fledderman.heimlig';

const TEMPLATES: Record<SupportedLanguage, string[]> = {
  de: [
    `Ich habe erfolgreich einen Termin wahrgenommen, ohne ihn zu vergessen. 📅✅ Dank Heimlig läuft der Haushalt wie am Schnürchen. ${STORE_URL}`,
    `Einkaufsliste erledigt, ohne dass jemand doppelt Milch gekauft hat. 🛒 Team-Achievement unlocked mit Heimlig. ${STORE_URL}`,
    `Haushaltsbudget im Blick, ganz ohne Excel-Tabellen-Trauma. 💶 Heimlig macht's möglich. ${STORE_URL}`,
    `Aufgabe erledigt, Punkte kassiert, Ego gestreichelt. 🏆 So macht Haushalt fast Spaß – mit Heimlig. ${STORE_URL}`,
    `Kein „Wer war eigentlich dran?" mehr – bei uns übernimmt das Heimlig. 🔄 ${STORE_URL}`,
    `Rezept gefunden, Zutaten automatisch auf der Einkaufsliste. 🍳 Kochen war selten so entspannt. Heimlig sei Dank. ${STORE_URL}`,
    `Diese Woche: null vergessene Termine, null Streit ums Putzen. Heimlig macht's möglich. 🏡✨ ${STORE_URL}`,
    `Offiziell bestätigt: Haushalts-MVP der Woche. 🥇 Danke, Heimlig. ${STORE_URL}`,
  ],
  en: [
    `I successfully made it to an appointment without forgetting it. 📅✅ Heimlig keeps my household running smoothly. ${STORE_URL}`,
    `Shopping list done, and nobody bought milk twice. 🛒 Team achievement unlocked with Heimlig. ${STORE_URL}`,
    `Household budget under control, no spreadsheet trauma involved. 💶 Heimlig makes it possible. ${STORE_URL}`,
    `Task completed, points collected, ego stroked. 🏆 Chores are almost fun with Heimlig. ${STORE_URL}`,
    `No more "wait, whose turn was it?" — Heimlig's got that covered. 🔄 ${STORE_URL}`,
    `Found a recipe, ingredients landed on the shopping list automatically. 🍳 Cooking has rarely been this easy. Thanks, Heimlig. ${STORE_URL}`,
    `This week: zero forgotten appointments, zero chore arguments. Heimlig makes it possible. 🏡✨ ${STORE_URL}`,
    `Officially confirmed: household MVP this week. 🥇 Thanks, Heimlig. ${STORE_URL}`,
  ],
};

export function randomShareText(language: SupportedLanguage): string {
  const list = TEMPLATES[language] ?? TEMPLATES.de;
  return list[Math.floor(Math.random() * list.length)];
}
