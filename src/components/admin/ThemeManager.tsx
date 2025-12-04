import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import type { Theme } from '../../types/database.types';
import './ThemeManager.css';

export const ThemeManager = () => {
  const [themes, setThemes] = useState<Theme[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTheme, setEditingTheme] = useState<Theme | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    primary_color: '#2563eb',
    secondary_color: '#64748b',
    accent_color: '#0f172a',
  });

  useEffect(() => {
    loadThemes();
  }, []);

  const loadThemes = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('themes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setThemes(data || []);
    } catch (error) {
      console.error('Error loading themes:', error);
      alert('Błąd ładowania motywów');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingTheme) {
        // Aktualizacja
        const { error } = await supabase
          .from('themes')
          .update({
            name: formData.name,
            primary_color: formData.primary_color,
            secondary_color: formData.secondary_color,
            accent_color: formData.accent_color,
          })
          .eq('id', editingTheme.id);

        if (error) throw error;
      } else {
        // Tworzenie
        const { error } = await supabase
          .from('themes')
          .insert([formData]);

        if (error) throw error;
      }

      resetForm();
      loadThemes();
    } catch (error: any) {
      console.error('Error saving theme:', error);
      alert(error.message || 'Błąd zapisywania motywu');
    }
  };

  const handleSetActive = async (themeId: string) => {
    try {
      const { error } = await supabase
        .from('themes')
        .update({ is_active: true })
        .eq('id', themeId);

      if (error) throw error;
      
      // Odśwież stronę aby natychmiast zastosować nowy motyw
      window.location.reload();
    } catch (error) {
      console.error('Error setting active theme:', error);
      alert('Błąd ustawiania aktywnego motywu');
    }
  };

  const handleDelete = async (themeId: string) => {
    if (!confirm('Czy na pewno chcesz usunąć ten motyw?')) return;

    try {
      const { error } = await supabase
        .from('themes')
        .delete()
        .eq('id', themeId);

      if (error) throw error;
      loadThemes();
    } catch (error) {
      console.error('Error deleting theme:', error);
      alert('Błąd usuwania motywu');
    }
  };

  const startEdit = (theme: Theme) => {
    setEditingTheme(theme);
    setFormData({
      name: theme.name,
      primary_color: theme.primary_color,
      secondary_color: theme.secondary_color,
      accent_color: theme.accent_color,
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setEditingTheme(null);
    setFormData({
      name: '',
      primary_color: '#2563eb',
      secondary_color: '#64748b',
      accent_color: '#0f172a',
    });
    setShowForm(false);
  };

  if (loading) {
    return <div className="theme-loading">Ładowanie motywów...</div>;
  }

  return (
    <div className="theme-manager">
      <div className="theme-header">
        <h2>Zarządzanie motywami kolorystycznymi</h2>
        <button
          className="btn-add-theme"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? 'Anuluj' : 'Dodaj motyw'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="theme-form">
          <div className="form-row">
            <div className="form-group">
              <label>Nazwa motywu</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="np. Niebieski Ocean"
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Kolor podstawowy</label>
              <div className="color-input">
                <input
                  type="color"
                  value={formData.primary_color}
                  onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                />
                <input
                  type="text"
                  value={formData.primary_color}
                  onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                  pattern="^#[0-9A-Fa-f]{6}$"
                  placeholder="#2563eb"
                />
              </div>
            </div>

            <div className="form-group">
              <label>Kolor drugorzędny</label>
              <div className="color-input">
                <input
                  type="color"
                  value={formData.secondary_color}
                  onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
                />
                <input
                  type="text"
                  value={formData.secondary_color}
                  onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
                  pattern="^#[0-9A-Fa-f]{6}$"
                  placeholder="#64748b"
                />
              </div>
            </div>

            <div className="form-group">
              <label>Kolor akcentujący</label>
              <div className="color-input">
                <input
                  type="color"
                  value={formData.accent_color}
                  onChange={(e) => setFormData({ ...formData, accent_color: e.target.value })}
                />
                <input
                  type="text"
                  value={formData.accent_color}
                  onChange={(e) => setFormData({ ...formData, accent_color: e.target.value })}
                  pattern="^#[0-9A-Fa-f]{6}$"
                  placeholder="#0f172a"
                />
              </div>
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn-primary">
              {editingTheme ? 'Zapisz zmiany' : 'Utwórz motyw'}
            </button>
            <button type="button" className="btn-cancel-form" onClick={resetForm}>
              Anuluj
            </button>
          </div>
        </form>
      )}

      <div className="themes-list">
        {themes.length === 0 ? (
          <p className="empty-state">Brak motywów. Dodaj pierwszy motyw!</p>
        ) : (
          themes.map((theme) => (
            <div key={theme.id} className="theme-card">
              <div className="theme-info">
                <div className="theme-name">
                  {theme.name}
                  {theme.is_active && <span className="active-badge">Aktywny</span>}
                </div>
                <div className="theme-colors">
                  <div
                    className="color-dot"
                    style={{ background: theme.primary_color }}
                    title={`Podstawowy: ${theme.primary_color}`}
                  />
                  <div
                    className="color-dot"
                    style={{ background: theme.secondary_color }}
                    title={`Drugorzędny: ${theme.secondary_color}`}
                  />
                  <div
                    className="color-dot"
                    style={{ background: theme.accent_color }}
                    title={`Akcentujący: ${theme.accent_color}`}
                  />
                </div>
              </div>
              <div className="theme-actions">
                {!theme.is_active && (
                  <button
                    className="btn-small btn-success"
                    onClick={() => handleSetActive(theme.id)}
                  >
                    Ustaw jako aktywny
                  </button>
                )}
                <button
                  className="btn-small"
                  onClick={() => startEdit(theme)}
                >
                  Edytuj
                </button>
                <button
                  className="btn-small btn-danger"
                  onClick={() => handleDelete(theme.id)}
                  disabled={theme.is_active}
                >
                  Usuń
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
