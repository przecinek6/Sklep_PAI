import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, CheckCheck, Trash2 } from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';
import './NotificationIcon.css';

export const NotificationIcon = () => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification
  } = useNotifications();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNotificationClick = async (notification: any) => {
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }
    
    if (notification.link) {
      navigate(notification.link);
      setIsOpen(false);
    }
  };

  const handleMarkAsRead = async (e: React.MouseEvent, notificationId: string) => {
    e.stopPropagation();
    await markAsRead(notificationId);
  };

  const handleDelete = async (e: React.MouseEvent, notificationId: string) => {
    e.stopPropagation();
    await deleteNotification(notificationId);
  };

  const handleMarkAllAsRead = async () => {
    await markAllAsRead();
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'order_status':
      case 'order_cancelled':
        return '📦';
      case 'payment_success':
        return '✅';
      case 'payment_failed':
        return '❌';
      case 'review_approved':
        return '⭐';
      case 'review_rejected':
        return '🚫';
      case 'question_answered':
        return '💬';
      case 'report_response':
        return '🔔';
      case 'product_added':
        return '🆕';
      default:
        return '🔔';
    }
  };

  const formatTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInMinutes < 1) return 'Przed chwilą';
    if (diffInMinutes < 60) return `${diffInMinutes} min temu`;
    if (diffInHours < 24) return `${diffInHours}h temu`;
    if (diffInDays < 7) return `${diffInDays}d temu`;
    
    return date.toLocaleDateString('pl-PL', {
      day: 'numeric',
      month: 'short'
    });
  };

  return (
    <div className="notification-icon-wrapper" ref={dropdownRef}>
      <button
        className="notification-icon-button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Powiadomienia"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </button>

      {isOpen && (
        <div className="notification-dropdown">
          <div className="notification-header">
            <h3>Powiadomienia</h3>
            {unreadCount > 0 && (
              <button
                className="mark-all-read-btn"
                onClick={handleMarkAllAsRead}
                title="Oznacz wszystkie jako przeczytane"
              >
                <CheckCheck size={18} />
              </button>
            )}
          </div>

          <div className="notification-list">
            {loading ? (
              <div className="notification-loading">
                <div className="notification-spinner"></div>
                <span>Ładowanie...</span>
              </div>
            ) : notifications.length === 0 ? (
              <div className="notification-empty">
                <Bell size={48} className="empty-icon" />
                <p>Brak powiadomień</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`notification-item ${!notification.is_read ? 'unread' : ''}`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="notification-icon-emoji">
                    {getNotificationIcon(notification.notification_type)}
                  </div>
                  
                  <div className="notification-content">
                    <div className="notification-title">{notification.title}</div>
                    <div className="notification-message">{notification.message}</div>
                    <div className="notification-time">{formatTimeAgo(notification.created_at)}</div>
                  </div>

                  <div className="notification-actions">
                    {!notification.is_read && (
                      <button
                        className="notification-action-btn"
                        onClick={(e) => handleMarkAsRead(e, notification.id)}
                        title="Oznacz jako przeczytane"
                      >
                        <Check size={16} />
                      </button>
                    )}
                    <button
                      className="notification-action-btn delete"
                      onClick={(e) => handleDelete(e, notification.id)}
                      title="Usuń powiadomienie"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {notifications.length > 0 && (
            <div className="notification-footer">
              <button
                className="view-all-btn"
                onClick={() => {
                  setIsOpen(false);
                  // Could navigate to a full notifications page if needed
                }}
              >
                Wyświetlono {notifications.length} {notifications.length === 1 ? 'powiadomienie' : 'powiadomień'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
