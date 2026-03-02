import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface StatusNotificationRequest {
  orderId: string;
  userId: string;
  customerPhone: string;
  storeName: string;
  newStatus: string;
  totalAmount: number;
}

const getStatusMessage = (status: string) => {
  switch (status) {
    case "confirmed":
    case "accepted":
      return {
        emoji: "✅",
        title: "Order Accepted!",
        message: "Your order has been accepted and is being prepared.",
        color: "#3B82F6",
      };
    case "out_for_delivery":
      return {
        emoji: "🚚",
        title: "Out for Delivery!",
        message: "Your order is on its way! Our delivery partner is bringing it to you.",
        color: "#8B5CF6",
      };
    case "delivered":
      return {
        emoji: "🎉",
        title: "Order Delivered!",
        message: "Your order has been delivered successfully. Thank you for ordering with us!",
        color: "#10B981",
      };
    case "cancelled":
      return {
        emoji: "❌",
        title: "Order Cancelled",
        message: "Your order has been cancelled. If you have any questions, please contact us.",
        color: "#EF4444",
      };
    default:
      return {
        emoji: "📦",
        title: "Order Update",
        message: `Your order status has been updated to: ${status}`,
        color: "#FDB931",
      };
  }
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate the caller
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const supabaseAuth = createClient(
      SUPABASE_URL!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const callerId = claimsData.claims.sub;

    // Verify caller is admin or store admin
    const supabaseAdmin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    
    const { data: callerRole } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', callerId)
      .eq('role', 'admin')
      .maybeSingle();

    const {
      orderId,
      userId,
      customerPhone,
      storeName,
      newStatus,
      totalAmount,
    }: StatusNotificationRequest = await req.json();

    if (!orderId || !userId || !newStatus) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers: corsHeaders });
    }

    // If not admin, check if store admin for this order
    if (!callerRole) {
      const { data: order } = await supabaseAdmin
        .from('orders')
        .select('store_id')
        .eq('id', orderId)
        .single();

      if (!order) {
        return new Response(JSON.stringify({ error: 'Order not found' }), { status: 404, headers: corsHeaders });
      }

      const { data: storeAdmin } = await supabaseAdmin
        .from('store_admins')
        .select('id')
        .eq('user_id', callerId)
        .eq('store_id', order.store_id)
        .maybeSingle();

      if (!storeAdmin) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders });
      }
    }

    console.log("Sending order status notification:", { orderId, newStatus, userId });

    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
    
    if (userError || !userData?.user?.email) {
      console.log("Could not fetch user email:", userError?.message);
      return new Response(JSON.stringify({ success: false, error: "User email not found" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const customerEmail = userData.user.email;
    const statusInfo = getStatusMessage(newStatus);

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Order Update - Kunnathur Carry Bee</title>
      </head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
        <div style="background-color: ${statusInfo.color}; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 48px;">${statusInfo.emoji}</h1>
          <h2 style="color: white; margin: 10px 0 0 0;">${statusInfo.title}</h2>
        </div>
        
        <div style="background-color: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <p style="font-size: 16px; color: #333; line-height: 1.6;">${statusInfo.message}</p>
          
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #333; margin: 0 0 15px 0; border-bottom: 2px solid ${statusInfo.color}; padding-bottom: 10px;">Order Details</h3>
            <p style="margin: 8px 0;"><strong>Order ID:</strong> #${orderId.slice(0, 8)}</p>
            <p style="margin: 8px 0;"><strong>Store:</strong> ${storeName}</p>
            <p style="margin: 8px 0;"><strong>Total Amount:</strong> ₹${totalAmount}</p>
            <p style="margin: 8px 0;"><strong>Status:</strong> <span style="color: ${statusInfo.color}; font-weight: bold;">${newStatus.replace(/_/g, " ").toUpperCase()}</span></p>
          </div>
          
          <div style="text-align: center; margin-top: 30px;">
            <p style="color: #FDB931; font-size: 24px; margin: 0;">🐝</p>
            <p style="color: #666; font-size: 14px; margin: 5px 0;">Kunnathur Carry Bee</p>
            <p style="color: #999; font-size: 12px; margin: 5px 0;">Fast delivery, happy customers!</p>
          </div>
          
          <p style="color: #999; font-size: 11px; text-align: center; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px;">
            This is an automated notification. Please do not reply to this email.
          </p>
        </div>
      </body>
      </html>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Kunnathur Carry Bee <onboarding@resend.dev>",
        to: [customerEmail],
        subject: `${statusInfo.emoji} Order #${orderId.slice(0, 8)} - ${statusInfo.title}`,
        html: emailHtml,
      }),
    });

    const emailResponse = await res.json();

    if (!res.ok) {
      throw new Error(emailResponse.message || "Failed to send email");
    }

    console.log("Status notification email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, data: emailResponse }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-order-status-notification function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
