import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface OrderItem {
  name: string;
  quantity: number;
  price: number;
}

interface OrderEmailRequest {
  customerEmail: string;
  customerPhone: string;
  deliveryAddress: string;
  storeName: string;
  totalAmount: number;
  deliveryFee: number;
  distance: string;
  latitude: number | null;
  longitude: number | null;
  orderItems: OrderItem[];
  orderId: string;
}

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

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const {
      customerEmail,
      customerPhone,
      deliveryAddress,
      storeName,
      totalAmount,
      deliveryFee,
      distance,
      latitude,
      longitude,
      orderItems,
      orderId,
    }: OrderEmailRequest = await req.json();

    console.log("Received order email request:", { orderId, storeName, totalAmount });

    // Validate required inputs
    if (!orderId || !storeName || !customerEmail || !orderItems?.length) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers: corsHeaders });
    }

    const itemsHtml = orderItems
      .map(
        (item) =>
          `<tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.name}</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">₹${item.price}</td>
          </tr>`
      )
      .join("");

    const mapLink = latitude && longitude
      ? `<a href="https://www.google.com/maps?q=${latitude},${longitude}" style="color: #FDB931; text-decoration: none;">View on Google Maps</a>`
      : "Not provided";

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>New Order - Kunnathur Carry Bee</title>
      </head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
        <div style="background-color: #FDB931; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: #1A1A1A; margin: 0;">🐝 New Order Received!</h1>
          <p style="color: #1A1A1A; margin: 5px 0 0 0;">Kunnathur Carry Bee</p>
        </div>
        
        <div style="background-color: white; padding: 20px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <h2 style="color: #333; border-bottom: 2px solid #FDB931; padding-bottom: 10px;">Order #${orderId.slice(0, 8)}</h2>
          
          <div style="margin-bottom: 20px;">
            <h3 style="color: #FDB931; margin-bottom: 10px;">📦 Store Details</h3>
            <p style="margin: 5px 0;"><strong>Store:</strong> ${storeName}</p>
          </div>
          
          <div style="margin-bottom: 20px;">
            <h3 style="color: #FDB931; margin-bottom: 10px;">👤 Customer Details</h3>
            <p style="margin: 5px 0;"><strong>Email:</strong> ${customerEmail}</p>
            <p style="margin: 5px 0;"><strong>Phone:</strong> ${customerPhone}</p>
          </div>
          
          <div style="margin-bottom: 20px;">
            <h3 style="color: #FDB931; margin-bottom: 10px;">📍 Delivery Details</h3>
            <p style="margin: 5px 0;"><strong>Address:</strong> ${deliveryAddress}</p>
            <p style="margin: 5px 0;"><strong>Location Coordinates:</strong> ${
              latitude && longitude ? `${latitude}, ${longitude}` : "Not provided"
            }</p>
            <p style="margin: 5px 0;"><strong>Map:</strong> ${mapLink}</p>
          </div>
          
          <div style="margin-bottom: 20px;">
            <h3 style="color: #FDB931; margin-bottom: 10px;">🛒 Order Items</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="background-color: #f5f5f5;">
                  <th style="padding: 10px; text-align: left;">Item</th>
                  <th style="padding: 10px; text-align: center;">Qty</th>
                  <th style="padding: 10px; text-align: right;">Price</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>
          </div>
          
          <div style="margin-bottom: 20px;">
            <h3 style="color: #FDB931; margin-bottom: 10px;">🚚 Delivery Info</h3>
            <p style="margin: 5px 0;"><strong>Distance:</strong> ${distance} km</p>
            <p style="margin: 5px 0;"><strong>Delivery Fee:</strong> ₹${deliveryFee}</p>
          </div>
          
          <div style="background-color: #FDB931; padding: 15px; border-radius: 8px; text-align: center;">
            <h3 style="color: #1A1A1A; margin: 0;">💰 Total Amount (incl. delivery): ₹${totalAmount}</h3>
          </div>
          
          <p style="color: #666; font-size: 12px; text-align: center; margin-top: 20px;">
            This is an automated email from Kunnathur Carry Bee delivery platform.
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
        to: ["beehivecarrybee@gmail.com"],
        subject: `🐝 New Order #${orderId.slice(0, 8)} - ${storeName}`,
        html: emailHtml,
      }),
    });

    const emailResponse = await res.json();
    
    if (!res.ok) {
      throw new Error(emailResponse.message || "Failed to send email");
    }

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, data: emailResponse }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-order-email function:", error);
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
