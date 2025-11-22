import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import './PaymentForm.css';

interface PaymentFormProps {
  orderId: string;
  orderNumber: string;
}

const PaymentForm: React.FC<PaymentFormProps> = ({ orderId, orderNumber }) => {
  const navigate = useNavigate();

  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const updateOrderStatus = async (paymentStatus: string) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          payment_status: paymentStatus,
          status: paymentStatus === 'paid' ? 'processing' : 'pending',
        })
        .eq('id', orderId);

      if (error) {
        console.error('Error updating order status:', error);
      }

      // Send email notification via Edge Function
      const { data: { session } } = await supabase.auth.getSession();
      const { data: userData } = await supabase.auth.getUser();
      
      if (session && userData.user) {
        try {
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-payment-email`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({
                orderId: orderId,
                orderNumber: orderNumber,
                customerEmail: userData.user.email,
                customerName: userData.user.user_metadata?.first_name || userData.user.email,
                paymentStatus: paymentStatus === 'paid' ? 'success' : 'failed',
              }),
            }
          );

          const result = await response.json();
          
          if (!response.ok) {
            console.error('Email error:', result.error);
          } else {
            console.log('Email sent successfully:', result);
          }
        } catch (emailError) {
          console.error('Error calling email function:', emailError);
        }
      }
    } catch (err) {
      console.error('Error in updateOrderStatus:', err);
    }
  };

  // Simulate payment for testing
  const handleSimulatePayment = async () => {
    setIsProcessing(true);
    setMessage(null);

    try {
      // Update order status to paid
      await updateOrderStatus('paid');

      // Simulate delay
      await new Promise(resolve => setTimeout(resolve, 1500));

      setMessage('Płatność symulowana pomyślnie!');
      setTimeout(() => {
        navigate(`/payment/success?order_id=${orderId}`);
      }, 1000);
    } catch (err) {
      console.error('Error simulating payment:', err);
      setMessage('Błąd podczas symulacji płatności');
      setIsProcessing(false);
    }
  };

  return (
    <div className="payment-form">
      {message && (
        <div className={`payment-message ${message.includes('Błąd') || message.includes('błąd') ? 'error' : 'success'}`}>
          {message}
        </div>
      )}

      <div className="payment-actions">
        {/* Simulate payment button */}
        <button
          type="button"
          onClick={handleSimulatePayment}
          disabled={isProcessing}
          className="btn-simulate"
        >
          {isProcessing ? 'Przetwarzanie płatności...' : 'Zapłać kartą (Symulacja)'}
        </button>
      </div>

      <p className="payment-info">
        💳 Kliknij przycisk powyżej aby zasymulować płatność kartą i przejść dalej.
      </p>
    </div>
  );
};

export default PaymentForm;
