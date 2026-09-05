// lib/householdChoice.ts — remembers "I want to create a household called X" / "I want to join
// with code Y" from BEFORE the account existed, so the choice survives the way to a session.
//
// Why it has to survive anything at all: the two RPCs that do the work
// (create_household_for_user, join_household_by_code) both require auth.uid(). The choice is
// therefore made on one screen and executed on another, and in between the user may leave the
// app entirely to click a confirmation link in their mail client. React state does not survive
// that; AsyncStorage does. Exactly the same reasoning, and the same storage, as the pending
// invite code in lib/inviteFunnel.ts.
//
// PRECEDENCE: if a deep-link invite code is also waiting, that one wins. Somebody who tapped a
// specific invitation has stated a more concrete intent than whatever they typed on the
// household screen earlier, and the two would otherwise send them to different households.
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@heimlig/pendingHouseholdChoice';

export type PendingHouseholdChoice =
  | { mode: 'create'; name: string }
  | { mode: 'join'; code: string };

export async function savePendingHouseholdChoice(choice: PendingHouseholdChoice): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(choice));
  } catch {
    // Best effort: the screen still holds the choice in state for this session.
  }
}

export async function getPendingHouseholdChoice(): Promise<PendingHouseholdChoice | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.mode === 'create' && typeof parsed.name === 'string') return { mode: 'create', name: parsed.name };
    if (parsed?.mode === 'join' && typeof parsed.code === 'string') return { mode: 'join', code: parsed.code };
    return null;
  } catch {
    // Unreadable or from an older shape — treat as "no choice" rather than acting on a guess.
    return null;
  }
}

export async function clearPendingHouseholdChoice(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // Best effort. A stale entry only ever pre-fills a field the user can still change.
  }
}
