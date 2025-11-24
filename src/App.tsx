import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { ThemeProvider } from './contexts/ThemeContext';
import { Login } from './pages/Login';
import { AdminPanel } from './pages/AdminPanel';
import ModeratorPanel from './pages/ModeratorPanel';
import { MyAccount } from './pages/MyAccount';
import { Shop } from './pages/Shop';
import { ProductPage } from './pages/ProductPage';
import { SearchPage } from './pages/SearchPage';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import Payment from './pages/Payment';
import PaymentSuccess from './pages/PaymentSuccess';
import PaymentFailure from './pages/PaymentFailure';
import { MyOrders } from './pages/MyOrders';
import { Settings } from './pages/Settings';
import './App.css';

function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: 'var(--surface)',
        color: 'var(--text-primary)',
        fontSize: '24px',
        fontWeight: '600'
      }}>
        Ładowanie...
      </div>
    );
  }

  return (
    <ThemeProvider>
      <Router>
        <Routes>
          <Route
            path="/login"
            element={user ? <Navigate to="/" replace /> : <Login />}
          />
          <Route
            path="/"
            element={<Shop />}
          />
          <Route
            path="/product/:slug"
            element={<ProductPage />}
          />
          <Route
            path="/profile"
            element={user ? <MyAccount /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/orders"
            element={user ? <MyOrders /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/settings"
            element={user ? <Settings /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/moderator"
            element={user ? <ModeratorPanel /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/admin"
            element={user ? <AdminPanel /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/cart"
            element={<Cart />}
          />
          <Route
            path="/checkout"
            element={user ? <Checkout /> : <Navigate to="/login" state={{ from: '/checkout' }} replace />}
          />
          <Route
            path="/payment"
            element={user ? <Payment /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/payment/success"
            element={user ? <PaymentSuccess /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/payment/failure"
            element={user ? <PaymentFailure /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/search"
            element={<SearchPage />}
          />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;
