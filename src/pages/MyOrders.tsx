import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Navbar } from '../components/Navbar';
import { Pagination } from '../components/Pagination';
import type { Order, OrderItem, OrderStatus, PaymentStatus } from '../types/database.types';
import './MyOrders.css';

const ITEMS_PER_PAGE = 10;

interface OrderWithDetails extends Order {
  order_items?: (OrderItem & { 
    products?: { 
      name: string; 
      slug: string;
      id: string;
    } 
  })[];
}

interface ReviewFormData {
  productId: string;
  productName: string;
  rating: number;
  title: string;
  content: string;
}

export const MyOrders = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<OrderWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [selectedOrder, setSelectedOrder] = useState<OrderWithDetails | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewForm, setReviewForm] = useState<ReviewFormData>({
    productId: '',
    productName: '',
    rating: 5,
    title: '',
    content: ''
  });
  const [submittingReview, setSubmittingReview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  const goToPage = (page: number) => {
    setCurrentPage(page);
  };

  useEffect(() => {
    if (user) {
      loadOrders();
    }
  }, [currentPage, searchQuery, statusFilter, user]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('orders')
        .select(`
          *,
          order_items (
            *,
            products (id, name, slug)
          )
        `, { count: 'exact' })
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      // Apply filters
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      // Apply search (by order number or product name)
      if (searchQuery) {
        query = query.ilike('order_number', `%${searchQuery}%`);
      }

      // Apply pagination
      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) throw error;

      setOrders(data || []);
      setTotalCount(count || 0);
    } catch (error) {
      console.error('Error loading orders:', error);
      setError('Błąd podczas ładowania zamówień');
    } finally {
      setLoading(false);
    }
  };

  const loadOrderDetails = async (orderId: string) => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            *,
            products (id, name, slug)
          )
        `)
        .eq('id', orderId)
        .single();

      if (error) throw error;
      setSelectedOrder(data);
    } catch (error) {
      console.error('Error loading order details:', error);
      setError('Błąd podczas ładowania szczegółów zamówienia');
    }
  };

  const canCancelOrder = (order: Order): boolean => {
    return order.status === 'pending' || order.status === 'processing';
  };

  const handleCancelOrder = async (orderId: string) => {
    if (!confirm('Czy na pewno chcesz anulować to zamówienie?')) {
      return;
    }

    try {
      setCancelling(true);
      setError(null);

      const { error } = await supabase
        .from('orders')
        .update({ 
          status: 'cancelled',
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId)
        .eq('user_id', user?.id); // Security: ensure user owns the order

      if (error) throw error;

      setSuccess('Zamówienie zostało anulowane');
      loadOrders();
      
      if (selectedOrder?.id === orderId) {
        setSelectedOrder(null);
      }
    } catch (error) {
      console.error('Error cancelling order:', error);
      setError('Błąd podczas anulowania zamówienia');
    } finally {
      setCancelling(false);
    }
  };

  const canReviewProduct = (order: Order): boolean => {
    // Can review if order is delivered
    return order.status === 'delivered';
  };

  const openReviewModal = (productId: string, productName: string) => {
    setReviewForm({
      productId,
      productName,
      rating: 5,
      title: '',
      content: ''
    });
    setShowReviewModal(true);
  };

  const closeReviewModal = () => {
    setShowReviewModal(false);
    setReviewForm({
      productId: '',
      productName: '',
      rating: 5,
      title: '',
      content: ''
    });
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!reviewForm.content.trim()) {
      setError('Treść opinii jest wymagana');
      return;
    }

    try {
      setSubmittingReview(true);
      setError(null);

      const { error } = await supabase
        .from('product_reviews')
        .insert({
          product_id: reviewForm.productId,
          user_id: user?.id,
          rating: reviewForm.rating,
          title: reviewForm.title.trim() || null,
          content: reviewForm.content.trim(),
          is_approved: false
        });

      if (error) throw error;

      setSuccess('Opinia została dodana i oczekuje na zatwierdzenie');
      closeReviewModal();
    } catch (error) {
      console.error('Error submitting review:', error);
      setError('Błąd podczas dodawania opinii');
    } finally {
      setSubmittingReview(false);
    }
  };

  const getStatusLabel = (status: OrderStatus): string => {
    const labels: Record<OrderStatus, string> = {
      pending: 'Oczekujące na płatność',
      processing: 'W realizacji',
      shipped: 'Wysłane',
      delivered: 'Dostarczone',
      cancelled: 'Anulowane',
      refunded: 'Zwrócone'
    };
    return labels[status] || status;
  };

  const getPaymentStatusLabel = (status: PaymentStatus): string => {
    const labels: Record<PaymentStatus, string> = {
      pending: 'Oczekująca',
      processing: 'Przetwarzanie',
      paid: 'Zapłacone',
      failed: 'Niepowodzenie',
      refunded: 'Zwrócone'
    };
    return labels[status] || status;
  };

  const getStatusClass = (status: OrderStatus): string => {
    const classes: Record<OrderStatus, string> = {
      pending: 'status-pending',
      processing: 'status-processing',
      shipped: 'status-shipped',
      delivered: 'status-delivered',
      cancelled: 'status-cancelled',
      refunded: 'status-refunded'
    };
    return classes[status] || '';
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pl-PL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN'
    }).format(price);
  };

  return (
    <>
      <Navbar />
      <div className="my-orders-container">
        <div className="my-orders-header">
          <h1>Moje zamówienia</h1>
        </div>

        {error && (
          <div className="alert alert-error">
            {error}
            <button onClick={() => setError(null)}>×</button>
          </div>
        )}

        {success && (
          <div className="alert alert-success">
            {success}
            <button onClick={() => setSuccess(null)}>×</button>
          </div>
        )}

        <div className="my-orders-filters">
          <div className="filter-group">
            <input
              type="text"
              placeholder="Szukaj po numerze zamówienia..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="search-input"
            />
          </div>

          <div className="filter-group">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as OrderStatus | 'all');
                setCurrentPage(1);
              }}
              className="filter-select"
            >
              <option value="all">Wszystkie statusy</option>
              <option value="pending">Oczekujące na płatność</option>
              <option value="processing">W realizacji</option>
              <option value="shipped">Wysłane</option>
              <option value="delivered">Dostarczone</option>
              <option value="cancelled">Anulowane</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="loading">Ładowanie zamówień...</div>
        ) : orders.length === 0 ? (
          <div className="no-orders">
            <p>Nie masz jeszcze żadnych zamówień</p>
          </div>
        ) : (
          <>
            <div className="orders-list">
              {orders.map((order) => (
                <div key={order.id} className="order-card">
                  <div className="order-card-header">
                    <div className="order-info">
                      <h3>Zamówienie #{order.order_number}</h3>
                      <p className="order-date">{formatDate(order.created_at)}</p>
                    </div>
                    <div className="order-status-group">
                      <span className={`order-status ${getStatusClass(order.status)}`}>
                        {getStatusLabel(order.status)}
                      </span>
                      <span className={`payment-status payment-${order.payment_status}`}>
                        {getPaymentStatusLabel(order.payment_status)}
                      </span>
                    </div>
                  </div>

                  <div className="order-card-body">
                    <div className="order-summary">
                      <p className="order-total">
                        <strong>Suma:</strong> {formatPrice(order.total_amount)}
                      </p>
                      <p className="order-items-count">
                        {order.order_items?.length || 0} {order.order_items?.length === 1 ? 'produkt' : 'produkty'}
                      </p>
                    </div>

                    <div className="order-actions">
                      <button
                        onClick={() => loadOrderDetails(order.id)}
                        className="btn-secondary"
                      >
                        Szczegóły
                      </button>
                      {canCancelOrder(order) && (
                        <button
                          onClick={() => handleCancelOrder(order.id)}
                          disabled={cancelling}
                          className="btn-danger"
                        >
                          {cancelling ? 'Anulowanie...' : 'Anuluj zamówienie'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={goToPage}
              />
            )}
          </>
        )}

        {/* Order Details Modal */}
        {selectedOrder && (
          <div className="modal-overlay" onClick={() => setSelectedOrder(null)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Szczegóły zamówienia #{selectedOrder.order_number}</h2>
                <button className="modal-close" onClick={() => setSelectedOrder(null)}>
                  ×
                </button>
              </div>

              <div className="modal-body">
                <div className="order-details-section">
                  <h3>Status zamówienia</h3>
                  <div className="status-info">
                    <span className={`order-status ${getStatusClass(selectedOrder.status)}`}>
                      {getStatusLabel(selectedOrder.status)}
                    </span>
                    <span className={`payment-status payment-${selectedOrder.payment_status}`}>
                      Płatność: {getPaymentStatusLabel(selectedOrder.payment_status)}
                    </span>
                  </div>
                  <p className="order-date">
                    Data złożenia: {formatDate(selectedOrder.created_at)}
                  </p>
                </div>

                <div className="order-details-section">
                  <h3>Adres wysyłki</h3>
                  <p>{selectedOrder.shipping_address_street}</p>
                  <p>{selectedOrder.shipping_address_postal_code} {selectedOrder.shipping_address_city}</p>
                  <p>{selectedOrder.shipping_address_country}</p>
                </div>

                <div className="order-details-section">
                  <h3>Produkty</h3>
                  <div className="order-items">
                    {selectedOrder.order_items?.map((item) => (
                      <div key={item.id} className="order-item">
                        <div className="order-item-info">
                          <h4>{item.products?.name}</h4>
                          <p className="order-item-quantity">Ilość: {item.quantity}</p>
                        </div>
                        <div className="order-item-actions">
                          <p className="order-item-price">{formatPrice(item.price * item.quantity)}</p>
                          {canReviewProduct(selectedOrder) && (
                            <button
                              onClick={() => openReviewModal(item.product_id, item.products?.name || '')}
                              className="btn-review"
                            >
                              Wystaw opinię
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="order-details-section">
                  <h3>Podsumowanie</h3>
                  <div className="order-summary-details">
                    <div className="summary-row">
                      <span>Suma produktów:</span>
                      <span>{formatPrice(selectedOrder.total_amount - (selectedOrder.shipping_cost || 0))}</span>
                    </div>
                    <div className="summary-row">
                      <span>Koszt wysyłki:</span>
                      <span>{formatPrice(selectedOrder.shipping_cost || 0)}</span>
                    </div>
                    <div className="summary-row summary-total">
                      <span>Suma całkowita:</span>
                      <span>{formatPrice(selectedOrder.total_amount)}</span>
                    </div>
                  </div>
                </div>

                {canCancelOrder(selectedOrder) && (
                  <div className="order-details-section">
                    <button
                      onClick={() => handleCancelOrder(selectedOrder.id)}
                      disabled={cancelling}
                      className="btn-danger btn-full-width"
                    >
                      {cancelling ? 'Anulowanie...' : 'Anuluj zamówienie'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Review Modal */}
        {showReviewModal && (
          <div className="modal-overlay" onClick={closeReviewModal}>
            <div className="modal-content review-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Wystaw opinię</h2>
                <button className="modal-close" onClick={closeReviewModal}>
                  ×
                </button>
              </div>

              <div className="modal-body">
                <form onSubmit={handleSubmitReview}>
                  <div className="form-group">
                    <label>Produkt</label>
                    <p className="product-name">{reviewForm.productName}</p>
                  </div>

                  <div className="form-group">
                    <label htmlFor="rating">Ocena *</label>
                    <div className="rating-input">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          className={`star ${star <= reviewForm.rating ? 'active' : ''}`}
                          onClick={() => setReviewForm({ ...reviewForm, rating: star })}
                        >
                          ★
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="title">Tytuł opinii (opcjonalnie)</label>
                    <input
                      type="text"
                      id="title"
                      value={reviewForm.title}
                      onChange={(e) => setReviewForm({ ...reviewForm, title: e.target.value })}
                      maxLength={200}
                      placeholder="Krótki tytuł Twojej opinii"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="content">Treść opinii *</label>
                    <textarea
                      id="content"
                      value={reviewForm.content}
                      onChange={(e) => setReviewForm({ ...reviewForm, content: e.target.value })}
                      required
                      rows={5}
                      placeholder="Opisz swoją opinię o produkcie..."
                    />
                  </div>

                  <div className="form-actions">
                    <button
                      type="button"
                      onClick={closeReviewModal}
                      className="btn-secondary"
                      disabled={submittingReview}
                    >
                      Anuluj
                    </button>
                    <button
                      type="submit"
                      className="btn-primary"
                      disabled={submittingReview}
                    >
                      {submittingReview ? 'Wysyłanie...' : 'Wyślij opinię'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};
