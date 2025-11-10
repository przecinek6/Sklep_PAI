import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { Pagination } from '../Pagination';
import { usePagination } from '../../hooks/usePagination';
import type { UserProfile, UserRole } from '../../types/database.types';
import './UserManager.css';

interface BanFormData {
  userId: string;
  reason: string;
}

interface RoleChangeData {
  userId: string;
  currentRole: UserRole;
  newRole: UserRole;
}

interface UserWithBanInfo extends UserProfile {
  banned_by_profile?: {
    email: string;
    username?: string;
    first_name?: string;
    last_name?: string;
  } | null;
}

interface NotificationModal {
  show: boolean;
  type: 'success' | 'error';
  title: string;
  message: string;
}

export const UserManager = () => {
  const [users, setUsers] = useState<UserWithBanInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBanModal, setShowBanModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [notification, setNotification] = useState<NotificationModal>({
    show: false,
    type: 'success',
    title: '',
    message: ''
  });
  const [banForm, setBanForm] = useState<BanFormData>({ userId: '', reason: '' });
  const [roleChange, setRoleChange] = useState<RoleChangeData>({ 
    userId: '', 
    currentRole: 'user', 
    newRole: 'user' 
  });
  const [currentAdminId, setCurrentAdminId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'user' | 'moderator' | 'admin'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'banned'>('all');

  const itemsPerPage = 10;
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const matchesSearch = user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            user.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            user.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            user.last_name?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRole = roleFilter === 'all' || user.role === roleFilter;
      const matchesStatus = statusFilter === 'all' || 
                            (statusFilter === 'banned' ? user.is_banned : !user.is_banned);
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, searchQuery, roleFilter, statusFilter]);

  const { currentItems, currentPage, totalPages, goToPage } = usePagination({
    items: filteredUsers,
    itemsPerPage,
  });

  const showNotification = (type: 'success' | 'error', title: string, message: string) => {
    setNotification({ show: true, type, title, message });
    setTimeout(() => {
      setNotification({ show: false, type: 'success', title: '', message: '' });
    }, 3000);
  };

  useEffect(() => {
    loadCurrentAdmin();
    loadUsers();
  }, []);

  const loadCurrentAdmin = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentAdminId(user.id);
    }
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Pobierz informacje o użytkownikach którzy banowali (jeśli są)
      const usersWithBanInfo = await Promise.all(
        (data || []).map(async (user) => {
          if (user.banned_by) {
            const { data: bannerData } = await supabase
              .from('user_profiles')
              .select('email, username, first_name, last_name')
              .eq('id', user.banned_by)
              .single();
            
            return { ...user, banned_by_profile: bannerData };
          }
          return { ...user, banned_by_profile: null };
        })
      );

      setUsers(usersWithBanInfo);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBanUser = (userId: string) => {
    setBanForm({ userId, reason: '' });
    setShowBanModal(true);
  };

  const handleUnbanUser = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          is_banned: false,
          ban_reason: null,
          banned_at: null,
          banned_by: null,
        })
        .eq('id', userId);

      if (error) throw error;
      
      await loadUsers();
      showNotification('success', 'Sukces', 'Użytkownik został odblokowany');
    } catch (error) {
      console.error('Error unbanning user:', error);
      showNotification('error', 'Błąd', 'Nie udało się odblokować użytkownika');
    }
  };

  const submitBan = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!banForm.reason.trim()) {
      showNotification('error', 'Błąd', 'Podaj powód zawieszenia konta');
      return;
    }

    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          is_banned: true,
          ban_reason: banForm.reason,
          banned_at: new Date().toISOString(),
          banned_by: currentAdminId,
        })
        .eq('id', banForm.userId);

      if (error) throw error;

      await loadUsers();
      setShowBanModal(false);
      setBanForm({ userId: '', reason: '' });
      showNotification('success', 'Sukces', 'Użytkownik został zablokowany');
    } catch (error) {
      console.error('Error banning user:', error);
      showNotification('error', 'Błąd', 'Nie udało się zablokować użytkownika');
    }
  };

  const handleRoleChange = (userId: string, currentRole: UserRole) => {
    setRoleChange({ userId, currentRole, newRole: currentRole });
    setShowRoleModal(true);
  };

  const submitRoleChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (roleChange.userId === currentAdminId && roleChange.newRole !== 'admin') {
      showNotification('error', 'Błąd', 'Nie możesz odebrać sobie uprawnień administratora!');
      return;
    }

    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ role: roleChange.newRole })
        .eq('id', roleChange.userId);

      if (error) throw error;

      await loadUsers();
      setShowRoleModal(false);
      showNotification('success', 'Sukces', 'Rola użytkownika została zmieniona');
    } catch (error) {
      console.error('Error changing user role:', error);
      showNotification('error', 'Błąd', 'Nie udało się zmienić roli użytkownika');
    }
  };

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case 'admin': return 'role-badge-admin';
      case 'moderator': return 'role-badge-moderator';
      default: return 'role-badge-user';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin': return 'Administrator';
      case 'moderator': return 'Moderator';
      default: return 'Użytkownik';
    }
  };

  if (loading) {
    return (
      <div className="user-manager-loading">
        <div className="spinner"></div>
        <p>Ładowanie użytkowników...</p>
      </div>
    );
  }

  return (
    <div className="user-manager">
      <div className="user-manager-header">
        <div>
          <h2>Zarządzanie użytkownikami</h2>
          <p className="user-manager-hint">
            Zarządzaj kontami użytkowników, zmieniaj role i blokuj dostęp
          </p>
        </div>
      </div>

      <div className="user-filters">
        <input
          type="text"
          placeholder="Szukaj po email, nazwie..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />

        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as any)}
          className="filter-select"
        >
          <option value="all">Wszystkie role</option>
          <option value="user">Użytkownicy</option>
          <option value="moderator">Moderatorzy</option>
          <option value="admin">Administratorzy</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="filter-select"
        >
          <option value="all">Wszystkie statusy</option>
          <option value="active">Aktywni</option>
          <option value="banned">Zablokowani</option>
        </select>
      </div>

      {filteredUsers.length === 0 ? (
        <div className="no-users">
          <p>Brak użytkowników spełniających kryteria</p>
        </div>
      ) : (
        <>
          <div className="users-table-container">
            <table className="users-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Imię i nazwisko</th>
                  <th>Rola</th>
                  <th>Status</th>
                  <th>Data utworzenia</th>
                  <th>Akcje</th>
                </tr>
              </thead>
              <tbody>
                {currentItems.map((user) => (
                  <tr key={user.id} className={user.is_banned ? 'banned-row' : ''}>
                    <td data-label="Email">
                      <div className="user-email">
                        {user.email}
                        {user.username && <span className="username">@{user.username}</span>}
                      </div>
                    </td>
                    <td data-label="Imię i nazwisko">
                      {user.first_name || user.last_name
                        ? `${user.first_name || ''} ${user.last_name || ''}`.trim()
                        : '-'}
                    </td>
                    <td data-label="Rola">
                      <div className="role-cell">
                        <span className={`role-badge ${getRoleBadgeClass(user.role)}`}>
                          {getRoleLabel(user.role)}
                        </span>
                        {user.id !== currentAdminId && (
                          <button
                            className="btn-change-role"
                            onClick={() => handleRoleChange(user.id, user.role)}
                            title="Zmień rolę"
                          >
                            Zmień
                          </button>
                        )}
                      </div>
                    </td>
                    <td data-label="Status">
                      {user.is_banned ? (
                        <span className="status-badge status-banned">Zablokowany</span>
                      ) : (
                        <span className="status-badge status-active">Aktywny</span>
                      )}
                    </td>
                    <td data-label="Data utworzenia">
                      {user.created_at
                        ? new Date(user.created_at).toLocaleDateString('pl-PL')
                        : '-'}
                    </td>
                    <td data-label="Akcje">
                      <div className="user-actions">
                        {user.id === currentAdminId ? (
                          <span className="current-user-label">To Ty</span>
                        ) : user.is_banned ? (
                          <>
                            <button
                              className="btn-unban"
                              onClick={() => handleUnbanUser(user.id)}
                            >
                              Odblokuj
                            </button>
                            {user.ban_reason && (
                              <div className="ban-reason-tooltip">
                                <span className="info-icon">ⓘ</span>
                                <div className="tooltip-content">
                                  <strong>Powód:</strong> {user.ban_reason}
                                  <br />
                                  <strong>Data:</strong>{' '}
                                  {user.banned_at
                                    ? new Date(user.banned_at).toLocaleString('pl-PL')
                                    : '-'}
                                  <br />
                                  <strong>Zbanował:</strong>{' '}
                                  {user.banned_by_profile
                                    ? `${user.banned_by_profile.email}${
                                        user.banned_by_profile.first_name || user.banned_by_profile.last_name
                                          ? ` (${user.banned_by_profile.first_name || ''} ${user.banned_by_profile.last_name || ''}`.trim() + ')'
                                          : ''
                                      }`
                                    : 'Nieznany'}
                                </div>
                              </div>
                            )}
                          </>
                        ) : (
                          <button
                            className="btn-ban"
                            onClick={() => handleBanUser(user.id)}
                          >
                            Zablokuj
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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

      {showBanModal && (
        <div className="modal-overlay" onClick={() => setShowBanModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Zablokuj użytkownika</h3>
            <form onSubmit={submitBan}>
              <div className="form-group">
                <label htmlFor="ban-reason">
                  Powód zawieszenia konta <span className="required">*</span>
                </label>
                <textarea
                  id="ban-reason"
                  value={banForm.reason}
                  onChange={(e) => setBanForm({ ...banForm, reason: e.target.value })}
                  placeholder="np. Naruszenie regulaminu, spam, niewłaściwe zachowanie..."
                  rows={4}
                  required
                />
                <p className="form-hint">
                  Ten powód będzie widoczny dla użytkownika po zalogowaniu.
                </p>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowBanModal(false)}
                >
                  Anuluj
                </button>
                <button type="submit" className="btn-danger">
                  Zablokuj konto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showRoleModal && (
        <div className="modal-overlay" onClick={() => setShowRoleModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Zmień rolę użytkownika</h3>
            <form onSubmit={submitRoleChange}>
              <div className="form-group">
                <label htmlFor="new-role">
                  Nowa rola <span className="required">*</span>
                </label>
                <select
                  id="new-role"
                  value={roleChange.newRole}
                  onChange={(e) => setRoleChange({ ...roleChange, newRole: e.target.value as UserRole })}
                  className="role-select"
                  required
                >
                  <option value="user">Użytkownik</option>
                  <option value="moderator">Moderator</option>
                  <option value="admin">Administrator</option>
                </select>
                <p className="form-hint">
                  Obecna rola: <strong>{getRoleLabel(roleChange.currentRole)}</strong>
                </p>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowRoleModal(false)}
                >
                  Anuluj
                </button>
                <button type="submit" className="btn-primary">
                  Zmień rolę
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Notification Modal */}
      {notification.show && (
        <div className="modal-overlay notification-modal">
          <div className={`notification-content ${notification.type}`}>
            <div className="notification-header">
              <span className="notification-icon">
                {notification.type === 'success' ? '✓' : '✕'}
              </span>
              <h3>{notification.title}</h3>
            </div>
            <p className="notification-message">{notification.message}</p>
          </div>
        </div>
      )}
    </div>
  );
};
