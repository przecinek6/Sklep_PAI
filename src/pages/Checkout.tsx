import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../hooks/useCart';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { Navbar } from '../components/Navbar';
import type { UserProfile } from '../types/database.types';
import './Checkout.css';

const SHIPPING_COST = 15.00;

const Checkout: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { items, totalPrice, clearCart } = useCart();
  
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [processingOrder, setProcessingOrder] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  
  // Editable address fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [streetAddress, setStreetAddress] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('Polska');

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login', { state: { from: '/checkout' } });
    }
  }, [user, authLoading, navigate]);

  // Load user profile
  useEffect(() => {
    if (user) {
      loadUserProfile();
    }
  }, [user]);

  const loadUserProfile = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user!.id)
        .single();

      if (fetchError) {
        console.error('Error loading user profile:', fetchError);
        setError('Błąd podczas wczytywania profilu użytkownika');
        return;
      }

      setUserProfile(data);

      // Initialize form fields with user data
      setFirstName(data.first_name || '');
      setLastName(data.last_name || '');
      setEmail(data.email || '');
      setPhone(data.phone || '');
      setStreetAddress(data.street_address || '');
      setCity(data.city || '');
      setPostalCode(data.postal_code || '');
      setCountry(data.country || 'Polska');

      // Auto-enable editing if address is incomplete
      if (!data.street_address || !data.city || !data.postal_code) {
        setIsEditingAddress(true);
      }
    } catch (err) {
      console.error('Error in loadUserProfile:', err);
      setError('Błąd podczas wczytywania profilu użytkownika');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAddress = async () => {
    try {
      setError(null);

      if (!streetAddress || !city || !postalCode) {
        setError('Uzupełnij wszystkie wymagane pola adresowe');
        return;
      }

      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({
          first_name: firstName,
          last_name: lastName,
          phone: phone,
          street_address: streetAddress,
          city: city,
          postal_code: postalCode,
          country: country,
        })
        .eq('id', user!.id);

      if (updateError) {
        console.error('Error updating profile:', updateError);
        setError('Błąd podczas zapisywania danych adresowych');
        return;
      }

      // Reload profile
      await loadUserProfile();
      setIsEditingAddress(false);
    } catch (err) {
      console.error('Error in handleSaveAddress:', err);
      setError('Błąd podczas zapisywania danych adresowych');
    }
  };

  const generateOrderNumber = () => {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `ORD-${timestamp}-${random}`;
  };

  const handlePlaceOrder = async () => {
    if (!user) {
      setError('Musisz być zalogowany, aby złożyć zamówienie');
      return;
    }

    if (!streetAddress || !city || !postalCode) {
      setError('Uzupełnij dane adresowe przed złożeniem zamówienia');
      setIsEditingAddress(true);
      return;
    }

    if (items.length === 0) {
      setError('Twój koszyk jest pusty');
      return;
    }

    try {
      setProcessingOrder(true);
      setError(null);

      const orderNumber = generateOrderNumber();
      const orderTotal = totalPrice + SHIPPING_COST;

      // Save address to profile if changed
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({
          first_name: firstName,
          last_name: lastName,
          phone: phone,
          street_address: streetAddress,
          city: city,
          postal_code: postalCode,
          country: country,
        })
        .eq('id', user.id);

      if (updateError) {
        console.error('Error updating profile:', updateError);
      }

      // Create order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: user.id,
          order_number: orderNumber,
          status: 'pending',
          payment_status: 'pending',
          total_amount: orderTotal,
          shipping_cost: SHIPPING_COST,
          shipping_address_street: streetAddress,
          shipping_address_city: city,
          shipping_address_postal_code: postalCode,
          shipping_address_country: country,
        })
        .select()
        .single();

      if (orderError) {
        console.error('Error creating order:', orderError);
        setError('Błąd podczas tworzenia zamówienia');
        return;
      }

      // Create order items
      const orderItems = items.map(item => ({
        order_id: order.id,
        product_id: item.product_id,
        quantity: item.quantity,
        price: item.products?.price || 0,
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) {
        console.error('Error creating order items:', itemsError);
        // Try to delete the order if items insertion failed
        await supabase.from('orders').delete().eq('id', order.id);
        setError('Błąd podczas dodawania produktów do zamówienia');
        return;
      }

      // Create email notification
      const { error: emailError } = await supabase
        .from('notifications')
        .insert({
          user_id: user.id,
          notification_type: 'order_status',
          delivery_method: 'email',
          title: `Potwierdzenie zamówienia ${orderNumber}`,
          message: `Twoje zamówienie ${orderNumber} zostało złożone. Oczekujemy na płatność.`,
          email_to: user.email || '',
          email_subject: `Potwierdzenie zamówienia ${orderNumber}`,
          email_body: `Twoje zamówienie ${orderNumber} zostało złożone. Oczekujemy na płatność.`,
          email_status: 'pending',
          metadata: {
            order_id: order.id,
            order_number: orderNumber,
            total_amount: orderTotal,
          },
        });

      if (emailError) {
        console.error('Error creating email notification:', emailError);
        // Don't fail the order if email notification fails
      }

      // Clear cart after successful order
      await clearCart();

      // Redirect to payment page
      navigate(`/payment?order_id=${order.id}`);
    } catch (err) {
      console.error('Error in handlePlaceOrder:', err);
      setError('Wystąpił nieoczekiwany błąd podczas składania zamówienia');
    } finally {
      setProcessingOrder(false);
    }
  };

  if (authLoading || loading) {
    return (
      <>
        <Navbar />
        <div className="checkout-container">
          <div className="checkout-loading">
            <div className="loading-spinner"></div>
            <p>Wczytywanie...</p>
          </div>
        </div>
      </>
    );
  }

  if (!user) {
    return null; // Will be redirected
  }

  if (items.length === 0) {
    return (
      <>
        <Navbar />
        <div className="checkout-container">
          <div className="checkout-empty">
            <h2>Twój koszyk jest pusty</h2>
            <p>Dodaj produkty do koszyka, aby kontynuować</p>
            <button className="btn-primary" onClick={() => navigate('/shop')}>
              Przejdź do sklepu
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="checkout-container">
      <h1>Finalizacja zamówienia</h1>

      {error && (
        <div className="checkout-error">
          <p>{error}</p>
          {error.includes('dane adresowe') && (
            <button className="btn-link" onClick={() => navigate('/profile')}>
              Przejdź do profilu
            </button>
          )}
        </div>
      )}

      <div className="checkout-content">
        {/* Shipping Information */}
        <div className="checkout-section">
          <div className="section-header">
            <h2>Adres wysyłki</h2>
            {!isEditingAddress && (
              <button className="btn-edit" onClick={() => setIsEditingAddress(true)}>
                Edytuj
              </button>
            )}
          </div>

          {isEditingAddress ? (
            <div className="shipping-form">
              <div className="form-row">
                <div className="form-group">
                  <label>Imię *</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Jan"
                  />
                </div>
                <div className="form-group">
                  <label>Nazwisko *</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Kowalski"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Email *</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="jan.kowalski@example.com"
                    disabled
                  />
                </div>
                <div className="form-group">
                  <label>Telefon</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+48 123 456 789"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Ulica i numer domu *</label>
                <input
                  type="text"
                  value={streetAddress}
                  onChange={(e) => setStreetAddress(e.target.value)}
                  placeholder="ul. Główna 123"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Kod pocztowy *</label>
                  <input
                    type="text"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    placeholder="00-000"
                  />
                </div>
                <div className="form-group">
                  <label>Miasto *</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Warszawa"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Kraj *</label>
                <input
                  type="text"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="Polska"
                />
              </div>

              <div className="form-actions">
                {userProfile?.street_address && (
                  <button
                    className="btn-cancel"
                    onClick={() => {
                      setIsEditingAddress(false);
                      // Reset to original values
                      setFirstName(userProfile.first_name || '');
                      setLastName(userProfile.last_name || '');
                      setPhone(userProfile.phone || '');
                      setStreetAddress(userProfile.street_address || '');
                      setCity(userProfile.city || '');
                      setPostalCode(userProfile.postal_code || '');
                      setCountry(userProfile.country || 'Polska');
                    }}
                  >
                    Anuluj
                  </button>
                )}
                <button className="btn-save" onClick={handleSaveAddress}>
                  Zapisz adres
                </button>
              </div>
            </div>
          ) : (
            <div className="shipping-info">
              <div className="info-row">
                <strong>Imię i nazwisko:</strong>
                <span>
                  {firstName && lastName
                    ? `${firstName} ${lastName}`
                    : 'Nie podano'}
                </span>
              </div>
              <div className="info-row">
                <strong>Email:</strong>
                <span>{email}</span>
              </div>
              <div className="info-row">
                <strong>Telefon:</strong>
                <span>{phone || 'Nie podano'}</span>
              </div>
              <div className="info-row">
                <strong>Adres:</strong>
                <span>{streetAddress || 'Nie podano'}</span>
              </div>
              <div className="info-row">
                <strong>Miasto:</strong>
                <span>
                  {postalCode && city ? `${postalCode} ${city}` : 'Nie podano'}
                </span>
              </div>
              <div className="info-row">
                <strong>Kraj:</strong>
                <span>{country}</span>
              </div>
            </div>
          )}
        </div>

        {/* Order Items */}
        <div className="checkout-section">
          <h2>Twoje zamówienie</h2>
          <div className="order-items">
            {items.map(item => {
              const product = item.products;
              if (!product) return null;

              return (
                <div key={item.product_id} className="order-item">
                  <div className="item-image-container">
                    {product.product_images && product.product_images.length > 0 ? (
                      <img 
                        src={product.product_images[0].thumbnail_url} 
                        alt={product.name}
                        className="item-image"
                      />
                    ) : (
                      <div className="item-image-placeholder">
                        Brak zdjęcia
                      </div>
                    )}
                  </div>
                  <div className="item-details">
                    <h3>{product.name}</h3>
                    <p className="item-quantity">Ilość: {item.quantity}</p>
                  </div>
                  <div className="item-price">
                    {(product.price * item.quantity).toFixed(2)} zł
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Order Summary */}
        <div className="checkout-section checkout-summary">
          <h2>Podsumowanie</h2>
          <div className="summary-row">
            <span>Wartość produktów:</span>
            <span>{totalPrice.toFixed(2)} zł</span>
          </div>
          <div className="summary-row">
            <span>Koszt wysyłki:</span>
            <span>{SHIPPING_COST.toFixed(2)} zł</span>
          </div>
          <div className="summary-divider"></div>
          <div className="summary-row summary-total">
            <span>Razem do zapłaty:</span>
            <span>{(totalPrice + SHIPPING_COST).toFixed(2)} zł</span>
          </div>

          <div className="checkout-actions">
            <button
              className="btn-secondary"
              onClick={() => navigate('/cart')}
              disabled={processingOrder}
            >
              Wróć do koszyka
            </button>
            <button
              className="btn-primary"
              onClick={handlePlaceOrder}
              disabled={
                processingOrder ||
                !streetAddress ||
                !city ||
                !postalCode
              }
            >
              {processingOrder ? 'Przetwarzanie...' : 'Złóż zamówienie'}
            </button>
          </div>

          <p className="checkout-notice">
            Po złożeniu zamówienia otrzymasz email z potwierdzeniem i linkiem do płatności.
          </p>
        </div>
      </div>
    </div>
    </>
  );
};

export default Checkout;
