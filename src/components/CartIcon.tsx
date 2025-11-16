import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../hooks/useCart';
import './CartIcon.css';

const CartIcon: React.FC = () => {
  const navigate = useNavigate();
  const { totalItems, loading } = useCart();

  const handleClick = () => {
    navigate('/cart');
  };

  return (
    <button className="cart-icon-button" onClick={handleClick} aria-label="Koszyk">
      <div className="cart-icon-wrapper">
        <svg
          className="cart-icon-svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="9" cy="21" r="1" />
          <circle cx="20" cy="21" r="1" />
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
        </svg>
        {!loading && totalItems > 0 && (
          <span className="cart-badge">{totalItems > 99 ? '99+' : totalItems}</span>
        )}
      </div>
      <span className="cart-text">Koszyk</span>
    </button>
  );
};

export default CartIcon;
