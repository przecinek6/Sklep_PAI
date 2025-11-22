import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Navbar } from '../components/Navbar';
import './PaymentSuccess.css';

interface Order {
  id: string;
  order_number: string;
  total_amount: number;
  payment_status: string;
  status: string;
  created_at: string;
}

const PaymentSuccess: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('order_id');

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadOrder = async () => {
      if (!orderId) {
        navigate('/');
        return;
      }

      try {
        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .eq('id', orderId)
          .single();

        if (error || !data) {
          console.error('Error loading order:', error);
          navigate('/');
          return;
        }

        setOrder(data as Order);
      } catch (err) {
        console.error('Error:', err);
        navigate('/');
      } finally {
        setLoading(false);
      }
    };

    loadOrder();
  }, [orderId, navigate]);

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="payment-success-container">
          <div className="loading">Ładowanie...</div>
        </div>
      </>
    );
  }

  if (!order) {
    return null;
  }

  return (
    <>
      <Navbar />
      <div className="payment-success-container">
        <div className="success-card">
          <div className="success-icon">✓</div>
          <h1>Płatność zakończona sukcesem!</h1>
          <p className="success-message">
            Twoje zamówienie zostało opłacone i jest w trakcie realizacji.
          </p>

          <div className="order-details">
            <h2>Szczegóły zamówienia</h2>
            <div className="detail-row">
              <span>Numer zamówienia:</span>
              <span className="order-number">{order.order_number}</span>
            </div>
            <div className="detail-row">
              <span>Kwota:</span>
              <span className="amount">{order.total_amount.toFixed(2)} PLN</span>
            </div>
            <div className="detail-row">
              <span>Status płatności:</span>
              <span className="status payment-status">{order.payment_status === 'paid' ? 'Opłacone' : order.payment_status}</span>
            </div>
            <div className="detail-row">
              <span>Status zamówienia:</span>
              <span className="status order-status">{
                order.status === 'processing' ? 'W realizacji' :
                order.status === 'pending' ? 'Oczekujące' :
                order.status
              }</span>
            </div>
          </div>

          <div className="info-box">
            <p>📧 Na Twój adres e-mail została wysłana wiadomość z potwierdzeniem płatności.</p>
            <p>📦 Rozpoczęliśmy przygotowywanie Twojego zamówienia do wysyłki.</p>
          </div>

          <div className="action-buttons">
            <button onClick={() => navigate('/my-account')} className="btn-account">
              Moje konto
            </button>
            <button onClick={() => navigate('/')} className="btn-home">
              Powrót do strony głównej
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default PaymentSuccess;
