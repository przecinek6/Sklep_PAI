import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import type { Order, OrderItem, UserProfile, OrderStatus, PaymentStatus } from '../../types/database.types';
import { Pagination } from '../Pagination';
import './OrderManagement.css';

const ITEMS_PER_PAGE = 20;

interface OrderWithDetails extends Order {
  user_profiles?: UserProfile;
  order_items?: (OrderItem & { products?: { name: string; slug: string } })[];
}

export const OrderManagement = () => {
  const [orders, setOrders] = useState<OrderWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [paymentFilter, setPaymentFilter] = useState<PaymentStatus | 'all'>('all');
  const [selectedOrder, setSelectedOrder] = useState<OrderWithDetails | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  const goToPage = (page: number) => {
    setCurrentPage(page);
  };

  useEffect(() => {
    loadOrders();
  }, [currentPage, searchQuery, statusFilter, paymentFilter]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('orders')
        .select(`
          *,
          user_profiles (
            id,
            email,
            first_name,
            last_name,
            username
          )
        `, { count: 'exact' })
        .order('created_at', { ascending: false });

      // Apply filters
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      if (paymentFilter !== 'all') {
        query = query.eq('payment_status', paymentFilter);
      }

      // Apply search
      if (searchQuery) {
        query = query.or(`order_number.ilike.%${searchQuery}%,user_profiles.email.ilike.%${searchQuery}%`);
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
      console.error('Błąd podczas ładowania zamówień');
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
          user_profiles (*),
          order_items (
            *,
            products (name, slug)
          )
        `)
        .eq('id', orderId)
        .single();

      if (error) throw error;
      setSelectedOrder(data);
    } catch (error) {
      console.error('Error loading order details:', error);
      console.error('Błąd podczas ładowania szczegółów zamówienia');
    }
  };

  const sendOrderEmail = async (
    order: OrderWithDetails,
    newStatus: OrderStatus,
    isCancellation: boolean = false
  ) => {
    if (!order.user_profiles?.email) {
      throw new Error('Brak adresu email użytkownika');
    }

    setSendingEmail(true);
    try {
      // Get current session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Brak autoryzacji');
      }

      // Call Edge Function
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-order-email`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            orderId: order.id,
            userId: order.user_id,
            orderNumber: order.order_number,
            newStatus: newStatus,
            customerEmail: order.user_profiles.email,
            customerName: order.user_profiles.first_name || order.user_profiles.username,
            orderDate: order.created_at,
            totalAmount: order.total_amount,
            isCancellation: isCancellation
          })
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Nie udało się wysłać emaila');
      }

      console.log('Email sent successfully:', result);
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    } finally {
      setSendingEmail(false);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: OrderStatus) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId);

      if (error) throw error;

      // Send email notification
      const order = orders.find(o => o.id === orderId) || selectedOrder;
      if (order && order.user_profiles) {
        try {
          await sendOrderEmail(order, newStatus, false);
        } catch (emailError) {
          console.error('Email error:', emailError);
          // Don't fail the status update if email fails
              console.warn('Status zamówienia został zaktualizowany, ale wystąpił problem z wysłaniem emaila');
        }
      }

      // Reload orders
      await loadOrders();
      if (selectedOrder?.id === orderId) {
        await loadOrderDetails(orderId);
      }

      console.log('Status zamówienia został zaktualizowany');
    } catch (error) {
      console.error('Error updating order status:', error);
      console.error('Błąd podczas aktualizacji statusu zamówienia');
    }
  };

  const cancelOrder = async (orderId: string) => {
    if (!confirm('Czy na pewno chcesz anulować to zamówienie?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'cancelled' })
        .eq('id', orderId);

      if (error) throw error;

      // Send cancellation email
      const order = orders.find(o => o.id === orderId) || selectedOrder;
      if (order && order.user_profiles) {
        try {
          await sendOrderEmail(order, 'cancelled', true);
        } catch (emailError) {
          console.error('Email error:', emailError);
          console.warn('Zamówienie zostało anulowane, ale wystąpił problem z wysłaniem emaila');
        }
      }

      await loadOrders();
      if (selectedOrder?.id === orderId) {
        setSelectedOrder(null);
      }

      console.log('Zamówienie zostało anulowane');
    } catch (error) {
      console.error('Error cancelling order:', error);
      console.error('Błąd podczas anulowania zamówienia');
    }
  };

  const getStatusBadgeClass = (status: OrderStatus) => {
    switch (status) {
      case 'pending': return 'status-pending';
      case 'processing': return 'status-processing';
      case 'shipped': return 'status-shipped';
      case 'delivered': return 'status-delivered';
      case 'cancelled': return 'status-cancelled';
      case 'refunded': return 'status-refunded';
      default: return '';
    }
  };

  const getPaymentBadgeClass = (status: PaymentStatus) => {
    switch (status) {
      case 'pending': return 'payment-pending';
      case 'processing': return 'payment-processing';
      case 'paid': return 'payment-paid';
      case 'failed': return 'payment-failed';
      case 'refunded': return 'payment-refunded';
      default: return '';
    }
  };

  const statusLabels: Record<OrderStatus, string> = {
    pending: 'Oczekujące',
    processing: 'W realizacji',
    shipped: 'Wysłane',
    delivered: 'Dostarczone',
    cancelled: 'Anulowane',
    refunded: 'Zwrócone'
  };

  const paymentLabels: Record<PaymentStatus, string> = {
    pending: 'Oczekująca',
    processing: 'W trakcie',
    paid: 'Opłacone',
    failed: 'Niepowodzenie',
    refunded: 'Zwrócone'
  };

  return (
    <div className="order-management">
      <div className="order-filters">
        <input
          type="text"
          placeholder="Szukaj po numerze zamówienia lub emailu..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as OrderStatus | 'all')}
          className="filter-select"
        >
          <option value="all">Wszystkie statusy</option>
          <option value="pending">Oczekujące</option>
          <option value="processing">W realizacji</option>
          <option value="shipped">Wysłane</option>
          <option value="delivered">Dostarczone</option>
          <option value="cancelled">Anulowane</option>
          <option value="refunded">Zwrócone</option>
        </select>

        <select
          value={paymentFilter}
          onChange={(e) => setPaymentFilter(e.target.value as PaymentStatus | 'all')}
          className="filter-select"
        >
          <option value="all">Wszystkie płatności</option>
          <option value="pending">Oczekująca</option>
          <option value="processing">W trakcie</option>
          <option value="paid">Opłacone</option>
          <option value="failed">Niepowodzenie</option>
          <option value="refunded">Zwrócone</option>
        </select>
      </div>

      {loading ? (
        <div className="loading">Ładowanie zamówień...</div>
      ) : orders.length === 0 ? (
        <div className="no-data">Brak zamówień do wyświetlenia</div>
      ) : (
        <>
          <div className="orders-table">
            <table>
              <thead>
                <tr>
                  <th>Numer zamówienia</th>
                  <th>Klient</th>
                  <th>Data</th>
                  <th>Wartość</th>
                  <th>Status</th>
                  <th>Płatność</th>
                  <th>Akcje</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <strong>{order.order_number}</strong>
                    </td>
                    <td>
                      {order.user_profiles?.email || 'N/A'}
                      {order.user_profiles?.first_name && (
                        <div className="customer-name">
                          {order.user_profiles.first_name} {order.user_profiles.last_name}
                        </div>
                      )}
                    </td>
                    <td>{new Date(order.created_at).toLocaleDateString('pl-PL')}</td>
                    <td>{order.total_amount.toFixed(2)} PLN</td>
                    <td>
                      <span className={`badge ${getStatusBadgeClass(order.status)}`}>
                        {statusLabels[order.status]}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${getPaymentBadgeClass(order.payment_status)}`}>
                        {paymentLabels[order.payment_status]}
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={() => loadOrderDetails(order.id)}
                        className="btn-details"
                      >
                        Szczegóły
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobilny układ kart */}
            <div className="orders-mobile-cards">
              {orders.map((order) => (
                <div key={order.id} className="order-card-mobile">
                  <div className="order-card-header">
                    <div>
                      <div className="order-card-number">{order.order_number}</div>
                      <div className="order-card-date">
                        {new Date(order.created_at).toLocaleDateString('pl-PL')}
                      </div>
                    </div>
                    <div>{order.total_amount.toFixed(2)} PLN</div>
                  </div>

                  <div className="order-card-body">
                    <div className="order-card-row">
                      <span className="order-card-label">Klient:</span>
                      <span className="order-card-value">
                        {order.user_profiles?.first_name 
                          ? `${order.user_profiles.first_name} ${order.user_profiles.last_name}`
                          : order.user_profiles?.email || 'N/A'}
                      </span>
                    </div>

                    <div className="order-card-row">
                      <span className="order-card-label">Status:</span>
                      <span className={`badge ${getStatusBadgeClass(order.status)}`}>
                        {statusLabels[order.status]}
                      </span>
                    </div>

                    <div className="order-card-row">
                      <span className="order-card-label">Płatność:</span>
                      <span className={`badge ${getPaymentBadgeClass(order.payment_status)}`}>
                        {paymentLabels[order.payment_status]}
                      </span>
                    </div>
                  </div>

                  <div className="order-card-footer">
                    <button
                      onClick={() => loadOrderDetails(order.id)}
                      className="btn-details"
                    >
                      Zobacz szczegóły
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={goToPage}
          />
        </>
      )}

      {selectedOrder && (
        <div className="order-details-modal" onClick={() => setSelectedOrder(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Szczegóły zamówienia #{selectedOrder.order_number}</h2>
              <button onClick={() => setSelectedOrder(null)} className="close-btn">&times;</button>
            </div>

            <div className="modal-body">
              <div className="details-grid">
                <div className="detail-section">
                  <h3>Informacje o kliencie</h3>
                  <p><strong>Email:</strong> {selectedOrder.user_profiles?.email}</p>
                  {selectedOrder.user_profiles?.first_name && (
                    <p><strong>Imię i nazwisko:</strong> {selectedOrder.user_profiles.first_name} {selectedOrder.user_profiles.last_name}</p>
                  )}
                  {selectedOrder.user_profiles?.phone && (
                    <p><strong>Telefon:</strong> {selectedOrder.user_profiles.phone}</p>
                  )}
                </div>

                <div className="detail-section">
                  <h3>Adres wysyłki</h3>
                  {selectedOrder.shipping_address_street ? (
                    <>
                      <p>{selectedOrder.shipping_address_street}</p>
                      <p>{selectedOrder.shipping_address_postal_code} {selectedOrder.shipping_address_city}</p>
                      <p>{selectedOrder.shipping_address_country}</p>
                    </>
                  ) : (
                    <p>Brak danych adresowych</p>
                  )}
                </div>

                <div className="detail-section">
                  <h3>Status zamówienia</h3>
                  <div className="status-change">
                    <select
                      value={selectedOrder.status}
                      onChange={(e) => updateOrderStatus(selectedOrder.id, e.target.value as OrderStatus)}
                      disabled={sendingEmail}
                    >
                      <option value="pending">Oczekujące</option>
                      <option value="processing">W realizacji</option>
                      <option value="shipped">Wysłane</option>
                      <option value="delivered">Dostarczone</option>
                      <option value="cancelled">Anulowane</option>
                      <option value="refunded">Zwrócone</option>
                    </select>
                    {sendingEmail && <span className="sending-indicator">Wysyłanie email...</span>}
                  </div>
                  <p className="status-info">
                    <strong>Status płatności:</strong>{' '}
                    <span className={`badge ${getPaymentBadgeClass(selectedOrder.payment_status)}`}>
                      {paymentLabels[selectedOrder.payment_status]}
                    </span>
                  </p>
                </div>

                <div className="detail-section">
                  <h3>Podsumowanie</h3>
                  <p><strong>Data zamówienia:</strong> {new Date(selectedOrder.created_at).toLocaleString('pl-PL')}</p>
                  <p><strong>Wartość produktów:</strong> {(selectedOrder.total_amount - selectedOrder.shipping_cost).toFixed(2)} PLN</p>
                  <p><strong>Koszt dostawy:</strong> {selectedOrder.shipping_cost.toFixed(2)} PLN</p>
                  <p className="total"><strong>Suma:</strong> {selectedOrder.total_amount.toFixed(2)} PLN</p>
                </div>
              </div>

              {selectedOrder.order_items && selectedOrder.order_items.length > 0 && (
                <div className="detail-section full-width">
                  <h3>Produkty</h3>
                  <table className="items-table">
                    <thead>
                      <tr>
                        <th>Produkt</th>
                        <th>Cena jedn.</th>
                        <th>Ilość</th>
                        <th>Suma</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedOrder.order_items.map((item) => (
                        <tr key={item.id}>
                          <td data-label="Produkt">{item.products?.name || 'Nieznany produkt'}</td>
                          <td data-label="Cena jedn.">{item.price.toFixed(2)} PLN</td>
                          <td data-label="Ilość">{item.quantity}</td>
                          <td data-label="Suma">{(item.price * item.quantity).toFixed(2)} PLN</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="modal-actions">
                {selectedOrder.status !== 'cancelled' && (
                  <button
                    onClick={() => cancelOrder(selectedOrder.id)}
                    className="btn-cancel"
                    disabled={sendingEmail}
                  >
                    Anuluj zamówienie
                  </button>
                )}
                <button onClick={() => setSelectedOrder(null)} className="btn-close">
                  Zamknij
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderManagement;