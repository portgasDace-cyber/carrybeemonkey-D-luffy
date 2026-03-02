import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ProductRequestData {
  customerName: string;
  customerPhone: string;
  productDescription: string;
  storeName: string;
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

    const { customerName, customerPhone, productDescription, storeName }: ProductRequestData = await req.json();

    console.log("Received product request:", { customerName, customerPhone, storeName });

    // Validate input
    if (!customerName || !customerPhone || !productDescription) {
      throw new Error("Missing required fields");
    }

    // Send WhatsApp message via deep link (this will be returned to frontend)
    const whatsappMessage = encodeURIComponent(
      `🐝 *New Product Request - Kunnathur Carry Bee*\n\n` +
      `👤 *Customer:* ${customerName}\n` +
      `📞 *Phone:* ${customerPhone}\n` +
      `🏪 *Store:* ${storeName}\n\n` +
      `📦 *Product Request:*\n${productDescription}`
    );
    const whatsappLink = `https://wa.me/919787141556?text=${whatsappMessage}`;

    // Send email notification
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Product Request - Kunnathur Carry Bee</title>
      </head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
        <div style="background-color: #FDB931; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: #1A1A1A; margin: 0;">🐝 New Product Request!</h1>
          <p style="color: #1A1A1A; margin: 5px 0 0 0;">Kunnathur Carry Bee</p>
        </div>
        
        <div style="background-color: white; padding: 20px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <h2 style="color: #333; border-bottom: 2px solid #FDB931; padding-bottom: 10px;">Customer Request</h2>
          
          <div style="margin-bottom: 20px;">
            <h3 style="color: #FDB931; margin-bottom: 10px;">👤 Customer Details</h3>
            <p style="margin: 5px 0;"><strong>Name:</strong> ${customerName}</p>
            <p style="margin: 5px 0;"><strong>Phone:</strong> ${customerPhone}</p>
          </div>
          
          <div style="margin-bottom: 20px;">
            <h3 style="color: #FDB931; margin-bottom: 10px;">🏪 Store</h3>
            <p style="margin: 5px 0;">${storeName}</p>
          </div>
          
          <div style="margin-bottom: 20px;">
            <h3 style="color: #FDB931; margin-bottom: 10px;">📦 Product Request</h3>
            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 8px;">
              <p style="margin: 0; white-space: pre-wrap;">${productDescription}</p>
            </div>
          </div>
          
          <div style="background-color: #FDB931; padding: 15px; border-radius: 8px; text-align: center;">
            <a href="tel:${customerPhone}" style="color: #1A1A1A; text-decoration: none; font-weight: bold;">
              📞 Call Customer: ${customerPhone}
            </a>
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
        to: ["ravishangaraarya24@gmail.com"],
        subject: `🐝 New Product Request from ${customerName}`,
        html: emailHtml,
      }),
    });

    const emailResponse = await res.json();

    if (!res.ok) {
      console.error("Email send error:", emailResponse);
      throw new Error(emailResponse.message || "Failed to send email");
    }

    console.log("Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ 
        success: true, 
        whatsappLink,
        emailSent: true 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-product-request function:", error);
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
