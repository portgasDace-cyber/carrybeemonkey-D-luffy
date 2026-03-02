import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate the caller and verify admin role
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

    const callerId = claimsData.claims.sub;

    // Verify caller is admin
    const supabaseService = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: adminRole } = await supabaseService
      .from('user_roles')
      .select('role')
      .eq('user_id', callerId)
      .eq('role', 'admin')
      .maybeSingle();

    if (!adminRole) {
      return new Response(JSON.stringify({ error: 'Forbidden: Admin only' }), { status: 403, headers: corsHeaders });
    }

    const { title, body, icon, data, userId, sendToAll } = await req.json();

    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
    
    if (!vapidPublicKey || !vapidPrivateKey) {
      throw new Error('VAPID keys not configured');
    }

    // Get subscriptions
    let query = supabaseService.from('push_subscriptions').select('*');
    
    if (!sendToAll && userId) {
      query = query.eq('user_id', userId);
    }

    const { data: subscriptions, error } = await query;

    if (error) {
      throw error;
    }

    const payload = JSON.stringify({ title, body, icon, data });
    const results: Array<{ id: string; status: string; error?: string }> = [];

    const webPush = await import("https://esm.sh/web-push@3.6.7");
    
    webPush.setVapidDetails(
      'mailto:beehivecarrybee@gmail.com',
      vapidPublicKey,
      vapidPrivateKey
    );

    for (const sub of subscriptions || []) {
      try {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth
          }
        };

        await webPush.sendNotification(pushSubscription, payload);
        results.push({ id: sub.id, status: 'sent' });
      } catch (e: unknown) {
        const error = e as { statusCode?: number; message?: string };
        if (error.statusCode === 410 || error.statusCode === 404) {
          await supabaseService.from('push_subscriptions').delete().eq('id', sub.id);
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
    console.error('Push notification error:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
