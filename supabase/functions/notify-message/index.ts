// supabase/functions/notify-message/index.ts
// Sends a push notification to every OTHER member of a household when someone posts to
// the shared pinboard/chat — mirrors a WhatsApp-style "new message" push.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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

serve(async (req) => {
  const cors = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } });

    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authError } = await authClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    const { household_id, sender_member_id, sender_name, text } = await req.json();
    if (!household_id || !sender_member_id || !text) {
      return new Response(JSON.stringify({ error: 'missing fields' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    // Confirm the caller is actually a member of this household (RLS-scoped to their own row).
    const { data: isMember } = await authClient.rpc('is_household_member', { hid: household_id });
    if (!isMember) {
      return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    // Service role needed here: push_tokens RLS only exposes each user's own row.
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: tokens } = await admin
      .from('push_tokens')
      .select('token')
      .eq('household_id', household_id)
      .neq('member_id', sender_member_id);

    const messages = (tokens || [])
      .filter((t: any) => typeof t.token === 'string' && t.token.startsWith('ExponentPushToken'))
      .map((t: any) => ({
        to: t.token,
        title: `💬 ${sender_name || 'Jemand'}`,
        body: String(text).slice(0, 200),
        sound: 'default',
        data: { type: 'pinboard', household_id },
      }));

    if (messages.length > 0) {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(messages),
      });
    }

    return new Response(JSON.stringify({ sent: messages.length }), { headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});
