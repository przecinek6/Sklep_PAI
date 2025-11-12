import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { ThemeProvider } from './contexts/ThemeContext';
import { Login } from './pages/Login';
import { Home } from './pages/Home';
import { AdminPanel } from './pages/AdminPanel';
import { Shop } from './pages/Shop';
import { ProductPage } from './pages/ProductPage';
import { SearchPage } from './pages/SearchPage';
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
            element={user ? <Home /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/orders"
            element={user ? <div>Moje zamówienia - w budowie</div> : <Navigate to="/login" replace />}
          />
          <Route
            path="/settings"
            element={user ? <div>Ustawienia - w budowie</div> : <Navigate to="/login" replace />}
          />
          <Route
            path="/moderator"
            element={user ? <div>Panel moderatora - w budowie</div> : <Navigate to="/login" replace />}
          />
          <Route
            path="/admin"
            element={user ? <AdminPanel /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/cart"
            element={<div>Koszyk - w budowie</div>}
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
