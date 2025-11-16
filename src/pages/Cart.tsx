import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../hooks/useCart';
import { useAuth } from '../hooks/useAuth';
import { Navbar } from '../components/Navbar';
import './Cart.css';

const Cart: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    items,
    loading,
    error,
    updateQuantity,
    removeFromCart,
    clearCart,
    totalItems,
    totalPrice,
  } = useCart();

  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [productToRemove, setProductToRemove] = useState<string | null>(null);

  const handleQuantityChange = async (productId: string, newQuantity: number) => {
    if (newQuantity < 1) return;
    await updateQuantity(productId, newQuantity);
  };

  const handleRemoveItem = async (productId: string) => {
    setProductToRemove(productId);
    setShowRemoveModal(true);
  };

  const confirmRemoveItem = async () => {
    if (productToRemove) {
      await removeFromCart(productToRemove);
      setShowRemoveModal(false);
      setProductToRemove(null);
    }
  };

  const handleClearCart = () => {
    setShowClearModal(true);
  };

  const confirmClearCart = async () => {
    await clearCart();
    setShowClearModal(false);
  };

  const handleCheckout = () => {
    if (!user) {
      // Redirect to login if not authenticated
      navigate('/login', { state: { from: '/checkout' } });
      return;
    }
    navigate('/checkout');
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="cart-container">
          <div className="cart-loading">
            <div className="loading-spinner"></div>
            <p>Wczytywanie koszyka...</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="cart-container">
      <div className="cart-header">
        <h1>Koszyk</h1>
        {items.length > 0 && (
          <button className="clear-cart-btn" onClick={handleClearCart}>
            Wyczyść koszyk
          </button>
        )}
      </div>

      {error && (
        <div className="cart-error">
          <p>{error}</p>
        </div>
      )}

      {items.length === 0 ? (
        <div className="cart-empty">
          <div className="empty-cart-icon">🛒</div>
          <h2>Twój koszyk jest pusty</h2>
          <p>Dodaj produkty do koszyka, aby kontynuować zakupy</p>
          <button className="continue-shopping-btn" onClick={() => navigate('/')}>
            Przejdź do sklepu
          </button>
        </div>
      ) : (
        <div className="cart-content">
          <div className="cart-items">
            <div className="cart-items-header">
              <div className="header-product">Produkt</div>
              <div className="header-price">Cena</div>
              <div className="header-quantity">Ilość</div>
              <div className="header-total">Suma</div>
              <div className="header-actions"></div>
            </div>

            {items.map((item) => {
              const product = item.products;
              if (!product) return null;

              const itemTotal = product.price * item.quantity;
              const isOutOfStock = product.stock_quantity < item.quantity;

              return (
                <div key={item.product_id} className={`cart-item ${isOutOfStock ? 'out-of-stock' : ''}`}>
                  <div className="item-product">
                    <div
                      className="item-image-container"
                      onClick={() => navigate(`/product/${product.slug}`)}
                    >
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
                      <h3
                        className="item-name"
                        onClick={() => navigate(`/product/${product.slug}`)}
                      >
                        {product.name}
                      </h3>
                      {isOutOfStock && (
                        <p className="stock-warning">
                          Dostępne tylko {product.stock_quantity} szt.
                        </p>
                      )}
                      {!product.is_active && (
                        <p className="stock-warning">
                          Produkt niedostępny
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="item-price">
                    {product.price.toFixed(2)} zł
                  </div>

                  <div className="item-quantity">
                    <button
                      className="quantity-btn"
                      onClick={() => handleQuantityChange(item.product_id, item.quantity - 1)}
                      disabled={item.quantity <= 1}
                    >
                      -
                    </button>
                    <input
                      type="number"
                      className="quantity-input"
                      value={item.quantity}
                      onChange={(e) => {
                        const value = parseInt(e.target.value);
                        if (!isNaN(value) && value > 0) {
                          handleQuantityChange(item.product_id, value);
                        }
                      }}
                      min="1"
                      max={product.stock_quantity}
                    />
                    <button
                      className="quantity-btn"
                      onClick={() => handleQuantityChange(item.product_id, item.quantity + 1)}
                      disabled={item.quantity >= product.stock_quantity}
                    >
                      +
                    </button>
                  </div>

                  <div className="item-total">
                    {itemTotal.toFixed(2)} zł
                  </div>

                  <div className="item-actions">
                    <button
                      className="remove-btn"
                      onClick={() => handleRemoveItem(item.product_id)}
                      title="Usuń z koszyka"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        <line x1="10" y1="11" x2="10" y2="17"></line>
                        <line x1="14" y1="11" x2="14" y2="17"></line>
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="cart-summary">
            <h2>Podsumowanie</h2>
            <div className="summary-row">
              <span>Liczba produktów:</span>
              <span>{totalItems} szt.</span>
            </div>
            <div className="summary-row">
              <span>Wartość produktów:</span>
              <span>{totalPrice.toFixed(2)} zł</span>
            </div>
            <div className="summary-divider"></div>
            <div className="summary-row summary-total">
              <span>Razem:</span>
              <span>{totalPrice.toFixed(2)} zł</span>
            </div>

            {!user && (
              <div className="guest-cart-notice">
                <p>💡 Zaloguj się, aby zachować koszyk na wszystkich urządzeniach</p>
              </div>
            )}

            <button
              className="checkout-btn"
              onClick={handleCheckout}
              disabled={items.some(item => 
                !item.products?.is_active || 
                item.products.stock_quantity < item.quantity
              )}
            >
              {user ? 'Przejdź do kasy' : 'Zaloguj się i przejdź do kasy'}
            </button>

            <button
              className="continue-shopping-btn-secondary"
              onClick={() => navigate('/')}
            >
              Kontynuuj zakupy
            </button>
          </div>
        </div>
      )}

      {/* Remove Item Modal */}
      {showRemoveModal && (
        <div className="modal-overlay" onClick={() => setShowRemoveModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Usunąć produkt?</h3>
            <p>Czy na pewno chcesz usunąć ten produkt z koszyka?</p>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setShowRemoveModal(false)}>
                Anuluj
              </button>
              <button className="btn-confirm" onClick={confirmRemoveItem}>
                Usuń
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Cart Modal */}
      {showClearModal && (
        <div className="modal-overlay" onClick={() => setShowClearModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Wyczyścić koszyk?</h3>
            <p>Czy na pewno chcesz usunąć wszystkie produkty z koszyka?</p>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setShowClearModal(false)}>
                Anuluj
              </button>
              <button className="btn-confirm" onClick={confirmClearCart}>
                Wyczyść
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
};

export default Cart;
