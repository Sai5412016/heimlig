// supabase/functions/verify-purchase/index.ts
// Validates an Android purchase token against the Google Play Developer API and, if valid,
// records it in `purchases` and upgrades the household's plan_tier — all server-side, since
// a client could otherwise just send a fabricated token to unlock Premium for free (this is
// exactly why `purchases` has no client-writable RLS policy at all, see the migration).
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// TODO(Andi): create a Google Cloud service account (Google Cloud Console -> IAM & Admin ->
// Service Accounts -> Create), download its JSON key, then in Play Console -> Users and
// permissions -> Invite new user -> paste the service account's email -> grant "View
// financial data, orders, and cancellation survey responses" for this app. Then set the
// full JSON key file content (unmodified) as this Supabase secret:
//   npx supabase secrets set GOOGLE_SERVICE_ACCOUNT_JSON='<paste JSON here>' --project-ref eabwlyihcmofkbqtbryz
// Until this is set, verification fails clearly (503) instead of silently granting Premium.
const GOOGLE_SERVICE_ACCOUNT_JSON = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON');
const ANDROID_PACKAGE_NAME = 'com.fledderman.heimlig';

const ALLOWED_ORIGINS = new Set([
  'https://heimlig.vercel.app',
  'http://localhost:8081',
  'http://localhost:19006',
]);
function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') || '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.has(origin) ? origin : 'https://heimlig.vercel.app',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  };
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

// ─── Google OAuth2 service-account JWT bearer flow ─────────────────────────────
// No npm JWT libraries available in Deno edge runtime, and this is a small enough flow
// (https://developers.google.com/identity/protocols/oauth2/service-account) to hand-roll
// with the platform's own Web Crypto API instead of pulling in a dependency for it.
function base64url(bytes: Uint8Array | string): string {
  const b = typeof bytes === 'string' ? new TextEncoder().encode(bytes) : bytes;
  let str = '';
  for (const byte of b) str += String.fromCharCode(byte);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----BEGIN PRIVATE KEY-----/, '').replace(/-----END PRIVATE KEY-----/, '').replace(/\s/g, '');
  const raw = atob(b64);
  const buf = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i);
  return buf.buffer;
}

// Throws a descriptive Error (never the secret itself, only Google's/our own diagnostic text)
// on any failure — the caller is responsible for catching, logging and mapping to an error code.
async function getGoogleAccessToken(): Promise<string> {
  let creds: { client_email: string; private_key: string };
  try {
    creds = JSON.parse(GOOGLE_SERVICE_ACCOUNT_JSON!);
    if (!creds.client_email || !creds.private_key) {
      throw new Error('JSON is missing client_email or private_key');
    }
  } catch (e) {
    throw new Error(`GOOGLE_SERVICE_ACCOUNT_JSON secret is not usable: ${errMsg(e)}`);
  }

  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: creds.client_email,
    scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;

  let jwt: string;
  try {
    const key = await crypto.subtle.importKey(
      'pkcs8', pemToArrayBuffer(creds.private_key),
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'],
    );
    const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
    jwt = `${unsigned}.${base64url(new Uint8Array(signature))}`;
  } catch (e) {
    throw new Error(`failed to sign the service-account JWT — check that private_key is a valid PKCS8 PEM: ${errMsg(e)}`);
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${encodeURIComponent(jwt)}`,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '<unreadable body>');
    // Google's OAuth error body (e.g. {"error":"invalid_grant","error_description":"..."})
    // never contains our secret or the assertion — safe to log as-is.
    throw new Error(`Google OAuth token exchange returned ${res.status}: ${body}`);
  }
  const data = await res.json();
  if (!data.access_token) throw new Error('Google OAuth response had no access_token field');
  return data.access_token as string;
}

interface VerifyResult { valid: boolean; expiresAt: string | null; errorCode?: string }

// Validates a subscription purchase token via the current Play Developer API
// (purchases.subscriptionsv2 — the v3 purchases.subscriptions.get endpoint it replaced is
// deprecated). Active or in-grace-period counts as a valid, still-paying subscriber. Never
// throws — every failure is caught, logged with context, and turned into a VerifyResult so
// the caller always has a clean value to respond with.
async function verifyAndroidSubscription(purchaseToken: string): Promise<VerifyResult> {
  let accessToken: string;
  try {
    accessToken = await getGoogleAccessToken();
  } catch (e) {
    console.error('verify-purchase: failed to obtain a Google access token —', errMsg(e));
    return { valid: false, expiresAt: null, errorCode: 'google_auth_failed' };
  }

  const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${ANDROID_PACKAGE_NAME}/purchases/subscriptionsv2/tokens/${purchaseToken}`;
  let res: Response;
  try {
    res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  } catch (e) {
    console.error('verify-purchase: network error calling the Play Developer API —', errMsg(e));
    return { valid: false, expiresAt: null, errorCode: 'play_api_error' };
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '<unreadable body>');
    // Google's error body (e.g. {"error":{"code":404,"status":"PERMISSION_DENIED",...}}) is
    // the actual diagnostic here — never the token itself, so it's safe to log in full. Common
    // causes at this status: the service account's Play Console access hasn't propagated yet
    // (can take a while after granting it), a package-name mismatch, or a malformed token.
    console.error(`verify-purchase: Play Developer API (subscriptionsv2) returned ${res.status} —`, body);
    return { valid: false, expiresAt: null, errorCode: 'play_api_error' };
  }

  let data: any;
  try {
    data = await res.json();
  } catch (e) {
    console.error('verify-purchase: could not parse the Play Developer API response as JSON —', errMsg(e));
    return { valid: false, expiresAt: null, errorCode: 'play_api_error' };
  }

  const state = data.subscriptionState as string | undefined;
  const valid = state === 'SUBSCRIPTION_STATE_ACTIVE' || state === 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD';
  if (!valid) {
    // Not a bug — Google answered fine, this is just a real subscription state we don't treat
    // as "currently paying" (e.g. cancelled, on hold, paused, pending). Logged at info level so
    // it's visible without looking like an infra failure.
    console.log(`verify-purchase: subscription found but state '${state}' is not treated as active`);
  }
  const expiresAt = data.lineItems?.[0]?.expiryTime ?? null;
  return { valid, expiresAt };
}

