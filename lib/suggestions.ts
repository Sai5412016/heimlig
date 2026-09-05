// lib/suggestions.ts — the starter cards shown in an empty shopping list / task list.
//
// Why they exist: of the accounts that reached the app at all, two thirds never created a single
// row. The empty screen asked them to think of something first ("Add your first item"), which is
// the hardest possible first step. These cards turn it into one tap.
//
// The keys are stable ids, never the visible text — the label comes from lib/locales, so the
// cards are German or English along with the rest of the UI. The stored row still gets the
// translated label as its title, which is what the user just read on the card.
//
// Dismissal is per household and per list, stored device-locally (same reasoning as
// lib/soloBanner.ts): somebody who waves away the shopping suggestions may still want the task
// ones, and in a second household they may want both again.
import AsyncStorage from '@react-native-async-storage/async-storage';

export type SuggestionScope = 'shopping' | 'tasks';

export interface Suggestion {
  /** Stable id — the locale key and the dismissal key, never shown to the user. */
  key: string;
  emoji: string;
}

export const SHOPPING_SUGGESTIONS: Suggestion[] = [
  { key: 'milk', emoji: '🥛' },
  { key: 'bread', emoji: '🍞' },
  { key: 'toiletPaper', emoji: '🧻' },
  { key: 'washingUpLiquid', emoji: '🧴' },
  { key: 'coffee', emoji: '☕' },
  { key: 'binBags', emoji: '🗑️' },
  { key: 'toothpaste', emoji: '🪥' },
  { key: 'butter', emoji: '🧈' },
];

// Category is the stored German key from the fixed task catalogue (see CONTEXT.md) — all six are
// chores, so they all land in 'Haushalt'. Deliberately no due date and no recurrence: a card that
// silently created a repeating Monday task would add more than the user could see on it.
export const TASK_SUGGESTIONS: (Suggestion & { category: string })[] = [
  { key: 'cleanBathroom', emoji: '🛁', category: 'Haushalt' },
  { key: 'cleanKitchen', emoji: '🍽️', category: 'Haushalt' },
  { key: 'takeOutBins', emoji: '🗑️', category: 'Haushalt' },
  { key: 'emptyDishwasher', emoji: '🍴', category: 'Haushalt' },
  { key: 'vacuum', emoji: '🧹', category: 'Haushalt' },
  { key: 'doLaundry', emoji: '🧺', category: 'Haushalt' },
];

const keyFor = (scope: SuggestionScope, householdId: string) =>
  `@heimlig/suggestionsDismissed:${scope}:${householdId}`;

export async function loadDismissedSuggestions(scope: SuggestionScope, householdId: string): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(scope, householdId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((k): k is string => typeof k === 'string') : [];
  } catch {
    // Unreadable or corrupt — show every card rather than hiding ones nobody dismissed.
    return [];
  }
}

export async function dismissSuggestion(scope: SuggestionScope, householdId: string, key: string): Promise<void> {
  try {
    const current = await loadDismissedSuggestions(scope, householdId);
    if (current.includes(key)) return;
    await AsyncStorage.setItem(keyFor(scope, householdId), JSON.stringify([...current, key]));
  } catch {
    // Best effort: the card stays gone for this session via local state, it just returns later.
  }
}
