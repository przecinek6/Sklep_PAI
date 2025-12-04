import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import type { ProductReport, ReportMessage, UserProfile, Product, ReportStatus } from '../../types/database.types';
import { Pagination } from '../Pagination';
import './ReportManagement.css';

const ITEMS_PER_PAGE = 20;

interface ReportWithDetails extends ProductReport {
  user_profiles?: UserProfile;
  products?: Product;
  messages?: (ReportMessage & { user_profiles?: UserProfile })[];
}

export const ReportManagement = () => {
  const [reports, setReports] = useState<ReportWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [filter, setFilter] = useState<ReportStatus | 'all'>('pending');
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [userRole, setUserRole] = useState<string>('');
  const [assignedCategories, setAssignedCategories] = useState<string[]>([]);
  const [selectedReport, setSelectedReport] = useState<ReportWithDetails | null>(null);
  const [messageText, setMessageText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  const goToPage = (page: number) => {
    setCurrentPage(page);
  };

  useEffect(() => {
    loadCurrentUser();
  }, []);

  useEffect(() => {
    if (userRole) {
      loadReports();
    }
  }, [currentPage, filter, userRole, assignedCategories]);

  const loadCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
      
      // Load user role
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      
      if (profile) {
        setUserRole(profile.role);
        
        // Load assigned categories for moderators
        if (profile.role === 'moderator') {
          const { data: categories } = await supabase
            .from('moderator_categories')
            .select('category_id')
            .eq('moderator_id', user.id);
          
          setAssignedCategories(categories?.map(c => c.category_id) || []);
        }
      }
    }
  };

  const loadReports = async () => {
    try {
      setLoading(true);
      
      // FIXED: Jawnie określ relację używając nazwy constraint
      let query = supabase
        .from('product_reports')
        .select(`
          *,
          user_profiles!product_reports_user_id_fkey (
            id,
            email,
            username,
            first_name,
            last_name
          ),
          products (
            id,
            name,
            slug,
            category_id
          )
        `, { count: 'exact' })
        .order('created_at', { ascending: false });

      // Apply filter
      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      // Apply pagination
      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) throw error;

      // Filter by assigned categories for moderators
      let filteredData = data || [];
      if (userRole === 'moderator' && assignedCategories.length > 0) {
        filteredData = data?.filter(report => 
          report.products?.category_id && assignedCategories.includes(report.products.category_id)
        ) || [];
      }

      setReports(filteredData);
      setTotalCount(userRole === 'moderator' && assignedCategories.length > 0 ? filteredData.length : (count || 0));
    } catch (error) {
      console.error('Error loading reports:', error);
      console.error('Błąd podczas ładowania zgłoszeń');
    } finally {
      setLoading(false);
    }
  };

  const loadReportMessages = async (reportId: string) => {
    try {
      const report = reports.find(r => r.id === reportId);
      if (!report) return;

      const { data: messages } = await supabase
        .from('report_messages')
        .select(`
          *,
          user_profiles (
            id,
            username,
            first_name,
            last_name,
            role
          )
        `)
        .eq('report_id', reportId)
        .order('created_at', { ascending: true });

      setSelectedReport({ ...report, messages: messages || [] });
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const sendReportEmail = async (
    report: ReportWithDetails,
    emailType: 'response' | 'resolved',
    message?: string
  ) => {
    if (!report.user_profiles?.email) {
      throw new Error('Brak adresu email użytkownika');
    }

    setSendingMessage(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Brak autoryzacji');
      }

      // Call Edge Function
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-report-email`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            reportId: report.id,
            userId: report.user_id,
            productId: report.product_id,
            customerEmail: report.user_profiles.email,
            customerName: report.user_profiles.first_name || report.user_profiles.username,
            productName: report.products?.name,
            emailType: emailType,
            message: message
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
      setSendingMessage(false);
    }
  };

  const sendMessage = async () => {
    if (!selectedReport || !messageText.trim()) return;

    setSendingMessage(true);
    try {
      const { error } = await supabase
        .from('report_messages')
        .insert({
          report_id: selectedReport.id,
          user_id: currentUserId,
          message: messageText.trim(),
          is_moderator_message: true
        });

      if (error) throw error;

      // Send email notification
      if (selectedReport.user_profiles) {
        try {
          await sendReportEmail(selectedReport, 'response', messageText.trim());
        } catch (emailError) {
          console.error('Email error:', emailError);
          // Don't fail the message send if email fails
        }
      }

      // Update report status to in_progress if pending
      if (selectedReport.status === 'pending') {
        await updateReportStatus(selectedReport.id, 'in_progress');
      }

      setMessageText('');
      await loadReportMessages(selectedReport.id);
    } catch (error) {
      console.error('Error sending message:', error);
      console.error('Błąd podczas wysyłania wiadomości');
    } finally {
      setSendingMessage(false);
    }
  };

  const updateReportStatus = async (reportId: string, newStatus: ReportStatus) => {
    try {
      const update: any = { status: newStatus };
      
      if (newStatus === 'in_progress' && !reports.find(r => r.id === reportId)?.assigned_to) {
        update.assigned_to = currentUserId;
      }

      const { error } = await supabase
        .from('product_reports')
        .update(update)
        .eq('id', reportId);

      if (error) throw error;

      // Send email if resolved
      const report = reports.find(r => r.id === reportId) || selectedReport;
      if (newStatus === 'resolved' && report && report.user_profiles) {
        try {
          await sendReportEmail(report, 'resolved');
        } catch (emailError) {
          console.error('Email error:', emailError);
        }
      }

      await loadReports();
      if (selectedReport?.id === reportId) {
        await loadReportMessages(reportId);
      }
    } catch (error) {
      console.error('Error updating status:', error);
      console.error('Błąd podczas aktualizacji statusu');
    }
  };

  const getStatusBadgeClass = (status: ReportStatus) => {
    switch (status) {
      case 'pending': return 'status-pending';
      case 'in_progress': return 'status-in-progress';
      case 'resolved': return 'status-resolved';
      case 'rejected': return 'status-rejected';
      default: return '';
    }
  };

  const statusLabels: Record<ReportStatus, string> = {
    pending: 'Oczekujące',
    in_progress: 'W trakcie',
    resolved: 'Rozwiązane',
    rejected: 'Odrzucone'
  };

  return (
    <div className="report-management">
      <div className="report-filters">
        <div className="filter-buttons">
          <button
            className={filter === 'pending' ? 'active' : ''}
            onClick={() => {
              setFilter('pending');
              goToPage(1);
            }}
          >
            Oczekujące ({filter === 'pending' ? totalCount : '...'})
          </button>
          <button
            className={filter === 'in_progress' ? 'active' : ''}
            onClick={() => {
              setFilter('in_progress');
              goToPage(1);
            }}
          >
            W trakcie
          </button>
          <button
            className={filter === 'resolved' ? 'active' : ''}
            onClick={() => {
              setFilter('resolved');
              goToPage(1);
            }}
          >
            Rozwiązane
          </button>
          <button
            className={filter === 'rejected' ? 'active' : ''}
            onClick={() => {
              setFilter('rejected');
              goToPage(1);
            }}
          >
            Odrzucone
          </button>
          <button
            className={filter === 'all' ? 'active' : ''}
            onClick={() => {
              setFilter('all');
              goToPage(1);
            }}
          >
            Wszystkie
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading">Ładowanie zgłoszeń...</div>
      ) : reports.length === 0 ? (
        <div className="no-data">
          {filter === 'pending' 
            ? 'Brak oczekujących zgłoszeń' 
            : 'Brak zgłoszeń do wyświetlenia'}
        </div>
      ) : (
        <>
          <div className="reports-list">
            {reports.map((report) => (
              <div key={report.id} className="report-card">
                <div className="report-header">
                  <div className="report-author">
                    <strong>
                      {report.user_profiles?.first_name || report.user_profiles?.username || 'Użytkownik'}
                      {report.user_profiles?.last_name && ` ${report.user_profiles.last_name}`}
                    </strong>
                    <span className="report-email">{report.user_profiles?.email}</span>
                  </div>
                  <div className="report-meta">
                    <span className="report-date">
                      {new Date(report.created_at).toLocaleDateString('pl-PL')}
                    </span>
                    <span className={`badge ${getStatusBadgeClass(report.status)}`}>
                      {statusLabels[report.status]}
                    </span>
                  </div>
                </div>

                <div className="report-product">
                  <strong>Produkt:</strong> {report.products?.name || 'Nieznany produkt'}
                </div>

                <div className="report-reason">
                  <strong>Powód:</strong>
                  <p>{report.reason}</p>
                </div>

                <div className="report-actions">
                  <button
                    onClick={() => loadReportMessages(report.id)}
                    className="btn-view"
                  >
                    Zobacz szczegóły
                  </button>
                </div>
              </div>
            ))}
          </div>

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={goToPage}
          />
        </>
      )}

      {selectedReport && (
        <div className="report-modal" onClick={() => setSelectedReport(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Szczegóły zgłoszenia</h2>
              <button onClick={() => setSelectedReport(null)} className="close-btn">&times;</button>
            </div>

            <div className="modal-body">
              <div className="report-info">
                <div className="info-row">
                  <strong>Zgłaszający:</strong>
                  <span>
                    {selectedReport.user_profiles?.first_name || selectedReport.user_profiles?.username}
                    {' '}({selectedReport.user_profiles?.email})
                  </span>
                </div>
                <div className="info-row">
                  <strong>Produkt:</strong>
                  <span>{selectedReport.products?.name}</span>
                </div>
                <div className="info-row">
                  <strong>Data zgłoszenia:</strong>
                  <span>{new Date(selectedReport.created_at).toLocaleString('pl-PL')}</span>
                </div>
                <div className="info-row">
                  <strong>Status:</strong>
                  <select
                    value={selectedReport.status}
                    onChange={(e) => updateReportStatus(selectedReport.id, e.target.value as ReportStatus)}
                    className="status-select"
                  >
                    <option value="pending">Oczekujące</option>
                    <option value="in_progress">W trakcie</option>
                    <option value="resolved">Rozwiązane</option>
                    <option value="rejected">Odrzucone</option>
                  </select>
                </div>
              </div>

              <div className="report-initial-reason">
                <strong>Powód zgłoszenia:</strong>
                <p>{selectedReport.reason}</p>
              </div>

              <div className="messages-section">
                <h3>Dyskusja</h3>
                <div className="messages-list">
                  {selectedReport.messages && selectedReport.messages.length > 0 ? (
                    selectedReport.messages.map((message) => (
                      <div
                        key={message.id}
                        className={`message-item ${message.is_moderator_message ? 'moderator' : 'user'}`}
                      >
                        <div className="message-header">
                          <strong>
                            {message.user_profiles?.first_name || message.user_profiles?.username || 'Użytkownik'}
                          </strong>
                          {message.is_moderator_message && (
                            <span className="moderator-badge">Moderator</span>
                          )}
                          <span className="message-date">
                            {new Date(message.created_at).toLocaleString('pl-PL')}
                          </span>
                        </div>
                        <p className="message-text">{message.message}</p>
                      </div>
                    ))
                  ) : (
                    <p className="no-messages">Brak wiadomości w dyskusji</p>
                  )}
                </div>
              </div>

              <div className="message-form">
                <textarea
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Wpisz odpowiedź dla użytkownika..."
                  rows={4}
                  disabled={sendingMessage}
                />
                <button
                  onClick={sendMessage}
                  className="btn-send"
                  disabled={!messageText.trim() || sendingMessage}
                >
                  {sendingMessage ? 'Wysyłanie...' : 'Wyślij wiadomość'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportManagement;