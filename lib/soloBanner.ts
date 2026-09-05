// lib/soloBanner.ts — remembers that somebody dismissed the "you're still alone here" banner
// in the shopping tab (app/(tabs)/shopping.tsx).
//
// PER HOUSEHOLD, and DEVICE-LOCAL. Two deliberate choices:
//
// Per household, because somebody can belong to several: dismissing the nudge in a household
// they genuinely live in alone must not silence it in a second one they just created and do
// want to fill.
//
// Device-local (AsyncStorage, same pattern as darkMode/themeId/language), because the honest
// household-wide answer is households.household_type = 'solo', and nothing sets that any more:
// the onboarding step that used to ask was dropped when the start flow was rebuilt. Writing it
// from here would be guessing an answer the user never gave — "I don't want to see this banner"
// is not the same statement as "I live alone". Task #2 / variant B is where that question gets
// asked properly; until then this is a mute button, not a setting.
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_PREFIX = '@heimlig/soloBannerDismissed:';

export async function isSoloBannerDismissed(householdId: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY_PREFIX + householdId)) === '1';
  } catch {
    // Storage unavailable — show the banner rather than hiding something the user never dismissed.
    return false;
  }
}

export async function dismissSoloBanner(householdId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY_PREFIX + householdId, '1');
  } catch {
    // Best effort: the banner stays hidden for this session either way (local state), it just
    // comes back on the next launch.
  }
}
