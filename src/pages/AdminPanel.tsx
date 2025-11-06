import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminCheck } from '../hooks/useAdminCheck';
import { ThemeManager } from '../components/admin/ThemeManager';
import { CategoryManager } from '../components/admin/CategoryManager';
import { ProductManager } from '../components/admin/ProductManager';
import { UserManager } from '../components/admin/UserManager';
import './AdminPanel.css';

type AdminTab = 'themes' | 'categories' | 'products' | 'users';

export const AdminPanel = () => {
  const { isAdmin, loading } = useAdminCheck();
  const [activeTab, setActiveTab] = useState<AdminTab>('themes');
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="spinner"></div>
        <p>Ładowanie...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="admin-unauthorized">
        <h1>Brak dostępu</h1>
        <p>Nie masz uprawnień do przeglądania tej strony.</p>
      </div>
    );
  }

  return (
    <div className="admin-panel">
      <aside className="admin-sidebar">
        <div className="sidebar-header">
          <h2>Panel Administracyjny</h2>
          <div className="admin-badge">
            Administrator
          </div>
        </div>

        <nav className="admin-nav">
          <button
            className={`admin-nav-btn ${activeTab === 'themes' ? 'active' : ''}`}
            onClick={() => setActiveTab('themes')}
          >
            <span className="nav-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </span>
            <span className="nav-label">Motywy kolorystyczne</span>
          </button>

          <button
            className={`admin-nav-btn ${activeTab === 'categories' ? 'active' : ''}`}
            onClick={() => setActiveTab('categories')}
          >
            <span className="nav-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </span>
            <span className="nav-label">Kategorie</span>
          </button>

          <button
            className={`admin-nav-btn ${activeTab === 'products' ? 'active' : ''}`}
            onClick={() => setActiveTab('products')}
          >
            <span className="nav-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </span>
            <span className="nav-label">Produkty</span>
          </button>

          <button
            className={`admin-nav-btn ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            <span className="nav-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="9" cy="7" r="4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </span>
            <span className="nav-label">Użytkownicy</span>
          </button>

          <div className="sidebar-footer">
            <button
              className="admin-nav-btn btn-home"
              onClick={() => navigate('/')}
            >
              <span className="nav-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <polyline points="9 22 9 12 15 12 15 22" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
              <span className="nav-label">Strona główna</span>
            </button>
          </div>
        </nav>
      </aside>

      <main className="admin-content">
        {activeTab === 'themes' && (
          <ThemeManager />
        )}

        {activeTab === 'categories' && (
          <CategoryManager />
        )}

        {activeTab === 'products' && (
          <ProductManager />
        )}

        {activeTab === 'users' && (
          <UserManager />
        )}
      </main>
    </div>
  );
};
