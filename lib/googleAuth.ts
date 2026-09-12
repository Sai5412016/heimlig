// lib/googleAuth.ts — "Mit Google anmelden": native account picker via
// @react-native-google-signin/google-signin, feeding straight into Supabase Auth.
//
// Deliberately NOT supabase.auth.signInWithOAuth() — that opens a browser tab/WebView for the
// whole exchange. This uses the native module instead, so the user only ever sees Android's own
// account picker, no browser detour. (lib/googleCalendar.ts's Calendar connection is a SEPARATE,
// unrelated OAuth flow via expo-auth-session — that one legitimately needs a browser since it's
// requesting Calendar API scopes for direct Google API calls, not signing in to Heimlig itself.)
import { Platform } from 'react-native';
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
    // Forces the account picker to appear every time, even though Google/Play Services will
    // otherwise silently remember the last account and skip it entirely on a later signIn()
    // call. That silent reuse is the exact bug this addresses: after signing out of Heimlig (or
    // even within the same install, e.g. wanting to switch accounts), tapping "Mit Google
    // anmelden" again re-authenticated with the SAME account with no picker and no way to choose
    // a different one short of clearing the app's storage — a convenience that is actively in
    // the way for an explicit, user-initiated sign-in. Harmless if there is nothing cached
    // (Google's SDK treats that as a no-op), and never allowed to block the actual sign-in
    // attempt below if it fails for some other reason.
    try { await GoogleSignin.signOut(); } catch { /* nothing cached, or it failed — proceed regardless */ }

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

// Call this wherever Heimlig signs the user out (supabase.auth.signOut()) — clears the NATIVE
// Google Sign-In module's own cached account too, not just Heimlig's Supabase session. Without
// this, GoogleSignin keeps remembering the last account across a Heimlig sign-out, so a later
// "Mit Google anmelden" tap silently re-authenticates with the same account, no picker shown —
// the account could only be switched by clearing the app's storage entirely.
//
// Checked cleanly via GoogleSignin.getCurrentUser() — a local, synchronous, no-network read of
// the module's own cached state — rather than guessed (e.g. from Supabase's provider metadata,
// which says how the CURRENT session was created, not whether this device's native module has
// anything cached to sign out of). No-ops on web (no native module there) and whenever nothing
// is cached. Never throws and never blocks the caller's own signOut() — every failure here is
// swallowed, since a failed Google sign-out must not prevent the user from actually leaving
// their Heimlig session.
export async function signOutOfGoogle(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    if (!GoogleSignin.getCurrentUser()) return;
    await GoogleSignin.signOut();
  } catch (e) {
    console.warn('[googleAuth] GoogleSignin.signOut() failed —', e);
  }
}

// ─── Web counterpart ────────────────────────────────────────────────────────────────────────
// There is no native account picker on web, so this redirects the whole page to Google's own
// consent screen instead — supabase.auth.signInWithOAuth() does that navigation itself
// (GoTrueClient calls window.location.assign() internally on a browser). Deliberately still not
// signInWithIdToken-adjacent magic: this is the one legitimate use of signInWithOAuth in this
// app, precisely because web has no native picker to call into.
export async function signInWithGoogleWeb(): Promise<{ ok: boolean }> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    // MUST be the CURRENT origin, not a hardcoded one — unlike emailRedirectTo/
    // resetPasswordForEmail elsewhere in this app, this redirect round-trips through a
    // DIFFERENT site (Google) and back, and the pending invite code it needs to survive that
    // trip lives in this origin's localStorage (see lib/inviteFunnel.ts). A visitor who opened
    // an invite link lands on heimlig.app, not heimlig.vercel.app — hardcoding the latter here
    // sent them back to an origin that can't see the code their invite link saved, breaking the
    // exact case this whole feature is for. localStorage is never shared across origins, so this
    // has to match wherever the user actually is, not a fixed canonical domain.
    options: { redirectTo: `${window.location.origin}/onboarding` },
  });
  if (error) {
    // Only reached if signInWithOAuth failed before it could even redirect (e.g. it couldn't
    // reach Supabase to build the provider URL) — a successful call navigates the tab away
    // almost immediately, leaving nothing else for the caller to do.
    console.warn('[googleAuth] signInWithOAuth (web) failed to start —', error.message);
    return { ok: false };
  }
  return { ok: true };
}

export interface GoogleWebRedirectResult {
  // Whether the current URL actually carried anything from a Google redirect at all — false on
  // an ordinary page load with nothing to process, in which case `ok`/`cancelled` are moot.
  handled: boolean;
  ok: boolean;
  cancelled?: boolean;
}

// Completes the round trip started by signInWithGoogleWeb(): call once when the page named in
// its redirectTo mounts. This project's Supabase client has detectSessionInUrl: false (see
// lib/supabase.ts — needed so expo-router's own URL handling doesn't fight with it) AND uses the
// default 'implicit' flowType (never overridden anywhere in this codebase), so Google's redirect
// back here lands the session as a #access_token=...&refresh_token=... URL hash fragment, not a
// ?code=... query param — nothing parses that automatically. Same shape, same fix, as the
// password-recovery link app/reset-password.tsx already handles by hand.
export async function completeGoogleWebSignIn(): Promise<GoogleWebRedirectResult> {
  if (typeof window === 'undefined') return { handled: false, ok: false };
  const hash = window.location.hash || '';
  if (!hash) return { handled: false, ok: false };
  const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);

  const errorCode = params.get('error') || params.get('error_code');
  if (errorCode) {
    // Scrub the hash either way — an error left sitting in the URL would re-trigger this same
    // handling on every subsequent reload of this page.
    window.history.replaceState(null, '', window.location.pathname);
    return { handled: true, ok: false, cancelled: errorCode === 'access_denied' };
  }

  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (!access_token || !refresh_token) return { handled: false, ok: false };

  const { error } = await supabase.auth.setSession({ access_token, refresh_token });
  window.history.replaceState(null, '', window.location.pathname);
  if (error) {
    console.warn('[googleAuth] setSession from Google redirect failed —', error.message);
    return { handled: true, ok: false };
  }
  return { handled: true, ok: true };
}
