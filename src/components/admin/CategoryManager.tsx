import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import type { Category } from '../../types/database.types';
import './CategoryManager.css';

interface CategoryWithChildren extends Category {
  children?: CategoryWithChildren[];
}

export const CategoryManager = () => {
  const [categories, setCategories] = useState<CategoryWithChildren[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    parent_id: null as string | null,
    icon: '',
    display_order: 0,
    is_active: true,
  });

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('display_order');

      if (error) throw error;
      
      setAllCategories(data || []);
      
      // Buduj drzewo kategorii
      const tree = buildCategoryTree(data || []);
      setCategories(tree);
    } catch (error) {
      console.error('Error loading categories:', error);
      alert('Błąd ładowania kategorii');
    } finally {
      setLoading(false);
    }
  };

  // Buduj hierarchię kategorii
  const buildCategoryTree = (categories: Category[]): CategoryWithChildren[] => {
    const map = new Map<string, CategoryWithChildren>();
    const roots: CategoryWithChildren[] = [];

    // Najpierw utwórz mapę wszystkich kategorii
    categories.forEach(cat => {
      map.set(cat.id, { ...cat, children: [] });
    });

    // Następnie zbuduj drzewo
    categories.forEach(cat => {
      const node = map.get(cat.id)!;
      if (cat.parent_id) {
        const parent = map.get(cat.parent_id);
        if (parent) {
          parent.children!.push(node);
        }
      } else {
        roots.push(node);
      }
    });

    return roots;
  };

  // Generuj slug z nazwy
  const generateSlug = (name: string): string => {
    return name
      .toLowerCase()
      .replace(/ą/g, 'a')
      .replace(/ć/g, 'c')
      .replace(/ę/g, 'e')
      .replace(/ł/g, 'l')
      .replace(/ń/g, 'n')
      .replace(/ó/g, 'o')
      .replace(/ś/g, 's')
      .replace(/ź|ż/g, 'z')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  };

  const handleNameChange = (name: string) => {
    setFormData({
      ...formData,
      name,
      slug: editingCategory ? formData.slug : generateSlug(name),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingCategory) {
        // Aktualizacja
        const { error } = await supabase
          .from('categories')
          .update({
            name: formData.name,
            slug: formData.slug,
            description: formData.description || null,
            parent_id: formData.parent_id,
            icon: formData.icon || null,
            display_order: formData.display_order,
            is_active: formData.is_active,
          })
          .eq('id', editingCategory.id);

        if (error) throw error;
      } else {
        // Tworzenie
        const { error } = await supabase
          .from('categories')
          .insert([{
            name: formData.name,
            slug: formData.slug,
            description: formData.description || null,
            parent_id: formData.parent_id,
            icon: formData.icon || null,
            display_order: formData.display_order,
            is_active: formData.is_active,
          }]);

        if (error) throw error;
      }

      resetForm();
      loadCategories();
    } catch (error: any) {
      console.error('Error saving category:', error);
      alert(error.message || 'Błąd zapisywania kategorii');
    }
  };

  const handleDelete = async (categoryId: string) => {
    if (!confirm('Czy na pewno chcesz usunąć tę kategorię? Wszystkie podkategorie również zostaną usunięte.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', categoryId);

      if (error) throw error;
      loadCategories();
    } catch (error) {
      console.error('Error deleting category:', error);
      alert('Błąd usuwania kategorii');
    }
  };

  const startEdit = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      slug: category.slug,
      description: category.description || '',
      parent_id: category.parent_id || null,
      icon: category.icon || '',
      display_order: category.display_order,
      is_active: category.is_active,
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setEditingCategory(null);
    setFormData({
      name: '',
      slug: '',
      description: '',
      parent_id: null,
      icon: '',
      display_order: 0,
      is_active: true,
    });
    setShowForm(false);
  };

  // Renderuj kategorię i jej dzieci rekurencyjnie
  const renderCategory = (category: CategoryWithChildren, level: number = 0) => {
    const indent = level * 24;

    return (
      <div key={category.id}>
        <div className="category-item" style={{ paddingLeft: `${indent + 16}px` }}>
          <div className="category-info">
            {category.icon && <span className="category-icon">{category.icon}</span>}
            <div className="category-details">
              <div className="category-name">
                {category.name}
                {!category.is_active && <span className="inactive-badge">Nieaktywna</span>}
              </div>
              <div className="category-meta">
                <span className="category-slug">/{category.slug}</span>
                {category.description && (
                  <span className="category-description">{category.description}</span>
                )}
              </div>
            </div>
          </div>
          <div className="category-actions">
            <button
              className="btn-small"
              onClick={() => startEdit(category)}
            >
              Edytuj
            </button>
            <button
              className="btn-small btn-danger"
              onClick={() => handleDelete(category.id)}
            >
              Usuń
            </button>
          </div>
        </div>
        {category.children && category.children.length > 0 && (
          <div className="category-children">
            {category.children.map(child => renderCategory(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return <div className="category-loading">Ładowanie kategorii...</div>;
  }

  return (
    <div className="category-manager">
      <div className="category-header">
        <h2>Zarządzanie kategoriami</h2>
        <button
          className="btn-primary"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? 'Anuluj' : 'Dodaj kategorię'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="category-form">
          <div className="form-row">
            <div className="form-group">
              <label>Nazwa kategorii *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="np. Elektronika"
                required
              />
            </div>

            <div className="form-group">
              <label>Slug (URL) *</label>
              <input
                type="text"
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                placeholder="elektronika"
                pattern="^[a-z0-9-]+$"
                required
              />
              <small>Tylko małe litery, cyfry i myślniki</small>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Kategoria nadrzędna</label>
              <select
                value={formData.parent_id || ''}
                onChange={(e) => setFormData({ ...formData, parent_id: e.target.value || null })}
              >
                <option value="">Brak (kategoria główna)</option>
                {allCategories
                  .filter(cat => cat.id !== editingCategory?.id)
                  .map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
              </select>
            </div>

            <div className="form-group">
              <label>Ikona (emoji)</label>
              <input
                type="text"
                value={formData.icon}
                onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                placeholder="📱"
                maxLength={2}
              />
            </div>

            <div className="form-group">
              <label>Kolejność wyświetlania</label>
              <input
                type="number"
                value={formData.display_order}
                onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
                min="0"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Opis</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Opcjonalny opis kategorii"
              rows={3}
            />
          </div>

          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              />
              <span>Aktywna (widoczna dla użytkowników)</span>
            </label>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn-primary">
              {editingCategory ? 'Zapisz zmiany' : 'Utwórz kategorię'}
            </button>
            <button type="button" className="btn-secondary" onClick={resetForm}>
              Anuluj
            </button>
          </div>
        </form>
      )}

      <div className="categories-tree">
        {categories.length === 0 ? (
          <p className="empty-state">Brak kategorii. Dodaj pierwszą kategorię!</p>
        ) : (
          categories.map(category => renderCategory(category))
        )}
      </div>
    </div>
  );
};
