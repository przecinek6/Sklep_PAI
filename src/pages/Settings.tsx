import { useState, useEffect } from 'react';
import { Navbar } from '../components/Navbar';
import { useTheme } from '../contexts/ThemeContext';
import { Palette, Check } from 'lucide-react';
import type { Theme } from '../types/database.types';
import './Settings.css';

export const Settings = () => {
  const { currentTheme, availableThemes, loading, setUserTheme, applyTheme } = useTheme();
  const [selectedThemeId, setSelectedThemeId] = useState<string | null>(null);
  const [previewTheme, setPreviewTheme] = useState<Theme | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (currentTheme) {
      setSelectedThemeId(currentTheme.id);
    }
  }, [currentTheme]);

  const handlePreview = (theme: Theme) => {
    setPreviewTheme(theme);
    applyTheme(theme);
  };

  const handleCancelPreview = () => {
    if (previewTheme && currentTheme) {
      applyTheme(currentTheme);
      setPreviewTheme(null);
      setSelectedThemeId(currentTheme.id);
    }
  };

  const handleSaveTheme = async () => {
    if (!selectedThemeId) return;

    try {
      setSaving(true);
      setError(null);
      
      await setUserTheme(selectedThemeId);
      
      setSuccess('Motyw został zapisany');
      setPreviewTheme(null);
      
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error saving theme:', err);
      setError('Błąd podczas zapisywania motywu');
    } finally {
      setSaving(false);
    }
  };

  const getContrastColor = (hexColor: string): string => {
    const rgb = parseInt(hexColor.slice(1), 16);
    const r = (rgb >> 16) & 0xff;
    const g = (rgb >> 8) & 0xff;
    const b = (rgb >> 0) & 0xff;
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return luma < 140 ? '#ffffff' : '#000000';
  };

  return (
    <>
      <Navbar />
      <div className="settings-container">
        <div className="settings-header">
          <div className="settings-title">
            <Palette size={32} />
            <h1>Ustawienia</h1>
          </div>
          <p className="settings-subtitle">Personalizuj wygląd aplikacji</p>
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

        <div className="settings-section">
          <h2>Motyw kolorystyczny</h2>
          <p className="section-description">
            Wybierz motyw kolorystyczny z listy dostępnych. Kliknij na kartę motywu, aby zobaczyć podgląd na żywo.
          </p>

          {loading ? (
            <div className="themes-loading">
              <div className="spinner"></div>
              <p>Ładowanie motywów...</p>
            </div>
          ) : availableThemes.length === 0 ? (
            <div className="themes-empty">
              <Palette size={48} className="empty-icon" />
              <p>Brak dostępnych motywów</p>
            </div>
          ) : (
            <>
              <div className="themes-grid">
                {availableThemes.map((theme) => (
                  <div
                    key={theme.id}
                    className={`theme-card ${selectedThemeId === theme.id ? 'selected' : ''} ${
                      previewTheme?.id === theme.id ? 'previewing' : ''
                    }`}
                    onClick={() => {
                      setSelectedThemeId(theme.id);
                      handlePreview(theme);
                    }}
                  >
                    {selectedThemeId === theme.id && !previewTheme && (
                      <div className="theme-badge current">
                        <Check size={16} />
                        Aktualny
                      </div>
                    )}
                    {previewTheme?.id === theme.id && (
                      <div className="theme-badge preview">
                        Podgląd
                      </div>
                    )}

                    <div className="theme-name">{theme.name}</div>

                    <div className="theme-colors">
                      <div
                        className="color-circle primary"
                        style={{ backgroundColor: theme.primary_color }}
                        title={`Primary: ${theme.primary_color}`}
                      >
                        <span style={{ color: getContrastColor(theme.primary_color) }}>P</span>
                      </div>
                      <div
                        className="color-circle secondary"
                        style={{ backgroundColor: theme.secondary_color }}
                        title={`Secondary: ${theme.secondary_color}`}
                      >
                        <span style={{ color: getContrastColor(theme.secondary_color) }}>S</span>
                      </div>
                      <div
                        className="color-circle accent"
                        style={{ backgroundColor: theme.accent_color }}
                        title={`Accent: ${theme.accent_color}`}
                      >
                        <span style={{ color: getContrastColor(theme.accent_color) }}>A</span>
                      </div>
                    </div>

                    <div className="theme-preview-bar">
                      <div className="preview-box" style={{ backgroundColor: theme.primary_color }}></div>
                      <div className="preview-box" style={{ backgroundColor: theme.secondary_color }}></div>
                      <div className="preview-box" style={{ backgroundColor: theme.accent_color }}></div>
                    </div>
                  </div>
                ))}
              </div>

              {previewTheme && (
                <div className="preview-actions">
                  <p className="preview-info">
                    <strong>Podgląd motywu:</strong> {previewTheme.name}. 
                    Zobacz jak zmienia się wygląd aplikacji.
                  </p>
                  <div className="preview-buttons">
                    <button
                      onClick={handleCancelPreview}
                      className="btn-cancel"
                      disabled={saving}
                    >
                      Anuluj podgląd
                    </button>
                    <button
                      onClick={handleSaveTheme}
                      className="btn-save"
                      disabled={saving}
                    >
                      {saving ? 'Zapisywanie...' : 'Zapisz ten motyw'}
                    </button>
                  </div>
                </div>
              )}

              {!previewTheme && selectedThemeId !== currentTheme?.id && (
                <div className="save-action">
                  <button
                    onClick={handleSaveTheme}
                    className="btn-save"
                    disabled={saving}
                  >
                    {saving ? 'Zapisywanie...' : 'Zapisz wybrany motyw'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Live Preview Demo */}
        <div className="settings-section demo-section">
          <h2>Podgląd elementów</h2>
          <p className="section-description">
            Poniżej możesz zobaczyć, jak wybrany motyw wpływa na różne elementy interfejsu.
          </p>

          <div className="demo-grid">
            <div className="demo-card">
              <h3>Przyciski</h3>
              <div className="demo-buttons">
                <button className="demo-btn primary">Primary</button>
                <button className="demo-btn secondary">Secondary</button>
                <button className="demo-btn accent">Accent</button>
              </div>
            </div>

            <div className="demo-card">
              <h3>Pola formularza</h3>
              <input type="text" className="demo-input" placeholder="Przykładowe pole tekstowe" />
              <select className="demo-select">
                <option>Wybierz opcję</option>
                <option>Opcja 1</option>
                <option>Opcja 2</option>
              </select>
            </div>

            <div className="demo-card">
              <h3>Tekst i kolory</h3>
              <p className="demo-text primary-text">Tekst w kolorze primary</p>
              <p className="demo-text secondary-text">Tekst w kolorze secondary</p>
              <p className="demo-text accent-text">Tekst w kolorze accent</p>
            </div>

            <div className="demo-card">
              <h3>Karty i powierzchnie</h3>
              <div className="demo-surface">
                <p>Powierzchnia z obramowaniem</p>
                <small>Kolor tła i obramowania dostosowany do motywu</small>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
