import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import './PaymentFailure.css';

const PaymentFailure: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('order_id');
  const errorMessage = searchParams.get('error') || 'Wystąpił nieznany błąd podczas przetwarzania płatności.';

  return (
    <>
      <Navbar />
      <div className="payment-failure-container">
        <div className="failure-card">
          <div className="failure-icon">✕</div>
          <h1>Płatność nie powiodła się</h1>
          <p className="failure-message">
            Nie udało się przetworzyć płatności. Prosimy spróbować ponownie.
          </p>

          <div className="error-box">
            <p><strong>Powód:</strong> {errorMessage}</p>
          </div>

          <div className="info-box">
            <p>💡 Twoje zamówienie zostało zapisane i czeka na płatność.</p>
            <p>🔄 Możesz spróbować ponownie lub zmienić metodę płatności.</p>
          </div>

          <div className="action-buttons">
            {orderId && (
              <button
                onClick={() => navigate(`/payment?order_id=${orderId}`)}
                className="btn-retry"
              >
                Spróbuj ponownie
              </button>
            )}
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

export default PaymentFailure;
