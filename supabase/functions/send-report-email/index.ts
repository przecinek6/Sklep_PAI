// Edge Function: send-report-email
// Path: supabase/functions/send-report-email/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
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
    const { reportId, userId, productId, customerEmail, customerName, productName, emailType, message } = payload;
    // Validate payload
    if (!reportId || !userId || !productId || !customerEmail || !emailType) {
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
    // Prepare email content based on type
    let subject;
    let body;
    let notificationType;
    if (emailType === 'response') {
      if (!message) {
        return new Response(JSON.stringify({
          error: 'Message is required for response emails'
        }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
      subject = `Odpowiedź na Twoje zgłoszenie produktu`;
      body = `
        <h2>Odpowiedź na zgłoszenie</h2>
        <p>Witaj ${customerName || 'Kliencie'},</p>
        <p>Otrzymałeś odpowiedź na swoje zgłoszenie dotyczące produktu <strong>${productName || 'produktu'}</strong>:</p>
        <div style="background: #e8f5e9; padding: 15px; border-radius: 6px; margin: 15px 0;">
          <p style="margin: 0;"><strong>Moderator:</strong></p>
          <p style="margin: 10px 0;">${message}</p>
        </div>
        <p>Możesz odpowiedzieć na zgłoszenie, odwiedzając stronę produktu.</p>
        <br>
        <p>Zespół Tech Shop</p>
      `;
      notificationType = 'report_response';
    } else {
      subject = `Zgłoszenie zostało rozwiązane`;
      body = `
        <h2>Zgłoszenie rozwiązane</h2>
        <p>Witaj ${customerName || 'Kliencie'},</p>
        <p>Twoje zgłoszenie dotyczące produktu <strong>${productName || 'produktu'}</strong> zostało rozwiązane.</p>
        <p>Dziękujemy za zgłoszenie i pomoc w poprawie jakości naszego sklepu.</p>
        <br>
        <p>Zespół Tech Shop</p>
      `;
      notificationType = 'report_response';
    }
    // Create notification record in database
    const title = subject;
    const shortMessage = emailType === 'response' 
      ? `Otrzymałeś odpowiedź na swoje zgłoszenie produktu ${productName || 'produktu'}.`
      : `Twoje zgłoszenie produktu ${productName || 'produktu'} zostało rozwiązane.`;
    
    const { data: notification, error: notificationError } = await supabase.from('notifications').insert({
      user_id: userId,
      notification_type: notificationType,
      title,
      message: shortMessage,
      delivery_method: 'email',
      email_to: customerEmail,
      email_subject: subject,
      email_body: body,
      email_status: 'pending',
      metadata: {
        report_id: reportId,
        product_id: productId
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
