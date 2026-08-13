// lib/billing.ts — Play Billing (subscription) infrastructure for Heimlig Premium.
//
// Purchases are never written to the `purchases` table from here — the client only ever
// forwards the purchase token to the verify-purchase edge function, which validates it
// against the Google Play Developer API server-side before granting anything. A client
// could otherwise just fabricate a token and unlock Premium for free.
import { Platform } from 'react-native';
import {
  initConnection, endConnection, fetchProducts, requestPurchase, finishTransaction,
  getAvailablePurchases, purchaseUpdatedListener, purchaseErrorListener,
  type Purchase, type ProductSubscriptionAndroid,
} from 'expo-iap';
import { supabase } from './supabase';
import i18n from './i18n';

export const PREMIUM_PRODUCT_ID = 'heimlig_premium_monthly';

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
      try { serverError = (await error.context?.json())?.error; } catch { /* best-effort */ }
      return { ok: false, error: serverError };
    }
    if (!data?.valid) return { ok: false, error: data?.error };
    // Non-consumable (a subscription, not a coin pack) — don't consume the token.
    await finishTransaction({ purchase, isConsumable: false });
    return { ok: true };
  } catch (e) {
    console.warn('[billing] verifyAndFinish failed', e);
    return { ok: false };
  }
}

// Connects to the Play Billing service and starts listening for purchase results. Call once
// at app start (see app/_layout.tsx) — safe to call again, it's a no-op once connected.
// householdId is only needed for purchases that complete *after* this call (e.g. a purchase
// that didn't finish before the app was killed and replays on the next launch); pass the
// currently active household so verifyAndFinish has somewhere to attribute it to.
export async function initBilling(householdId: string | undefined): Promise<boolean> {
  if (Platform.OS !== 'android' || connected) return connected;
  try {
    await initConnection();
    connected = true;
    updateSub = purchaseUpdatedListener(async (purchase) => {
      const result = householdId ? await verifyAndFinish(purchase, householdId) : { ok: false as const };
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
  updateSub?.remove(); updateSub = null;
  errorSub?.remove(); errorSub = null;
  if (connected) { void endConnection(); connected = false; }
}

// Starts the native purchase dialog for PREMIUM_PRODUCT_ID. Resolves once the purchase has
// actually been verified server-side (not just "dialog opened") — see pendingResolve above.
export async function purchasePremium(householdId: string): Promise<PurchaseResult> {
  if (Platform.OS !== 'android') return { success: false, error: i18n.t('premiumModal.unsupportedPlatform') };
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
