// lib/reviewPrompt.ts — asks for a Play Store rating via the native Google Play In-App Review
// API, once, after the user has been meaningfully active on at least 3 different days. No
// "Do you like the app?" pre-prompt and no incentive — Play policy requires the native flow to
// appear on its own judgement (Google may skip showing anything, e.g. if the quota is used up),
// so this only ever *requests* a review, it never confirms one was shown.
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';

const ACTIVE_DAYS_KEY = '@heimlig/reviewActiveDays';
const ASKED_KEY = '@heimlig/reviewAsked';
const THRESHOLD_DAYS = 3;

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function recordActivityDay(): Promise<void> {
  const raw = await AsyncStorage.getItem(ACTIVE_DAYS_KEY);
  const days: string[] = raw ? JSON.parse(raw) : [];
  const today = todayKey();
  if (!days.includes(today)) {
    days.push(today);
    await AsyncStorage.setItem(ACTIVE_DAYS_KEY, JSON.stringify(days));
  }
}

async function maybeRequestReview(): Promise<void> {
  const alreadyAsked = await AsyncStorage.getItem(ASKED_KEY);
  if (alreadyAsked) return;

  const raw = await AsyncStorage.getItem(ACTIVE_DAYS_KEY);
  const days: string[] = raw ? JSON.parse(raw) : [];
  if (days.length < THRESHOLD_DAYS) return;

  // The platform check lives HERE, not in notifyUserAction. It used to sit at the top of that
  // function and cut it short before recordActivityDay ran, so browser use never counted towards
  // the threshold at all: somebody who mostly uses Heimlig on the web and then picks up their
  // phone started from zero. Days are cheap to record and platform-independent; only this native
  // flow is not. expo-store-review has no web implementation — from a browser, the manual
  // "Heimlig bewerten" entry in the household settings is the way to rate.
  if (Platform.OS === 'web') return;

  const available = await StoreReview.isAvailableAsync();
  if (!available) return;

  // Set the flag before requesting, not after: requestReview() only ever resolves once the
  // native flow is dismissed, and it must not be possible to trigger it a second time in the
  // meantime (e.g. a fast second action while the modal is still up).
  await AsyncStorage.setItem(ASKED_KEY, '1');
  await StoreReview.requestReview();
}

// Call after a meaningful user action (adding a shopping item, completing a task, saving a
// recipe/note, adding a transaction). Fire-and-forget from call sites — never awaited, never
// allowed to throw into the caller.
export function notifyUserAction(): void {
  // Counted on every platform, web included — see the note in maybeRequestReview.
  recordActivityDay()
    .then(maybeRequestReview)
    .catch(() => {
      // Never let a rating prompt break the action that triggered it.
    });
}
