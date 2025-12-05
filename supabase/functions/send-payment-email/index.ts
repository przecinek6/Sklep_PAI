// Edge Function: send-payment-email
// Path: supabase/functions/send-payment-email/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

serve(async (req) => {
  try {
    // CORS headers
    if (req.method === 'OPTIONS') {
      return new Response('ok', {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        },
      });
    }

    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        {
          status: 401,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
        }
      );
    }

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Verify user is authenticated
    const token = authHeader.replace('Bearer ', '');
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
      });
    }

    // Parse request body
    const payload = await req.json();
    const {
      orderId,
      orderNumber,
      customerEmail,
      customerName,
      paymentStatus, // 'success' or 'failed'
    } = payload;

    // Validate payload
    if (!orderId || !orderNumber || !customerEmail || !paymentStatus) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        {
          status: 400,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
        }
      );
    }

    // Fetch order details to get total amount
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select('total_amount')
      .eq('id', orderId)
      .single();

    if (orderError || !orderData) {
      console.error('Error fetching order:', orderError);
      return new Response(
        JSON.stringify({ error: 'Order not found' }),
        {
          status: 404,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
        }
      );
    }

    const totalAmount = orderData.total_amount;

    // Prepare email content based on payment status
    const isSuccess = paymentStatus === 'success';
    const subject = isSuccess
      ? `Płatność potwierdzona - zamówienie #${orderNumber}`
      : `Płatność nieudana - zamówienie #${orderNumber}`;

    const body = isSuccess
      ? `
        <h2>Płatność została potwierdzona</h2>
        <p>Witaj ${customerName || 'Kliencie'},</p>
        <p>Twoja płatność za zamówienie <strong>#${orderNumber}</strong> została potwierdzona.</p>
        <p>Wartość zamówienia: ${totalAmount.toFixed(2)} PLN</p>
        <p>Status zamówienia: <strong>W realizacji</strong></p>
        <br>
        <p>Zamówienie zostało przekazane do realizacji. O kolejnych etapach będziemy Cię informować.</p>
        <p>Dziękujemy za zakupy!</p>
        <p>Zespół Tech Shop</p>
      `
      : `
        <h2>Płatność nie powiodła się</h2>
        <p>Witaj ${customerName || 'Kliencie'},</p>
        <p>Niestety płatność za zamówienie <strong>#${orderNumber}</strong> nie została zrealizowana.</p>
        <p>Wartość zamówienia: ${totalAmount.toFixed(2)} PLN</p>
        <p>Status zamówienia: <strong>Oczekujące na płatność</strong></p>
        <br>
        <p>Aby dokończyć zamówienie, prosimy o ponowienie próby płatności.</p>
        <p>Jeśli problem będzie się powtarzał, skontaktuj się z naszym działem obsługi klienta.</p>
        <p>Zespół Tech Shop</p>
      `;

    // Create notification record in database
    const title = subject;
    const message = isSuccess
      ? `Płatność za zamówienie #${orderNumber} została potwierdzona.`
      : `Płatność za zamówienie #${orderNumber} nie powiodła się.`;
    
    const { data: notification, error: notificationError } = await supabase
      .from('notifications')
      .insert({
        user_id: user.id,
        notification_type: isSuccess ? 'payment_success' : 'payment_failed',
        title,
        message,
        delivery_method: 'email',
        email_to: customerEmail,
        email_subject: subject,
        email_body: body,
        email_status: 'pending',
        metadata: {
          order_id: orderId,
          order_number: orderNumber,
          payment_status: paymentStatus,
        },
      })
      .select()
      .single();

    if (notificationError) {
      console.error('Error creating notification:', notificationError);
      return new Response(
        JSON.stringify({ error: 'Failed to create notification' }),
        {
          status: 500,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
        }
      );
    }

    // Send email via Resend
    try {
      const resendResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: 'Tech Shop <noreply@przecinek.me>',
          to: customerEmail,
          subject: subject,
          html: body,
        }),
      });

      const resendData = await resendResponse.json();

      if (!resendResponse.ok) {
        throw new Error(resendData.message || 'Failed to send email');
      }

      // Update notification status to 'sent'
      await supabase
        .from('notifications')
        .update({ 
          email_status: 'sent',
          email_sent_at: new Date().toISOString()
        })
        .eq('id', notification.id);

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Email sent successfully',
          notificationId: notification.id,
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    } catch (emailError) {
      console.error('Error sending email:', emailError);

      // Update notification status to 'failed'
      await supabase
        .from('notifications')
        .update({
          email_status: 'failed',
          email_error_message:
            emailError instanceof Error ? emailError.message : 'Unknown error',
          email_retry_count: (notification.email_retry_count || 0) + 1
        })
        .eq('id', notification.id);

      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to send email',
          details:
            emailError instanceof Error ? emailError.message : 'Unknown error',
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }
  } catch (error) {
    console.error('Function error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
});