serve(async (req) => {
  const cors = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) {
      console.error('verify-purchase: request had no Authorization bearer token');
      return new Response(JSON.stringify({ valid: false, error: 'unauthorized' }), { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authError } = await authClient.auth.getUser(token);
    if (authError || !user) {
      console.error('verify-purchase: auth.getUser failed —', authError?.message ?? 'no user on the session');
      return new Response(JSON.stringify({ valid: false, error: 'unauthorized' }), { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    const { data: allowed, error: rlError } = await authClient.rpc('rl_hit', { p_bucket: 'verify-purchase', p_limit: 20 });
    if (!rlError && allowed === false) {
      return new Response(JSON.stringify({ valid: false, error: 'Zu viele Anfragen, bitte später erneut versuchen.' }), { status: 429, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    const { purchaseToken, productId, platform, householdId } = await req.json();
    if (!purchaseToken || !productId || !platform || !householdId) {
      // Log which fields showed up, never the values themselves.
      console.error('verify-purchase: missing required fields —', {
        purchaseToken: !!purchaseToken, productId: !!productId, platform: !!platform, householdId: !!householdId,
      });
      return new Response(JSON.stringify({ valid: false, error: 'missing_fields' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    // Confirm the caller actually belongs to the household they're claiming Premium for —
    // this endpoint is about to grant a real entitlement, so don't just trust the client.
    const { data: membership } = await authClient
      .from('members').select('id').eq('user_id', user.id).eq('household_id', householdId).maybeSingle();
    if (!membership) {
      console.error(`verify-purchase: user ${user.id} is not a member of household ${householdId}`);
      return new Response(JSON.stringify({ valid: false, error: 'not_household_member' }), { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    if (platform !== 'android') {
      // TODO: iOS verification (App Store Server API) isn't implemented — out of scope for
      // this Play-Billing-only pass.
      console.error(`verify-purchase: unsupported platform '${platform}' (only 'android' is implemented)`);
      return new Response(JSON.stringify({ valid: false, error: 'platform_not_supported' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    if (!GOOGLE_SERVICE_ACCOUNT_JSON) {
      console.error('verify-purchase: GOOGLE_SERVICE_ACCOUNT_JSON secret not set yet');
      // NOTE: lib/billing.ts's translateVerifyError() matches this exact string — keep them
      // in sync if it ever changes.
      return new Response(JSON.stringify({ valid: false, error: 'billing verification not configured yet' }), { status: 503, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    const result = await verifyAndroidSubscription(purchaseToken);

    if (!result.valid) {
      // google_auth_failed/play_api_error are OUR infra failing to answer the question at all
      // (502); anything else is Google answering "no" for a real reason, e.g. the subscription
      // just isn't active (200, same as any other legitimate "not valid" response).
      const infraFailure = result.errorCode === 'google_auth_failed' || result.errorCode === 'play_api_error';
      return new Response(JSON.stringify({ valid: false, error: result.errorCode ?? 'not_active' }), {
        status: infraFailure ? 502 : 200,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // Service-role client bypasses RLS for the actual write — this is the only place
    // `purchases` or a plan_tier upgrade ever gets written from, deliberately unreachable
    // directly from the client (see the migration's RLS comment).
    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { error: purchaseWriteError } = await serviceClient.from('purchases').upsert({
      user_id: user.id,
      household_id: householdId,
      product_id: productId,
      purchase_token: purchaseToken,
      platform,
      status: 'active',
      expires_at: result.expiresAt,
    }, { onConflict: 'purchase_token' });

    if (purchaseWriteError) {
      // Only .message and .code — a unique-violation's actual offending value lives in
      // .details, which is deliberately never logged (it could echo the purchase_token back).
      console.error('verify-purchase: failed to upsert the purchases row —', purchaseWriteError.code, purchaseWriteError.message);
      return new Response(JSON.stringify({ valid: false, error: 'db_write_failed' }), { status: 502, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    // Additive only: this never touches a household that's already 'premium' (incl.
    // manually-granted testers), 'premium_plus' or 'family' — only upgrades a 'free' one.
    // Downgrading on expiry/cancellation is explicitly out of scope for this pass (needs
    // Real-time Developer Notifications, a separate follow-up task).
    const { error: householdUpdateError } = await serviceClient
      .from('households').update({ plan_tier: 'premium' }).eq('id', householdId).eq('plan_tier', 'free');
    if (householdUpdateError) {
      // Non-fatal: the purchase row above is the source of truth and already saved —
      // restorePurchases() on next app launch will retry this. Still logged since a
      // household that never gets upgraded despite a valid purchase is worth knowing about.
      console.error('verify-purchase: failed to upgrade households.plan_tier —', householdUpdateError.code, householdUpdateError.message);
    }

    return new Response(JSON.stringify({ valid: true, expiresAt: result.expiresAt }), { headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('verify-purchase: unhandled error —', e);
    return new Response(JSON.stringify({ valid: false, error: 'internal_error' }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});
