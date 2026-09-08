// lib/billing.ts — Play Billing (subscription) infrastructure for Heimlig Premium.
//
// Purchases are never written to the `purchases` table from here — the client only ever
// forwards the purchase token to the verify-purchase edge function, which validates it
// against the Google Play Developer API server-side before granting anything. A client
// could otherwise just fabricate a token and unlock Premium for free.
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  initConnection, endConnection, fetchProducts, requestPurchase, finishTransaction,
  getAvailablePurchases, purchaseUpdatedListener, purchaseErrorListener,
  type Purchase, type ProductSubscriptionAndroid,
} from 'expo-iap';
import { supabase } from './supabase';
import i18n from './i18n';
import { Sentry } from './sentry';

export const PREMIUM_PRODUCT_ID = 'heimlig_premium_monthly';

// Remembers the last purchase token that verify-purchase confirmed as active, purely so
// checkSubscriptionStatusOnLaunch() below has something to re-verify later — once a
// subscription expires or is cancelled, Google Play can stop returning it from
// getAvailablePurchases() entirely, which is what restorePurchases() relies on, so that path
// alone would never notice the expiry and downgrade plan_tier.
const LAST_VERIFIED_TOKEN_KEY = '@heimlig/lastVerifiedPurchaseToken';
const LAST_STATUS_CHECK_KEY = '@heimlig/lastPurchaseStatusCheckAt';
const STATUS_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

export interface PurchaseResult { success: boolean; error?: string }

// verify-purchase returns a specific { error: string } body on failure (see its Response.json()
// shapes) — this maps the ones worth telling the user about differently to their translation,
// everything else falls back to the generic verifyFailed message.
function translateVerifyError(serverError: string | undefined): string {
  if (serverError === 'billing verification not configured yet') return i18n.t('premiumModal.notConfigured');
  return i18n.t('premiumModal.verifyFailed');
}

let connected = false;
let updateSub: { remove: () => void } | null = null;
let errorSub: { remove: () => void } | null = null;
// requestPurchase() only *dispatches* the native flow — the actual outcome arrives later via
// purchaseUpdatedListener/purchaseErrorListener. This bridges that back to the caller's
// original purchasePremium() promise instead of leaving the UI without a resolution.
let pendingResolve: ((result: PurchaseResult) => void) | null = null;
// The purchaseUpdatedListener below is registered exactly once (initBilling is a no-op after
// the first successful call) and lives for the whole app session, so it must NOT close over a
// householdId captured at registration time — switching households later would leave it
// attributing purchases to the household that happened to be active at app start. It reads
// this module-level value at event time instead. Keep it in sync via setBillingHousehold().
let activeHouseholdId: string | undefined;

// Call this wherever the active household changes (household switch, join, create) so a
// purchase that completes afterwards is attributed to the household the user is actually in.
export function setBillingHousehold(householdId: string | undefined): void {
  activeHouseholdId = householdId;
}

// Returns the raw server error string (e.g. 'billing verification not configured yet') when
// verification fails, so callers can show something more useful than a generic "try again" —
// a 503 because the service account secret isn't set yet is a developer-side issue, not
// something retrying or restoring purchases will ever fix.
async function verifyAndFinish(purchase: Purchase, householdId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('verify-purchase', {
      body: {
        purchaseToken: purchase.purchaseToken,
        productId: purchase.productId,
        platform: 'android',
        householdId,
      },
    });
    if (error) {
      // supabase-js doesn't parse the body on a non-2xx response — the edge function's
      // { error: string } detail lives on error.context (the raw Response), see
      // FunctionsHttpError in @supabase/functions-js.
      let serverError: string | undefined;
      let httpStatus: number | undefined;
      try {
        httpStatus = error.context?.status;
        serverError = (await error.context?.json())?.error;
      } catch { /* best-effort */ }
      // This used to be a silent dead end — a rejection reached the server fine but nothing
      // here recorded which one. Never logs purchaseToken, only the status/error code.
      console.warn('[billing] verify-purchase rejected the purchase —', httpStatus, serverError);
      Sentry.captureMessage('verify-purchase rejected a purchase', { level: 'warning', extra: { httpStatus, serverError } });
      return { ok: false, error: serverError };
    }
    if (!data?.valid) return { ok: false, error: data?.error };
    // Non-consumable (a subscription, not a coin pack) — don't consume the token.
    await finishTransaction({ purchase, isConsumable: false });
    if (purchase.purchaseToken) {
      try { await AsyncStorage.setItem(LAST_VERIFIED_TOKEN_KEY, purchase.purchaseToken); } catch { /* best-effort */ }
    }
    return { ok: true };
  } catch (e) {
    // supabase.functions.invoke() threw before any HTTP response came back at all — a purely
    // client-side failure (offline, DNS, timeout, ...) that never reaches verify-purchase, so
    // there's nothing to find in its logs. Previously swallowed with just a console.warn and no
    // Sentry report, which made this exact failure mode undiagnosable from the client side too.
    console.warn('[billing] verifyAndFinish: supabase.functions.invoke threw before a server response —', e);
    Sentry.captureException(e, { tags: { context: 'verify-purchase-invoke' } });
    return { ok: false, error: 'client_invoke_failed' };
  }
}

