// supabase/functions/notify-message/index.ts
// Sends a push notification to every OTHER member of a household when someone posts to
// the shared pinboard/chat — mirrors a WhatsApp-style "new message" push.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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

    const { household_id, text } = await req.json();
    if (!household_id || !text) {
      return new Response(JSON.stringify({ error: 'missing fields' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    // Look up the CALLER's own member row for this household — never trust a client-supplied
    // sender_member_id/sender_name, which would let anyone spoof another member's identity
    // (excluding them from the notification, or showing a fake display name to the household).
    const { data: sender } = await authClient
      .from('members')
      .select('id, display_name')
      .eq('household_id', household_id)
      .eq('user_id', user.id)
      .single();
    if (!sender) {
      return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } });
    }
    const sender_member_id = sender.id;
    const sender_name = sender.display_name;

    // Service role needed here: push_tokens RLS only exposes each user's own row.
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: tokens } = await admin
      .from('push_tokens')
      .select('token')
      .eq('household_id', household_id)
      .neq('member_id', sender_member_id);

    // Kept as a parallel array to `messages`: Expo answers with a data[] in the SAME order as
    // the tickets were sent, so index i in the response belongs to sentTokens[i]. That mapping is
    // the only way to know WHICH device a DeviceNotRegistered refers to.
    const sentTokens: string[] = [];
    const messages = (tokens || [])
      .filter((t: any) => typeof t.token === 'string' && t.token.startsWith('ExponentPushToken'))
      .map((t: any) => {
        sentTokens.push(t.token);
        return {
          to: t.token,
          title: `💬 ${sender_name || 'Jemand'}`,
          body: String(text).slice(0, 200),
          sound: 'default',
          data: { type: 'pinboard', household_id },
        };
      });

    let ok = 0;
    let failed = 0;
    let removed = 0;

    if (messages.length > 0) {
      // The response used to be thrown away. { sent: n } then reported "3 sent" even when Expo
      // had rejected all three, which is how a completely dead push path could look healthy.
      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(messages),
      });

      let body: any = null;
      try { body = await res.json(); } catch { /* non-JSON body (gateway error page) */ }

      const tickets: any[] = Array.isArray(body?.data) ? body.data : [];
      const deadTokens: string[] = [];

      if (!res.ok || tickets.length === 0) {
        // Whole request failed, or Expo answered with something we can't read ticket-wise. Not a
        // per-device problem, so nothing gets deleted — count them all as failed and let the
        // push_debug row below make the outage visible.
        failed = messages.length;
      } else {
        tickets.forEach((ticket, i) => {
          if (ticket?.status === 'ok') { ok++; return; }
          failed++;
          // ONLY DeviceNotRegistered means the token itself is dead (app uninstalled, data
          // cleared, token rotated). Every other error — MessageTooBig, MessageRateExceeded,
          // InvalidCredentials, a transient outage — says nothing about the device, and deleting
          // on those would silently unsubscribe healthy phones.
          if (ticket?.details?.error === 'DeviceNotRegistered' && sentTokens[i]) {
            deadTokens.push(sentTokens[i]);
          }
        });
        // Expo can return fewer tickets than messages sent; those have no verdict at all.
        if (tickets.length < messages.length) failed += messages.length - tickets.length;
      }

      if (deadTokens.length > 0) {
        const { error: delError, count } = await admin
          .from('push_tokens')
          .delete({ count: 'exact' })
          .in('token', deadTokens);
        if (delError) console.error('notify-message: could not remove dead tokens:', delError.message);
        else removed = count ?? deadTokens.length;
      }

      // supabase-js returns { error } on a rejected insert instead of throwing, so this is
      // checked rather than wrapped in a bare try/catch — an RLS or constraint problem here
      // would otherwise leave exactly the kind of silent gap this row exists to close.
      // Verified before writing this: push_debug.stage has NO check constraint, so 'push_sent'
      // is accepted as-is.
      const { error: logError } = await admin.from('push_debug').insert({
        member_id: sender_member_id,
        household_id,
        stage: 'push_sent',
        message: `ok=${ok} failed=${failed} removed=${removed}`,
      });
      if (logError) console.error('notify-message: push_debug row not written:', logError.message);
    }

    return new Response(
      JSON.stringify({ sent: messages.length, ok, failed, removed }),
      { headers: { ...cors, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    console.error('notify-message error:', e);
    return new Response(JSON.stringify({ error: 'Nachricht konnte nicht gesendet werden.' }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});
