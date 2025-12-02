// Edge Function: send-question-email
// Path: supabase/functions/send-question-email/index.ts
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
          'Content-Type': 'application/json'
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
          'Content-Type': 'application/json'
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
          'Content-Type': 'application/json'
        }
      });
    }
    // Parse request body
    const payload = await req.json();
    const { questionId, userId, productId, customerEmail, customerName, productName, questionText, answerText } = payload;
    // Validate payload
    if (!questionId || !userId || !productId || !customerEmail || !questionText || !answerText) {
      return new Response(JSON.stringify({
        error: 'Missing required fields'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
    // Prepare email content
    const subject = `Odpowiedź na Twoje pytanie o produkt`;
    const body = `
      <h2>Odpowiedź na pytanie</h2>
      <p>Witaj ${customerName || 'Kliencie'},</p>
      <p>Otrzymałeś odpowiedź na swoje pytanie dotyczące produktu <strong>${productName || 'produktu'}</strong>:</p>
      <div style="background: #f5f5f5; padding: 15px; border-radius: 6px; margin: 15px 0;">
        <p style="margin: 0;"><strong>Twoje pytanie:</strong></p>
        <p style="margin: 10px 0;">${questionText}</p>
      </div>
      <div style="background: #e8f5e9; padding: 15px; border-radius: 6px; margin: 15px 0;">
        <p style="margin: 0;"><strong>Odpowiedź:</strong></p>
        <p style="margin: 10px 0;">${answerText}</p>
      </div>
      <p>Dziękujemy za zainteresowanie naszymi produktami!</p>
      <br>
      <p>Zespół Tech Shop</p>
    `;
    // Create notification record in database (status: pending)
    const { data: notification, error: notificationError } = await supabase.from('email_notifications').insert({
      user_id: userId,
      notification_type: 'question_answered',
      subject,
      body,
      email_to: customerEmail,
      status: 'pending',
      metadata: {
        question_id: questionId,
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
          'Content-Type': 'application/json'
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
          from: 'Tech Shop <onboarding@resend.dev>',
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
      await supabase.from('email_notifications').update({
        status: 'sent'
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
      await supabase.from('email_notifications').update({
        status: 'failed',
        error_message: emailError instanceof Error ? emailError.message : 'Unknown error'
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
