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

async function getGoogleAccessToken(): Promise<string> {
  const creds = JSON.parse(GOOGLE_SERVICE_ACCOUNT_JSON!) as { client_email: string; private_key: string };

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

  const key = await crypto.subtle.importKey(
    'pkcs8', pemToArrayBuffer(creds.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'],
  );
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  const jwt = `${unsigned}.${base64url(new Uint8Array(signature))}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${encodeURIComponent(jwt)}`,
  });
  if (!res.ok) throw new Error(`google oauth token exchange failed: ${res.status}`);
  const data = await res.json();
  return data.access_token as string;
}

// Validates a subscription purchase token via the current Play Developer API
// (purchases.subscriptionsv2 — the v3 purchases.subscriptions.get endpoint it replaced is
// deprecated). Active or in-grace-period counts as a valid, still-paying subscriber.
async function verifyAndroidSubscription(purchaseToken: string): Promise<{ valid: boolean; expiresAt: string | null }> {
  const accessToken = await getGoogleAccessToken();
  const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${ANDROID_PACKAGE_NAME}/purchases/subscriptionsv2/tokens/${purchaseToken}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) return { valid: false, expiresAt: null };
  const data = await res.json();
  const state = data.subscriptionState as string | undefined;
  const valid = state === 'SUBSCRIPTION_STATE_ACTIVE' || state === 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD';
  const expiresAt = data.lineItems?.[0]?.expiryTime ?? null;
  return { valid, expiresAt };
}

serve(async (req) => {
  const cors = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) return new Response(JSON.stringify({ valid: false, error: 'unauthorized' }), { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } });

    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authError } = await authClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ valid: false, error: 'unauthorized' }), { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    const { data: allowed, error: rlError } = await authClient.rpc('rl_hit', { p_bucket: 'verify-purchase', p_limit: 20 });
    if (!rlError && allowed === false) {
      return new Response(JSON.stringify({ valid: false, error: 'Zu viele Anfragen, bitte später erneut versuchen.' }), { status: 429, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    const { purchaseToken, productId, platform, householdId } = await req.json();
    if (!purchaseToken || !productId || !platform || !householdId) {
      return new Response(JSON.stringify({ valid: false, error: 'missing fields' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    // Confirm the caller actually belongs to the household they're claiming Premium for —
    // this endpoint is about to grant a real entitlement, so don't just trust the client.
    const { data: membership } = await authClient
      .from('members').select('id').eq('user_id', user.id).eq('household_id', householdId).maybeSingle();
    if (!membership) {
      return new Response(JSON.stringify({ valid: false, error: 'not a member of this household' }), { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    if (platform !== 'android') {
      // TODO: iOS verification (App Store Server API) isn't implemented — out of scope for
      // this Play-Billing-only pass.
      return new Response(JSON.stringify({ valid: false, error: 'platform not supported yet' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    if (!GOOGLE_SERVICE_ACCOUNT_JSON) {
      console.error('verify-purchase: GOOGLE_SERVICE_ACCOUNT_JSON secret not set yet');
      return new Response(JSON.stringify({ valid: false, error: 'billing verification not configured yet' }), { status: 503, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    let result: { valid: boolean; expiresAt: string | null };
    try {
      result = await verifyAndroidSubscription(purchaseToken);
    } catch (e) {
      console.error('verify-purchase: Google verification failed', e);
      return new Response(JSON.stringify({ valid: false, error: 'verification failed' }), { status: 502, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    if (!result.valid) {
      return new Response(JSON.stringify({ valid: false }), { headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    // Service-role client bypasses RLS for the actual write — this is the only place
    // `purchases` or a plan_tier upgrade ever gets written from, deliberately unreachable
    // directly from the client (see the migration's RLS comment).
    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    await serviceClient.from('purchases').upsert({
      user_id: user.id,
      household_id: householdId,
      product_id: productId,
      purchase_token: purchaseToken,
      platform,
      status: 'active',
      expires_at: result.expiresAt,
    }, { onConflict: 'purchase_token' });

    // Additive only: this never touches a household that's already 'premium' (incl.
    // manually-granted testers), 'premium_plus' or 'family' — only upgrades a 'free' one.
    // Downgrading on expiry/cancellation is explicitly out of scope for this pass (needs
    // Real-time Developer Notifications, a separate follow-up task).
    await serviceClient.from('households').update({ plan_tier: 'premium' }).eq('id', householdId).eq('plan_tier', 'free');

    return new Response(JSON.stringify({ valid: true, expiresAt: result.expiresAt }), { headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('verify-purchase error:', e);
    return new Response(JSON.stringify({ valid: false, error: 'internal error' }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});
