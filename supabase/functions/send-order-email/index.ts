// Edge Function: send-order-email
// Path: supabase/functions/send-order-email/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const statusLabels = {
  pending: 'Oczekujące na płatność',
  processing: 'W realizacji',
  shipped: 'Wysłane',
  delivered: 'Dostarczone',
  cancelled: 'Anulowane',
  refunded: 'Zwrócone'
};
serve(async (req)=>{
  try {
    // CORS headers
    if (req.method === 'OPTIONS') {
      return new Response('ok', {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
        }
      });
    }
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({
        error: 'Missing authorization header'
      }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    // Verify user is authenticated and has proper role
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({
        error: 'Unauthorized'
      }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
    // Check if user is admin or moderator
    const { data: profile, error: profileError } = await supabase.from('user_profiles').select('role').eq('id', user.id).single();
    if (profileError || !profile || ![
      'admin',
      'moderator'
    ].includes(profile.role)) {
      return new Response(JSON.stringify({
        error: 'Forbidden: Insufficient permissions'
      }), {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
    // Parse request body
    const payload = await req.json();
    const { orderId, userId, orderNumber, newStatus, customerEmail, customerName, orderDate, totalAmount, isCancellation = false } = payload;
    // Validate payload
    if (!orderId || !userId || !orderNumber || !customerEmail) {
      return new Response(JSON.stringify({
        error: 'Missing required fields'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
    // Prepare email content
    const subject = isCancellation ? `Anulowanie zamówienia #${orderNumber}` : `Zmiana statusu zamówienia #${orderNumber}`;
    const body = isCancellation ? `
        <h2>Zamówienie zostało anulowane</h2>
        <p>Witaj ${customerName || 'Kliencie'},</p>
        <p>Twoje zamówienie <strong>#${orderNumber}</strong> zostało anulowane przez administratora.</p>
        <p>Data zamówienia: ${new Date(orderDate).toLocaleDateString('pl-PL')}</p>
        <p>Wartość zamówienia: ${totalAmount.toFixed(2)} PLN</p>
        <p>Jeśli płatność została zrealizowana, zwrot środków nastąpi w ciągu 7-14 dni roboczych.</p>
        <br>
        <p>W razie pytań, skontaktuj się z naszym działem obsługi klienta.</p>
        <p>Zespół Tech Shop</p>
      ` : `
        <h2>Zmiana statusu zamówienia</h2>
        <p>Witaj ${customerName || 'Kliencie'},</p>
        <p>Status Twojego zamówienia <strong>#${orderNumber}</strong> został zmieniony na: <strong>${statusLabels[newStatus] || newStatus}</strong></p>
        <p>Data zamówienia: ${new Date(orderDate).toLocaleDateString('pl-PL')}</p>
        <p>Wartość zamówienia: ${totalAmount.toFixed(2)} PLN</p>
        <br>
        <p>Dziękujemy za zakupy!</p>
        <p>Zespół Tech Shop</p>
      `;
    // Create notification record in database
    const title = subject;
    const message = isCancellation
      ? `Twoje zamówienie #${orderNumber} zostało anulowane.`
      : `Status Twojego zamówienia #${orderNumber} zmienił się na: ${statusLabels[newStatus] || newStatus}`;
    
    const { data: notification, error: notificationError } = await supabase.from('notifications').insert({
      user_id: userId,
      notification_type: isCancellation ? 'order_cancelled' : 'order_status',
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
        new_status: newStatus
      }
    }).select().single();
    if (notificationError) {
      console.error('Error creating notification:', notificationError);
      return new Response(JSON.stringify({
        error: 'Failed to create notification'
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
    // Send email via Resend
    try {
      const resendResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${RESEND_API_KEY}`
        },
        body: JSON.stringify({
          from: 'Tech Shop <noreply@przecinek.me>',
          to: customerEmail,
          subject: subject,
          html: body
        })
      });
      const resendData = await resendResponse.json();
      if (!resendResponse.ok) {
        throw new Error(resendData.message || 'Failed to send email');
      }
      // Update notification status to 'sent'
      await supabase.from('notifications').update({
        email_status: 'sent',
        email_sent_at: new Date().toISOString()
      }).eq('id', notification.id);
      return new Response(JSON.stringify({
        success: true,
        message: 'Email sent successfully',
        notificationId: notification.id
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    } catch (emailError) {
      console.error('Error sending email:', emailError);
      // Update notification status to 'failed'
      await supabase.from('notifications').update({
        email_status: 'failed',
        email_error_message: emailError instanceof Error ? emailError.message : 'Unknown error',
        email_retry_count: (notification.email_retry_count || 0) + 1
      }).eq('id', notification.id);
      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to send email',
        details: emailError instanceof Error ? emailError.message : 'Unknown error'
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
  } catch (error) {
    console.error('Function error:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
});
