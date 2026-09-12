// lib/googleAuth.ts — "Mit Google anmelden": native account picker via
// @react-native-google-signin/google-signin, feeding straight into Supabase Auth.
//
// Deliberately NOT supabase.auth.signInWithOAuth() — that opens a browser tab/WebView for the
// whole exchange. This uses the native module instead, so the user only ever sees Android's own
// account picker, no browser detour. (lib/googleCalendar.ts's Calendar connection is a SEPARATE,
// unrelated OAuth flow via expo-auth-session — that one legitimately needs a browser since it's
// requesting Calendar API scopes for direct Google API calls, not signing in to Heimlig itself.)
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { supabase } from './supabase';
import { GOOGLE_OAUTH } from '../constants/google';

let configured = false;
// GoogleSignin.configure() only needs to run once per app session — repeating it is harmless
// but pointless, so this just guards against calling it on every button tap.
function ensureConfigured(): void {
  if (configured) return;
  GoogleSignin.configure({ webClientId: GOOGLE_OAUTH.webClientId });
  configured = true;
}

export interface GoogleSignInResult {
  ok: boolean;
  // True when the user closed the account picker themselves — not an error, nothing to show.
  cancelled?: boolean;
  errorCode?: 'play_services_unavailable' | 'generic';
  // Google's own display name for the account, so the caller can prefill the name step.
  displayName?: string | null;
}

// Never throws — every failure path (including ones this library documents but this app has no
// special handling for) resolves to a GoogleSignInResult so the caller never needs a try/catch.
export async function signInWithGoogle(): Promise<GoogleSignInResult> {
  ensureConfigured();
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();
    if (response.type === 'cancelled') {
      return { ok: false, cancelled: true };
    }

    const idToken = response.data.idToken;
    if (!idToken) {
      // Documented as possible (User.idToken is typed string | null) even on a 'success'
      // response — nothing usable came back, so this is a failure from Heimlig's point of view.
      console.warn('[googleAuth] Google sign-in succeeded but returned no idToken');
      return { ok: false, errorCode: 'generic' };
    }

    const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: idToken });
    if (error) {
      // Only the message/code — never the token itself.
      console.warn('[googleAuth] supabase.auth.signInWithIdToken rejected the token —', error.message);
      return { ok: false, errorCode: 'generic' };
    }

    return { ok: true, displayName: response.data.user.name };
  } catch (e: any) {
    if (e?.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      return { ok: false, errorCode: 'play_services_unavailable' };
    }
    // Every other failure this library can throw — no network, IN_PROGRESS, a native error with
    // some other code, anything unexpected — collapses into one generic bucket. There is no
    // exhaustive list of native failure codes worth branching the UI on individually, and a
    // network problem is by far the most common cause of an unrecognized failure here, so the
    // generic message below leads with that.
    console.warn('[googleAuth] Google sign-in failed —', e?.code ?? e?.message ?? e);
    return { ok: false, errorCode: 'generic' };
  }
}
