import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { ProductReport, ReportMessage } from '../types/database.types';
import { Flag, Send, X, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import './ProductReportModal.css';

interface ProductReportModalProps {
  productId: string;
  productName: string;
  currentUserId?: string;
  onClose: () => void;
}

export const ProductReportModal = ({ productId, productName, currentUserId, onClose }: ProductReportModalProps) => {
  const [existingReport, setExistingReport] = useState<ProductReport | null>(null);
  const [messages, setMessages] = useState<ReportMessage[]>([]);
  const [reason, setReason] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (currentUserId) {
      checkExistingReport();
    } else {
      setLoading(false);
    }
  }, [productId, currentUserId]);

  const checkExistingReport = async () => {
    if (!currentUserId) return;

    try {
      setLoading(true);

      // Check if user already has an active report for this product
      const { data: reportData, error: reportError } = await supabase
        .from('product_reports')
        .select('*')
        .eq('product_id', productId)
        .eq('user_id', currentUserId)
        .in('status', ['pending', 'in_progress'])
        .maybeSingle();

      if (reportError && reportError.code !== 'PGRST116') throw reportError;

      if (reportData) {
        setExistingReport(reportData);
        await loadMessages(reportData.id);
      }
    } catch (err) {
      console.error('Error checking existing report:', err);
      setError('Błąd podczas sprawdzania zgłoszeń');
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (reportId: string) => {
    try {
      const { data, error } = await supabase
        .from('report_messages')
        .select(`
          *,
          user_profiles (
            id,
            first_name,
            last_name,
            email,
            avatar_url,
            role
          )
        `)
        .eq('report_id', reportId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (err) {
      console.error('Error loading messages:', err);
    }
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserId || !reason.trim()) return;

    try {
      setSubmitting(true);
      setError(null);

      const { data, error: insertError } = await supabase
        .from('product_reports')
        .insert({
          product_id: productId,
          user_id: currentUserId,
          reason: reason.trim(),
          status: 'pending',
        })
        .select()
        .single();

      if (insertError) throw insertError;

      setExistingReport(data);
      setReason('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Błąd podczas wysyłania zgłoszenia');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserId || !existingReport || !newMessage.trim()) return;

    try {
      setSubmitting(true);
      setError(null);

      const { error: insertError } = await supabase
        .from('report_messages')
        .insert({
          report_id: existingReport.id,
          user_id: currentUserId,
          message: newMessage.trim(),
          is_moderator_message: false,
        });

      if (insertError) throw insertError;

      setNewMessage('');
      await loadMessages(existingReport.id);
      await checkExistingReport(); // Refresh report status
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Błąd podczas wysyłania wiadomości');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      pending: { icon: Clock, text: 'Oczekuje', color: 'warning' },
      in_progress: { icon: AlertCircle, text: 'W trakcie', color: 'info' },
      resolved: { icon: CheckCircle, text: 'Rozwiązane', color: 'success' },
      rejected: { icon: X, text: 'Odrzucone', color: 'error' },
    };

    const badge = badges[status as keyof typeof badges] || badges.pending;
    const Icon = badge.icon;

    return (
      <span className={`status-badge ${badge.color}`}>
        <Icon size={14} />
        {badge.text}
      </span>
    );
  };

  const getUserDisplayName = (user: any) => {
    if (!user) return 'Użytkownik';
    if (user.first_name || user.last_name) {
      return `${user.first_name || ''} ${user.last_name || ''}`.trim();
    }
    return user.email?.split('@')[0] || 'Użytkownik';
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content report-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>
              <Flag size={24} />
              Zgłoś problem
            </h2>
            <p className="product-name">{productName}</p>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <div className="modal-body">
          {loading ? (
            <div className="modal-loading">Ładowanie...</div>
          ) : !currentUserId ? (
            <div className="login-required">
              <AlertCircle size={48} />
              <p>Musisz być zalogowany, aby zgłosić problem</p>
            </div>
          ) : existingReport ? (
            <div className="report-conversation">
              <div className="report-info">
                <div className="report-status">
                  {getStatusBadge(existingReport.status)}
                </div>
                <p className="report-reason">
                  <strong>Powód zgłoszenia:</strong> {existingReport.reason}
                </p>
                <p className="report-date">
                  Zgłoszono: {new Date(existingReport.created_at).toLocaleDateString('pl-PL', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>

              {error && (
                <div className="message error-message">
                  <AlertCircle size={20} />
                  {error}
                </div>
              )}

              {messages.length > 0 && (
                <div className="messages-container">
                  <h3>Dyskusja</h3>
                  <div className="messages-list">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`message-bubble ${message.is_moderator_message ? 'moderator' : 'user'}`}
                      >
                        <div className="message-author">
                          {message.user_profiles?.avatar_url ? (
                            <img src={message.user_profiles.avatar_url} alt="" className="message-avatar" />
                          ) : (
                            <div className="message-avatar-placeholder">
                              {getUserDisplayName(message.user_profiles)[0].toUpperCase()}
                            </div>
                          )}
                          <div>
                            <span className="message-author-name">
                              {getUserDisplayName(message.user_profiles)}
                              {message.is_moderator_message && (
                                <span className="moderator-badge">Moderator</span>
                              )}
                            </span>
                            <span className="message-time">
                              {new Date(message.created_at).toLocaleTimeString('pl-PL', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                        </div>
                        <p className="message-text">{message.message}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {existingReport.status !== 'resolved' && existingReport.status !== 'rejected' && (
                <form className="message-form" onSubmit={handleSendMessage}>
                  <textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Napisz wiadomość..."
                    rows={3}
                    disabled={submitting}
                  />
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={submitting || !newMessage.trim()}
                  >
                    <Send size={18} />
                    {submitting ? 'Wysyłanie...' : 'Wyślij'}
                  </button>
                </form>
              )}

              {(existingReport.status === 'resolved' || existingReport.status === 'rejected') && (
                <div className="report-closed">
                  <AlertCircle size={20} />
                  <p>To zgłoszenie zostało {existingReport.status === 'resolved' ? 'rozwiązane' : 'odrzucone'}</p>
                </div>
              )}
            </div>
          ) : (
            <form className="report-form" onSubmit={handleSubmitReport}>
              {error && (
                <div className="message error-message">
                  <AlertCircle size={20} />
                  {error}
                </div>
              )}

              <div className="form-group">
                <label htmlFor="report-reason">Opisz problem *</label>
                <textarea
                  id="report-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Opisz szczegółowo, dlaczego zgłaszasz ten produkt..."
                  rows={6}
                  required
                  disabled={submitting}
                />
                <p className="form-help">
                  Nasz zespół przeanalizuje zgłoszenie i skontaktuje się z Tobą w tej sprawie.
                </p>
              </div>

              <div className="modal-actions">
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={submitting || !reason.trim()}
                >
                  {submitting ? 'Wysyłanie...' : 'Wyślij zgłoszenie'}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={onClose}
                  disabled={submitting}
                >
                  Anuluj
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
