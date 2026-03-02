import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Web Push using Web Crypto API (Deno compatible)
function base64UrlEncode(data: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...data));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str: string): Uint8Array {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function createJWT(vapidPrivateKey: string, vapidPublicKey: string, audience: string): Promise<string> {
  const header = { typ: 'JWT', alg: 'ES256' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: now + 12 * 3600,
    sub: 'mailto:beehivecarrybee@gmail.com',
  };

  const headerB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  const privateKeyBytes = base64UrlDecode(vapidPrivateKey);
  const key = await crypto.subtle.importKey(
    'raw',
    privateKeyBytes,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(unsignedToken)
  );

  const sigBytes = new Uint8Array(signature);
  let rawSig: Uint8Array;
  if (sigBytes.length === 64) {
    rawSig = sigBytes;
  } else {
    rawSig = derToRaw(sigBytes);
  }

  return `${unsignedToken}.${base64UrlEncode(rawSig)}`;
}

function derToRaw(der: Uint8Array): Uint8Array {
  const raw = new Uint8Array(64);
  let offset = 2;
  if (der[0] !== 0x30) return der.slice(0, 64);
  
  offset++;
  const rLen = der[offset++];
  const rStart = rLen > 32 ? offset + (rLen - 32) : offset;
  const rDest = rLen < 32 ? 32 - rLen : 0;
  raw.set(der.slice(rStart, offset + rLen), rDest);
  offset += rLen;

  offset++;
  const sLen = der[offset++];
  const sStart = sLen > 32 ? offset + (sLen - 32) : offset;
  const sDest = sLen < 32 ? 32 + (32 - sLen) : 32;
  raw.set(der.slice(sStart, offset + sLen), sDest);

  return raw;
}

async function sendWebPush(subscription: { endpoint: string; keys: { p256dh: string; auth: string } }, payload: string, vapidPublicKey: string, vapidPrivateKey: string) {
  const url = new URL(subscription.endpoint);
  const audience = `${url.protocol}//${url.host}`;
  
  const jwt = await createJWT(vapidPrivateKey, vapidPublicKey, audience);
  
  const response = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      'TTL': '86400',
      'Authorization': `vapid t=${jwt}, k=${vapidPublicKey}`,
    },
    body: new TextEncoder().encode(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw { statusCode: response.status, message: `Push failed: ${response.status} ${text}` };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate the caller
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const { storeId, orderId, totalAmount } = await req.json();

    if (!storeId || !orderId) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers: corsHeaders });
    }

    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
    
    if (!vapidPublicKey || !vapidPrivateKey) {
      console.log('VAPID keys not configured, skipping push notification');
      return new Response(
        JSON.stringify({ success: true, message: 'VAPID keys not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: storeAdmins, error: adminError } = await supabase
      .from('store_admins')
      .select('user_id')
      .eq('store_id', storeId);

    if (adminError) {
      console.error('Error fetching store admins:', adminError);
      throw adminError;
    }

    if (!storeAdmins || storeAdmins.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No store admin to notify' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const adminUserIds = storeAdmins.map(a => a.user_id);
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .in('user_id', adminUserIds);

    if (subError) {
      console.error('Error fetching subscriptions:', subError);
      throw subError;
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No subscriptions found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payload = JSON.stringify({
      title: '🔔 New Order Received!',
      body: `Order #${orderId.slice(0, 8)} - ₹${totalAmount}`,
      icon: '/favicon.ico',
      data: { 
        url: '/store-admin/orders',
        orderId: orderId
      }
    });

    const results: Array<{ id: string; status: string; error?: string }> = [];

    for (const sub of subscriptions) {
      try {
        await sendWebPush(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
          vapidPublicKey,
          vapidPrivateKey
        );
        results.push({ id: sub.id, status: 'sent' });
        console.log('Push notification sent to:', sub.id);
      } catch (e: unknown) {
        const error = e as { statusCode?: number; message?: string };
        if (error.statusCode === 410 || error.statusCode === 404) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id);
          results.push({ id: sub.id, status: 'removed' });
        } else {
          console.error('Push error for subscription:', sub.id, error);
          results.push({ id: sub.id, status: 'error', error: error.message || 'Unknown error' });
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error('Store admin notification error:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
