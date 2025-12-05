import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.21.0';
const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'), {
  apiVersion: '2024-11-20.acacia',
  httpClient: Stripe.createFetchHttpClient()
});
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature'
};
console.log('Stripe webhook handler started');
serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    const signature = req.headers.get('stripe-signature');
    if (!signature) {
      console.error('No stripe signature found');
      return new Response(JSON.stringify({
        error: 'No stripe signature found'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 400
      });
    }
    const body = await req.text();
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret) {
      console.error('No webhook secret configured');
      return new Response(JSON.stringify({
        error: 'No webhook secret configured'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 500
      });
    }
    let event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return new Response(JSON.stringify({
        error: `Webhook Error: ${err.message}`
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 400
      });
    }
    console.log('Processing event:', event.type);
    // Handle the event
    switch(event.type){
      case 'payment_intent.succeeded':
        {
          const paymentIntent = event.data.object;
          console.log('PaymentIntent succeeded:', paymentIntent.id);
          // Get order ID from metadata
          const orderId = paymentIntent.metadata?.order_id;
          if (!orderId) {
            console.error('No order_id in payment intent metadata');
            break;
          }
          // Import Supabase client
          const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
          const supabaseUrl = Deno.env.get('SUPABASE_URL');
          const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
          if (!supabaseUrl || !supabaseServiceKey) {
            console.error('Missing Supabase environment variables');
            break;
          }
          const supabase = createClient(supabaseUrl, supabaseServiceKey);
          // Update order status
          const { error: updateError } = await supabase.from('orders').update({
            payment_status: 'paid',
            status: 'processing'
          }).eq('id', orderId);
          if (updateError) {
            console.error('Error updating order:', updateError);
            break;
          }
          console.log('Order updated successfully:', orderId);
          // Get order details for email notification
          const { data: order } = await supabase.from('orders').select('*, user_id, order_number').eq('id', orderId).single();
          if (!order) {
            console.error('Order not found:', orderId);
            break;
          }
          // Get user email
          const { data: userData } = await supabase.auth.admin.getUserById(order.user_id);
          if (!userData?.user?.email) {
            console.error('User email not found');
            break;
          }
          // Create payment confirmation email notification
          const title = `Płatność potwierdzona - zamówienie ${order.order_number}`;
          const message = `Twoja płatność za zamówienie ${order.order_number} została potwierdzona.`;
          
          const { error: emailError } = await supabase.from('notifications').insert({
            user_id: order.user_id,
            notification_type: 'payment_success',
            title,
            message,
            delivery_method: 'email',
            email_to: userData.user.email,
            email_subject: title,
            email_body: `Twoja płatność za zamówienie ${order.order_number} została potwierdzona. Zamówienie jest w trakcie realizacji.`,
            email_status: 'pending',
            metadata: {
              order_id: orderId,
              order_number: order.order_number,
              payment_intent_id: paymentIntent.id
            }
          });
          if (emailError) {
            console.error('Error creating email notification:', emailError);
          } else {
            console.log('Email notification created');
          }
          break;
        }
      case 'payment_intent.payment_failed':
        {
          const paymentIntent = event.data.object;
          console.log('PaymentIntent failed:', paymentIntent.id);
          const orderId = paymentIntent.metadata?.order_id;
          if (!orderId) {
            console.error('No order_id in payment intent metadata');
            break;
          }
          const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
          const supabaseUrl = Deno.env.get('SUPABASE_URL');
          const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
          if (!supabaseUrl || !supabaseServiceKey) {
            console.error('Missing Supabase environment variables');
            break;
          }
          const supabase = createClient(supabaseUrl, supabaseServiceKey);
          // Update order to failed payment status
          const { error: updateError } = await supabase.from('orders').update({
            payment_status: 'failed'
          }).eq('id', orderId);
          if (updateError) {
            console.error('Error updating order:', updateError);
          } else {
            console.log('Order marked as payment failed:', orderId);
          }
          break;
        }
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
    return new Response(JSON.stringify({
      received: true
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 200
    });
  } catch (error) {
    console.error('Webhook handler error:', error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 500
    });
  }
});
