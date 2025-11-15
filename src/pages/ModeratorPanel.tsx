import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminCheck } from '../hooks/useAdminCheck';
import { ProductManager } from '../components/admin/ProductManager';
import OrderManagement from '../components/moderator/OrderManagement';
import ReviewModeration from '../components/moderator/ReviewModeration';
import QuestionManagement from '../components/moderator/QuestionManagement';
import ReportManagement from '../components/moderator/ReportManagement';
import './ModeratorPanel.css';

type TabType = 'products' | 'orders' | 'reviews' | 'questions' | 'reports';

const ModeratorPanel = () => {
  const { role, loading } = useAdminCheck();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('products');

  if (loading) {
    return (
      <div className="moderator-panel-container">
        <div className="loading">Ładowanie...</div>
      </div>
    );
  }

  if (role !== 'moderator' && role !== 'admin') {
    navigate('/');
    return null;
  }

  return (
    <div className="moderator-panel-container">
      <div className="moderator-panel-header">
        <h1>Panel Moderatora</h1>
        <p>Zarządzaj produktami, zamówieniami, opiniami i zgłoszeniami</p>
      </div>

      <div className="moderator-tabs">
        <button
          className={activeTab === 'products' ? 'active' : ''}
          onClick={() => setActiveTab('products')}
        >
          Produkty
        </button>
        <button
          className={activeTab === 'orders' ? 'active' : ''}
          onClick={() => setActiveTab('orders')}
        >
          Zamówienia
        </button>
        <button
          className={activeTab === 'reviews' ? 'active' : ''}
          onClick={() => setActiveTab('reviews')}
        >
          Opinie
        </button>
        <button
          className={activeTab === 'questions' ? 'active' : ''}
          onClick={() => setActiveTab('questions')}
        >
          Pytania
        </button>
        <button
          className={activeTab === 'reports' ? 'active' : ''}
          onClick={() => setActiveTab('reports')}
        >
          Zgłoszenia
        </button>
      </div>

      <div className="moderator-content">
        {activeTab === 'products' && <ProductManager />}
        {activeTab === 'orders' && <OrderManagement />}
        {activeTab === 'reviews' && <ReviewModeration />}
        {activeTab === 'questions' && <QuestionManagement />}
        {activeTab === 'reports' && <ReportManagement />}
      </div>
    </div>
  );
};

export default ModeratorPanel;
