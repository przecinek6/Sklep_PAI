import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import PaymentForm from '../components/PaymentForm';
import type { Order } from '../types/database.types';
import './Payment.css';

const Payment: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('order_id');

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Wait for auth to load
    if (authLoading) {
      return;
    }
    
    if (!user) {
      navigate('/login');
      return;
    }

    if (!orderId) {
      navigate('/');
      return;
    }

    loadOrder();
  }, [user, orderId, navigate, authLoading]);

  const loadOrder = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch order details
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            *,
            products (
              name,
              price
            )
          )
        `)
        .eq('id', orderId)
        .eq('user_id', user!.id)
        .single();

      if (orderError || !orderData) {
        console.error('Error fetching order:', orderError);
        setError('Nie znaleziono zamówienia');
        return;
      }

      setOrder(orderData);

      // Check if payment is already completed
      if (orderData.payment_status === 'paid') {
        navigate('/orders');
        return;
      }
    } catch (err) {
      console.error('Error in loadOrder:', err);
      setError('Wystąpił błąd podczas wczytywania zamówienia');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="payment-container">
          <div className="payment-loading">
            <div className="loading-spinner"></div>
            <p>Przygotowywanie płatności...</p>
          </div>
        </div>
      </>
    );
  }

  if (error || !order) {
    return (
      <>
        <Navbar />
        <div className="payment-container">
          <div className="payment-error">
            <h2>Wystąpił błąd</h2>
            <p>{error || 'Nie można załadować danych zamówienia'}</p>
            <button className="btn-primary" onClick={() => navigate('/orders')}>
              Wróć do zamówień
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="payment-container">
        <h1>Płatność</h1>

        <div className="payment-content">
          {/* Order Summary */}
          <div className="payment-summary">
            <h2>Podsumowanie zamówienia</h2>
            <div className="summary-details">
              <div className="summary-row">
                <span>Numer zamówienia:</span>
                <span className="order-number">{order.order_number}</span>
              </div>
              <div className="summary-row">
                <span>Produkty:</span>
                <span>{order.total_amount - order.shipping_cost} zł</span>
              </div>
              <div className="summary-row">
                <span>Wysyłka:</span>
                <span>{order.shipping_cost.toFixed(2)} zł</span>
              </div>
              <div className="summary-divider"></div>
              <div className="summary-row summary-total">
                <span>Łącznie:</span>
                <span>{order.total_amount.toFixed(2)} zł</span>
              </div>
            </div>

            <div className="shipping-address">
              <h3>Adres wysyłki:</h3>
              <p>{order.shipping_address_street}</p>
              <p>{order.shipping_address_postal_code} {order.shipping_address_city}</p>
              <p>{order.shipping_address_country}</p>
            </div>
          </div>

          {/* Payment Form */}
          <div className="payment-form-container">
            <h2>Płatność kartą</h2>
            <PaymentForm orderId={order.id} orderNumber={order.order_number} />
          </div>
        </div>
      </div>
    </>
  );
};

export default Payment;