// Connects to the Play Billing service and starts listening for purchase results. Call once
// at app start (see app/_layout.tsx) — safe to call again, it's a no-op once connected.
// householdId is only needed for purchases that complete *after* this call (e.g. a purchase
// that didn't finish before the app was killed and replays on the next launch); pass the
// currently active household so verifyAndFinish has somewhere to attribute it to.
export async function initBilling(householdId: string | undefined): Promise<boolean> {
  // Always refresh the target household, even on the early-return path — otherwise a second
  // initBilling() call with a newer household would be silently ignored.
  if (householdId) activeHouseholdId = householdId;
  if (Platform.OS !== 'android' || connected) return connected;
  try {
    await initConnection();
    connected = true;
    updateSub = purchaseUpdatedListener(async (purchase) => {
      const target = activeHouseholdId;
      if (!target) console.warn('[billing] purchase arrived with no active household to attribute it to');
      const result = target ? await verifyAndFinish(purchase, target) : { ok: false as const };
      if (pendingResolve) {
        pendingResolve(result.ok ? { success: true } : { success: false, error: translateVerifyError(result.error) });
        pendingResolve = null;
      }
    });
    errorSub = purchaseErrorListener((error) => {
      console.warn('[billing] purchase error', error);
      if (pendingResolve) {
        pendingResolve({ success: false, error: error.message || i18n.t('premiumModal.purchaseFailed') });
        pendingResolve = null;
      }
    });
    return true;
  } catch (e) {
    console.warn('[billing] initConnection failed', e);
    connected = false;
    return false;
  }
}

export function endBilling(): void {
  activeHouseholdId = undefined;
  updateSub?.remove(); updateSub = null;
  errorSub?.remove(); errorSub = null;
  if (connected) { void endConnection(); connected = false; }
}

// Starts the native purchase dialog for PREMIUM_PRODUCT_ID. Resolves once the purchase has
// actually been verified server-side (not just "dialog opened") — see pendingResolve above.
export async function purchasePremium(householdId: string): Promise<PurchaseResult> {
  if (Platform.OS !== 'android') return { success: false, error: i18n.t('premiumModal.unsupportedPlatform') };
  // Set before the native flow starts: the result comes back through the listener, which reads
  // activeHouseholdId — passing householdId here alone would never reach the verification call.
  activeHouseholdId = householdId;
  if (!connected) await initBilling(householdId);
  if (!connected) return { success: false, error: i18n.t('premiumModal.connectionFailed') };

  try {
    const products = await fetchProducts({ skus: [PREMIUM_PRODUCT_ID], type: 'subs' });
    const sub = (products as ProductSubscriptionAndroid[] | null)?.find(p => p.id === PREMIUM_PRODUCT_ID);
    const offerToken = sub?.subscriptionOffers?.[0]?.offerTokenAndroid;
    if (!offerToken) return { success: false, error: i18n.t('premiumModal.noOfferFound') };

    return await new Promise<PurchaseResult>((resolve) => {
      pendingResolve = resolve;
      requestPurchase({
        request: { google: { skus: [PREMIUM_PRODUCT_ID], subscriptionOffers: [{ sku: PREMIUM_PRODUCT_ID, offerToken }] } },
        type: 'subs',
      }).catch((e) => {
        pendingResolve = null;
        resolve({ success: false, error: e?.message || i18n.t('premiumModal.purchaseFailed') });
      });
    });
  } catch (e: any) {
    return { success: false, error: e?.message || i18n.t('premiumModal.purchaseFailed') };
  }
}

// Google requires restorable purchases to be re-surfaced on app start so a reinstall (or a
// purchase that never got acknowledged, e.g. app was killed mid-flow) still unlocks Premium.
// Returns how many purchases were (re-)verified successfully.
export async function restorePurchases(householdId: string): Promise<number> {
  if (Platform.OS !== 'android') return 0;
  activeHouseholdId = householdId;
  if (!connected) await initBilling(householdId);
  if (!connected) return 0;
  try {
    const purchases = await getAvailablePurchases();
    let restored = 0;
    for (const p of purchases) {
      if ((await verifyAndFinish(p, householdId)).ok) restored++;
    }
    return restored;
  } catch (e) {
    console.warn('[billing] restorePurchases failed', e);
    return 0;
  }
}

// Re-verifies the last known purchase token against Google on app start, at most once every
// 24 hours (timestamp in AsyncStorage) and only if a token was actually saved by a previous
// successful verification. This exists because restorePurchases() above can't be relied on to
// ever notice an expiry — Google Play only returns *currently owned* purchases from
// getAvailablePurchases(), and can simply stop listing a subscription once it's expired or
// cancelled, so there'd be nothing left to re-verify through that path. Calling verify-purchase
// directly with the remembered token closes that gap: the edge function itself decides whether
// to downgrade plan_tier (see its `result.definitive` handling) — this function only triggers
// that check, it never reads or acts on the result itself.
// Must never throw and must never block app startup — every failure (network, invoke, storage)
// is swallowed silently. Safe to call unawaited (fire-and-forget) from app start.
export async function checkSubscriptionStatusOnLaunch(householdId: string): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    const token = await AsyncStorage.getItem(LAST_VERIFIED_TOKEN_KEY);
    if (!token) return;
    const lastCheckedRaw = await AsyncStorage.getItem(LAST_STATUS_CHECK_KEY);
    const lastChecked = lastCheckedRaw ? Number(lastCheckedRaw) : 0;
    if (Date.now() - lastChecked < STATUS_CHECK_INTERVAL_MS) return;
    // Recorded before the network call, not after — so a call that hangs or fails still counts
    // toward the 24h throttle instead of being retried on every subsequent launch.
    await AsyncStorage.setItem(LAST_STATUS_CHECK_KEY, String(Date.now()));
    await supabase.functions.invoke('verify-purchase', {
      body: { purchaseToken: token, productId: PREMIUM_PRODUCT_ID, platform: 'android', householdId },
    });
  } catch {
    /* silent on purpose — see function comment above */
  }
}
