import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { Navbar } from '../components/Navbar';
import type { UserProfile } from '../types/database.types';
import './MyAccount.css';

type TabType = 'personal' | 'address' | 'security' | 'accounts';

interface IdentityData {
  provider: string;
  created_at: string;
}

export const MyAccount = () => {
  const [activeTab, setActiveTab] = useState<TabType>('personal');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [identities, setIdentities] = useState<IdentityData[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Form states
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [streetAddress, setStreetAddress] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('Nie jesteś zalogowany');
      }

      // Load user profile
      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;

      setProfile(profileData);
      
      // Set form values
      setFirstName(profileData.first_name || '');
      setLastName(profileData.last_name || '');
      setPhone(profileData.phone || '');
      setStreetAddress(profileData.street_address || '');
      setPostalCode(profileData.postal_code || '');
      setCity(profileData.city || '');
      setCountry(profileData.country || 'Polska');

      // Load linked identities
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user?.identities) {
        setIdentities(userData.user.identities as IdentityData[]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Błąd ładowania profilu');
    } finally {
      setLoading(false);
    }
  };

  const handleSavePersonal = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Nie jesteś zalogowany');

      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({
          first_name: firstName.trim() || null,
          last_name: lastName.trim() || null,
          phone: phone.trim() || null,
        })
        .eq('id', user.id);

      if (updateError) throw updateError;

      setSuccess('Dane osobowe zostały zaktualizowane');
      await loadProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Błąd zapisywania danych');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAddress = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Nie jesteś zalogowany');

      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({
          street_address: streetAddress.trim() || null,
          postal_code: postalCode.trim() || null,
          city: city.trim() || null,
          country: country.trim() || null,
        })
        .eq('id', user.id);

      if (updateError) throw updateError;

      setSuccess('Dane adresowe zostały zaktualizowane');
      await loadProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Błąd zapisywania danych');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      // Validate passwords
      if (!currentPassword || !newPassword || !confirmPassword) {
        throw new Error('Wszystkie pola są wymagane');
      }

      if (newPassword !== confirmPassword) {
        throw new Error('Nowe hasła nie są identyczne');
      }

      if (newPassword.length < 6) {
        throw new Error('Nowe hasło musi mieć co najmniej 6 znaków');
      }

      // Try to sign in with current password to verify it
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) throw new Error('Nie można zweryfikować użytkownika');

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });

      if (signInError) throw new Error('Aktualne hasło jest nieprawidłowe');

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) throw updateError;

      setSuccess('Hasło zostało zmienione');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Błąd zmiany hasła');
    } finally {
      setSaving(false);
    }
  };

  const handleLinkProvider = async (provider: 'google' | 'github') => {
    try {
      setError(null);
      
      const { error } = await supabase.auth.linkIdentity({
        provider,
      });

      if (error) throw error;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Błąd podłączania konta');
    }
  };

  const handleUnlinkProvider = async (provider: string) => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const identity = identities.find(i => i.provider === provider);
      if (!identity) throw new Error('Nie znaleziono podłączonego konta');

      // Note: Supabase doesn't have a direct unlink method yet
      // This would require backend implementation
      setError('Odłączanie kont będzie wkrótce dostępne');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Błąd odłączania konta');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      setSaving(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Nie jesteś zalogowany');

      // This would require admin privileges or RPC function
      // For now, we'll show a message
      setError('Usunięcie konta wymaga kontaktu z administratorem');
      setShowDeleteConfirm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Błąd usuwania konta');
    } finally {
      setSaving(false);
    }
  };

  const isOAuthUser = profile?.provider && profile.provider !== 'email';
  const hasGoogleLinked = identities.some(i => i.provider === 'google');
  const hasGithubLinked = identities.some(i => i.provider === 'github');

  if (loading) {
    return (
      <div className="account-loading">
        <div className="spinner" />
        <p>Ładowanie profilu...</p>
      </div>
    );
  }

  return (
    <div className="account-page">
      <Navbar />
      
      <div className="account-container">

        <div className="account-content">
          {/* Tabs Navigation */}
          <div className="account-tabs">
            <button
              className={`tab-button ${activeTab === 'personal' ? 'active' : ''}`}
              onClick={() => setActiveTab('personal')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="12" cy="7" r="4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Dane osobowe
            </button>
            <button
              className={`tab-button ${activeTab === 'address' ? 'active' : ''}`}
              onClick={() => setActiveTab('address')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="12" cy="10" r="3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Adres
            </button>
            <button
              className={`tab-button ${activeTab === 'security' ? 'active' : ''}`}
              onClick={() => setActiveTab('security')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Bezpieczeństwo
            </button>
            <button
              className={`tab-button ${activeTab === 'accounts' ? 'active' : ''}`}
              onClick={() => setActiveTab('accounts')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="8.5" cy="7" r="4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M20 8v6M23 11h-6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Powiązane konta
            </button>
          </div>

          {/* Tab Content */}
          <motion.div
            className="tab-content"
            key={activeTab}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* Messages */}
            {error && (
              <div className="message error-message">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <circle cx="12" cy="12" r="10" strokeWidth="2"/>
                  <line x1="12" y1="8" x2="12" y2="12" strokeWidth="2" strokeLinecap="round"/>
                  <line x1="12" y1="16" x2="12.01" y2="16" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                {error}
              </div>
            )}
            
            {success && (
              <div className="message success-message">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <polyline points="22 4 12 14.01 9 11.01" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {success}
              </div>
            )}

            {/* Personal Data Tab */}
            {activeTab === 'personal' && (
              <div className="tab-panel">
                <div className="panel-header">
                  <h2>Dane osobowe</h2>
                  <p>Zarządzaj swoimi podstawowymi informacjami</p>
                </div>

                <div className="form-section">
                  <div className="info-row">
                    <label>Email</label>
                    <div className="info-value">
                      {profile?.email}
                      <span className="badge">{isOAuthUser ? profile.provider?.toUpperCase() : 'Email'}</span>
                    </div>
                  </div>

                  <div className="info-row">
                    <label>Data utworzenia konta</label>
                    <div className="info-value">
                      {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('pl-PL', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      }) : 'Brak danych'}
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="firstName">Imię</label>
                      <input
                        id="firstName"
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="Wprowadź imię"
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="lastName">Nazwisko</label>
                      <input
                        id="lastName"
                        type="text"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="Wprowadź nazwisko"
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="phone">Numer telefonu</label>
                    <input
                      id="phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+48 123 456 789"
                    />
                  </div>

                  <button
                    className="btn-primary"
                    onClick={handleSavePersonal}
                    disabled={saving}
                  >
                    {saving ? 'Zapisywanie...' : 'Zapisz zmiany'}
                  </button>
                </div>
              </div>
            )}

            {/* Address Tab */}
            {activeTab === 'address' && (
              <div className="tab-panel">
                <div className="panel-header">
                  <h2>Dane adresowe</h2>
                  <p>Te dane będą używane jako domyślny adres wysyłki</p>
                </div>

                <div className="form-section">
                  <div className="form-group">
                    <label htmlFor="streetAddress">Ulica i numer domu/mieszkania</label>
                    <input
                      id="streetAddress"
                      type="text"
                      value={streetAddress}
                      onChange={(e) => setStreetAddress(e.target.value)}
                      placeholder="ul. Przykładowa 123/45"
                    />
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="postalCode">Kod pocztowy</label>
                      <input
                        id="postalCode"
                        type="text"
                        value={postalCode}
                        onChange={(e) => setPostalCode(e.target.value)}
                        placeholder="00-000"
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="city">Miasto</label>
                      <input
                        id="city"
                        type="text"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="Warszawa"
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="country">Kraj</label>
                    <select
                      id="country"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                    >
                      <option value="Polska">Polska</option>
                      <option value="Niemcy">Niemcy</option>
                      <option value="Czechy">Czechy</option>
                      <option value="Słowacja">Słowacja</option>
                      <option value="Ukraina">Ukraina</option>
                    </select>
                  </div>

                  <button
                    className="btn-primary"
                    onClick={handleSaveAddress}
                    disabled={saving}
                  >
                    {saving ? 'Zapisywanie...' : 'Zapisz zmiany'}
                  </button>
                </div>
              </div>
            )}

            {/* Security Tab */}
            {activeTab === 'security' && (
              <div className="tab-panel">
                <div className="panel-header">
                  <h2>Bezpieczeństwo</h2>
                  <p>Zmień hasło i zarządzaj bezpieczeństwem konta</p>
                </div>

                {isOAuthUser ? (
                  <div className="info-box">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <circle cx="12" cy="12" r="10" strokeWidth="2"/>
                      <line x1="12" y1="16" x2="12" y2="12" strokeWidth="2" strokeLinecap="round"/>
                      <line x1="12" y1="8" x2="12.01" y2="8" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                    <div>
                      <h3>Konto OAuth</h3>
                      <p>Zalogowałeś się przez {profile.provider?.toUpperCase()}. Zmiana hasła nie jest dostępna dla kont OAuth.</p>
                    </div>
                  </div>
                ) : (
                  <div className="form-section">
                    <div className="form-group">
                      <label htmlFor="currentPassword">Aktualne hasło</label>
                      <input
                        id="currentPassword"
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Wprowadź aktualne hasło"
                      />
                    </div>

                    <div className="form-divider" />

                    <div className="form-group">
                      <label htmlFor="newPassword">Nowe hasło</label>
                      <input
                        id="newPassword"
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Minimum 6 znaków"
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="confirmPassword">Potwierdź nowe hasło</label>
                      <input
                        id="confirmPassword"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Wprowadź ponownie nowe hasło"
                      />
                    </div>

                    <button
                      className="btn-primary"
                      onClick={handleChangePassword}
                      disabled={saving}
                    >
                      {saving ? 'Zapisywanie...' : 'Zmień hasło'}
                    </button>
                  </div>
                )}

                <div className="form-divider" />

                <div className="danger-zone">
                  <h3>Strefa niebezpieczna</h3>
                  <p>Usunięcie konta jest nieodwracalne. Wszystkie Twoje dane zostaną trwale usunięte.</p>
                  
                  {!showDeleteConfirm ? (
                    <button
                      className="btn-danger"
                      onClick={() => setShowDeleteConfirm(true)}
                    >
                      Usuń konto
                    </button>
                  ) : (
                    <div className="delete-confirm">
                      <p className="confirm-text">Czy na pewno chcesz usunąć swoje konto?</p>
                      <div className="confirm-buttons">
                        <button
                          className="btn-danger"
                          onClick={handleDeleteAccount}
                          disabled={saving}
                        >
                          {saving ? 'Usuwanie...' : 'Tak, usuń konto'}
                        </button>
                        <button
                          className="btn-secondary"
                          onClick={() => setShowDeleteConfirm(false)}
                        >
                          Anuluj
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Linked Accounts Tab */}
            {activeTab === 'accounts' && (
              <div className="tab-panel">
                <div className="panel-header">
                  <h2>Powiązane konta</h2>
                  <p>Zarządzaj kontami podłączonymi do Twojego profilu</p>
                </div>

                <div className="linked-accounts">
                  {/* Google */}
                  <div className="account-item">
                    <div className="account-icon google">
                      <svg width="24" height="24" viewBox="0 0 24 24">
                        <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                    </div>
                    <div className="account-info">
                      <h3>Google</h3>
                      <p>{hasGoogleLinked ? 'Konto podłączone' : 'Nie podłączono'}</p>
                    </div>
                    {hasGoogleLinked ? (
                      <button
                        className="btn-secondary btn-small"
                        onClick={() => handleUnlinkProvider('google')}
                        disabled={saving}
                      >
                        Odłącz
                      </button>
                    ) : (
                      <button
                        className="btn-primary btn-small"
                        onClick={() => handleLinkProvider('google')}
                      >
                        Podłącz
                      </button>
                    )}
                  </div>

                  {/* GitHub */}
                  <div className="account-item">
                    <div className="account-icon github">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                      </svg>
                    </div>
                    <div className="account-info">
                      <h3>GitHub</h3>
                      <p>{hasGithubLinked ? 'Konto podłączone' : 'Nie podłączono'}</p>
                    </div>
                    {hasGithubLinked ? (
                      <button
                        className="btn-secondary btn-small"
                        onClick={() => handleUnlinkProvider('github')}
                        disabled={saving}
                      >
                        Odłącz
                      </button>
                    ) : (
                      <button
                        className="btn-primary btn-small"
                        onClick={() => handleLinkProvider('github')}
                      >
                        Podłącz
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
};
