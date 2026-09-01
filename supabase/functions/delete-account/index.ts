// supabase/functions/delete-account/index.ts
// Self-service account deletion, required by Google Play policy for any app with accounts.
//
// The interesting half of this lives in Postgres, not here: public.delete_account() walks every
// household the user belongs to, hands the admin role over where needed, and either removes or
// anonymises the membership row — all in one transaction with the household row locked, so a
// join happening at the same moment can't strand a household without an admin. See
// supabase/manual_migrations/2026-09-01_account_deletion.sql for why an anonymised tombstone is
// the right answer rather than a plain delete (nine of the ten foreign keys pointing at `members`
// are NO ACTION, so a member with any content simply cannot be deleted).
//
// Order matters and is deliberate: memberships first, auth user second. If the auth deletion
// fails, the caller still has an account they can retry with. The other way round would leave an
// unreachable orphan.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Typed out in full rather than shared, same as the other five functions in this project.
const ALLOWED_ORIGINS = new Set([
  'https://heimlig.app',
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

serve(async (req) => {
  const cors = corsHeaders(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) {
      console.error('delete-account: request had no Authorization bearer token');
      return json({ ok: false, error: 'unauthorized' }, 401);
    }

    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser(token);
    if (authError || !user) {
      console.error('delete-account: auth.getUser failed —', authError?.message ?? 'no user on the session');
      return json({ ok: false, error: 'unauthorized' }, 401);
    }

    // A fixed English literal, not the word the user typed. The UI asks for "LÖSCHEN"/"DELETE"
    // depending on the app language and only sends this once its own check passed — so the
    // confirmation string never has to change when a language is added.
    const body = await req.json().catch(() => ({}));
    if (body?.confirm !== 'DELETE') {
      console.error(`delete-account: user ${user.id} sent a request without the confirmation token`);
      return json({ ok: false, error: 'confirmation_required' }, 400);
    }

    // Service role: this deliberately bypasses RLS. delete_account() is granted to service_role
    // only, precisely because it takes a user id as an argument — reachable from a client, it
    // would let anyone wipe someone else's memberships. The id passed here is always the one
    // from the verified JWT above, never anything out of the request body.
    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: summary, error: rpcError } = await serviceClient.rpc('delete_account', {
      p_user_id: user.id,
    });
    if (rpcError) {
      console.error('delete-account: delete_account RPC failed —', rpcError.code, rpcError.message);
      return json({ ok: false, error: 'deletion_failed' }, 500);
    }

    // What happened per household — household deleted, membership removed, or membership
    // anonymised, plus who inherited admin. No names of anyone else, no content.
    console.log(`delete-account: memberships settled for user ${user.id} —`, JSON.stringify(summary));

    const { error: deleteError } = await serviceClient.auth.admin.deleteUser(user.id);
    if (deleteError) {
      // The memberships are already gone at this point, so the account is hollow but still
      // loginable. Surfaced as an error rather than swallowed: it needs a manual follow-up,
      // and the log line above says exactly how far the run got.
      console.error('delete-account: auth user deletion failed after memberships were settled —', deleteError.message);
      return json({ ok: false, error: 'auth_deletion_failed' }, 500);
    }

    console.log(`delete-account: auth user ${user.id} deleted`);
    return json({ ok: true });
  } catch (e) {
    console.error('delete-account: unhandled error —', errMsg(e));
    return json({ ok: false, error: 'internal_error' }, 500);
  }
});
