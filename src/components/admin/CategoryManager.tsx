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
  const [draggedCategory, setDraggedCategory] = useState<string | null>(null);
  const [dragOverCategory, setDragOverCategory] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<'before' | 'after' | 'inside'>('inside');

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    parent_id: null as string | null,
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

    // Sortuj kategorie po display_order
    const sortedCategories = [...categories].sort((a, b) => a.display_order - b.display_order);

    // Najpierw utwórz mapę wszystkich kategorii
    sortedCategories.forEach(cat => {
      map.set(cat.id, { ...cat, children: [] });
    });

    // Następnie zbuduj drzewo
    sortedCategories.forEach(cat => {
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

    // Sortuj dzieci każdego węzła
    const sortChildren = (node: CategoryWithChildren) => {
      if (node.children && node.children.length > 0) {
        node.children.sort((a, b) => a.display_order - b.display_order);
        node.children.forEach(sortChildren);
      }
    };
    roots.forEach(sortChildren);

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
      slug: generateSlug(name), // Zawsze generuj slug automatycznie
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

  const toggleActive = async (categoryId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('categories')
        .update({ is_active: !currentStatus })
        .eq('id', categoryId);

      if (error) throw error;
      loadCategories();
    } catch (error) {
      console.error('Error toggling category status:', error);
      alert('Błąd zmiany statusu kategorii');
    }
  };

  const startEdit = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      slug: category.slug,
      description: category.description || '',
      parent_id: category.parent_id || null,
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
      display_order: 0,
      is_active: true,
    });
    setShowForm(false);
  };

  // Drag & Drop handlers
  const handleDragStart = (e: React.DragEvent, categoryId: string) => {
    setDraggedCategory(categoryId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, categoryId: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    
    // Określ pozycję drop na podstawie pozycji kursora
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const mouseY = e.clientY - rect.top;
    const elementHeight = rect.height;
    const position = mouseY / elementHeight;
    
    let newPosition: 'before' | 'after' | 'inside';
    // Większe obszary dla before/after (40% górą, 40% dołem, 20% środek)
    if (position < 0.4) {
      newPosition = 'before';
    } else if (position > 0.6) {
      newPosition = 'after';
    } else {
      newPosition = 'inside';
    }
    
    if (dragOverCategory !== categoryId || dropPosition !== newPosition) {
      setDragOverCategory(categoryId);
      setDropPosition(newPosition);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.stopPropagation();
    // Sprawdź czy naprawdę opuszczamy element
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    if (
      e.clientX < rect.left ||
      e.clientX >= rect.right ||
      e.clientY < rect.top ||
      e.clientY >= rect.bottom
    ) {
      setDragOverCategory(null);
      setDropPosition('inside');
    }
  };

  const handleDrop = async (e: React.DragEvent, targetCategoryId: string | null, dropPosition: 'before' | 'after' | 'inside' = 'inside') => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!draggedCategory || draggedCategory === targetCategoryId) {
      setDraggedCategory(null);
      setDragOverCategory(null);
      return;
    }

    // Sprawdź czy nie tworzymy cyklu (nie możemy przenieść kategorii do jej własnego dziecka)
    const isDescendant = (parentId: string | null, childId: string): boolean => {
      if (!parentId) return false;
      if (parentId === childId) return true;
      
      const parent = allCategories.find(c => c.id === parentId);
      if (!parent || !parent.parent_id) return false;
      
      return isDescendant(parent.parent_id, childId);
    };

    if (targetCategoryId && dropPosition === 'inside' && isDescendant(targetCategoryId, draggedCategory)) {
      alert('Nie możesz przenieść kategorii do jej własnej podkategorii!');
      setDraggedCategory(null);
      setDragOverCategory(null);
      return;
    }

    try {
      const draggedCat = allCategories.find(c => c.id === draggedCategory);
      const targetCat = targetCategoryId ? allCategories.find(c => c.id === targetCategoryId) : null;
      
      if (!draggedCat) return;

      console.log('Moving category:', draggedCat.name, 'position:', dropPosition, 'target:', targetCat?.name || 'root');
      
      let newParentId: string | null;
      let newDisplayOrder: number;

      if (dropPosition === 'inside') {
        // Upuszczenie NA kategorię - staje się dzieckiem
        newParentId = targetCategoryId;
        // Znajdź najwyższy display_order wśród dzieci
        const siblings = allCategories.filter(c => c.parent_id === newParentId);
        newDisplayOrder = siblings.length > 0 ? Math.max(...siblings.map(c => c.display_order)) + 1 : 0;
      } else {
        // Upuszczenie PRZED lub PO kategorii - ten sam rodzic, inna kolejność
        newParentId = targetCat ? (targetCat.parent_id || null) : null;
        const siblings = allCategories.filter(c => c.parent_id === newParentId && c.id !== draggedCategory);
        
        if (dropPosition === 'before') {
          newDisplayOrder = targetCat ? targetCat.display_order : 0;
        } else {
          newDisplayOrder = targetCat ? targetCat.display_order + 1 : siblings.length;
        }

        // Przesuń wszystkie kategorie o display_order >= newDisplayOrder
        for (const sibling of siblings) {
          if (sibling.display_order >= newDisplayOrder) {
            await supabase
              .from('categories')
              .update({ display_order: sibling.display_order + 1 })
              .eq('id', sibling.id);
          }
        }
      }
      
      // Aktualizuj przeciąganą kategorię
      const { error } = await supabase
        .from('categories')
        .update({ 
          parent_id: newParentId,
          display_order: newDisplayOrder
        })
        .eq('id', draggedCategory);

      if (error) throw error;
      
      console.log('Category moved successfully to order:', newDisplayOrder);
      await loadCategories();
    } catch (error) {
      console.error('Error moving category:', error);
      alert('Błąd przenoszenia kategorii');
    } finally {
      setDraggedCategory(null);
      setDragOverCategory(null);
      setDropPosition('inside');
    }
  };

  // Renderuj węzeł drzewa z drag & drop
  const renderTreeNode = (category: CategoryWithChildren, level: number = 0) => {
    const isDragging = draggedCategory === category.id;
    const isDragOver = dragOverCategory === category.id;
    const indent = level * 20;

    return (
      <div key={category.id} className="tree-node-wrapper">
        {isDragOver && dropPosition === 'before' && (
          <div className="drop-indicator drop-before"></div>
        )}
        <div
          className={`tree-node ${isDragging ? 'dragging' : ''} ${
            isDragOver ? `drag-over-${dropPosition}` : ''
          }`}
          style={{ paddingLeft: `${indent}px` }}
          draggable
          onDragStart={(e) => handleDragStart(e, category.id)}
          onDragOver={(e) => handleDragOver(e, category.id)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => {
            e.stopPropagation();
            handleDrop(e, category.id, dropPosition);
          }}
        >
          <div className="tree-node-content">
            <span className="tree-drag-handle">⋮⋮</span>
            <span className="tree-node-name">{category.name}</span>
            {category.children && category.children.length > 0 && (
              <span className="tree-children-count">({category.children.length})</span>
            )}
          </div>
        </div>
        {isDragOver && dropPosition === 'after' && (
          <div className="drop-indicator drop-after"></div>
        )}
        {category.children && category.children.length > 0 && (
          <div className="tree-children">
            {category.children.map(child => renderTreeNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  // Renderuj kategorię i jej dzieci rekurencyjnie
  const renderCategory = (category: CategoryWithChildren, level: number = 0) => {
    const indent = level * 24;

    return (
      <div key={category.id} className="category-wrapper">
        <div className="category-item" style={{ paddingLeft: `${indent + 16}px` }}>
          <div className="category-info">
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
            <div className="toggle-container">
              <span className="toggle-label">Czy aktywna:</span>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={category.is_active}
                  onChange={() => toggleActive(category.id, category.is_active)}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
            <div className="category-buttons">
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
          className={showForm ? "btn-cancel-category" : "btn-add-category"}
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? 'Anuluj' : 'Dodaj kategorię'}
        </button>
      </div>

      <div className="category-layout">
        <div className="category-left">
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
                  {formData.name && (
                    <small style={{ color: 'var(--text-secondary)', marginTop: '4px', display: 'block' }}>
                      URL: /{formData.slug || 'będzie wygenerowany automatycznie'}
                    </small>
                  )}
                </div>

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

              <div className="form-actions">
                <button type="submit" className="btn-primary">
                  {editingCategory ? 'Zapisz zmiany' : 'Utwórz kategorię'}
                </button>
                <button type="button" className="btn-cancel-form" onClick={resetForm}>
                  Anuluj
                </button>
              </div>
            </form>
          )}

          <div className="categories-list">
            {categories.length === 0 ? (
              <p className="empty-state">Brak kategorii. Dodaj pierwszą kategorię!</p>
            ) : (
              categories.map(category => renderCategory(category))
            )}
          </div>
        </div>

        <div className="category-right">
          <div 
            className={`categories-tree-view ${dragOverCategory === 'root' ? 'drag-over-root' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              e.dataTransfer.dropEffect = 'move';
              if (dragOverCategory !== 'root') {
                setDragOverCategory('root');
                setDropPosition('inside');
              }
            }}
            onDragLeave={(e) => {
              e.stopPropagation();
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              if (
                e.clientX < rect.left ||
                e.clientX >= rect.right ||
                e.clientY < rect.top ||
                e.clientY >= rect.bottom
              ) {
                setDragOverCategory(null);
                setDropPosition('inside');
              }
            }}
            onDrop={(e) => {
              e.stopPropagation();
              // Upuszczenie na tło = ustawienie jako kategoria główna (parent_id = null)
              // Znajdź najwyższy display_order wśród kategorii głównych i dodaj na końcu
              const rootCategories = allCategories.filter(c => !c.parent_id);
              const maxOrder = rootCategories.length > 0 ? Math.max(...rootCategories.map(c => c.display_order)) : -1;
              
              if (draggedCategory) {
                const draggedCat = allCategories.find(c => c.id === draggedCategory);
                if (draggedCat) {
                  supabase
                    .from('categories')
                    .update({ 
                      parent_id: null,
                      display_order: maxOrder + 1
                    })
                    .eq('id', draggedCategory)
                    .then(({ error }) => {
                      if (error) {
                        console.error('Error moving to root:', error);
                        alert('Błąd przenoszenia kategorii');
                      } else {
                        loadCategories();
                      }
                      setDraggedCategory(null);
                      setDragOverCategory(null);
                      setDropPosition('inside');
                    });
                }
              }
            }}
          >
            {categories.length === 0 ? (
              <p className="empty-state">Brak kategorii</p>
            ) : (
              <div className="tree-root">
                {categories.map(category => renderTreeNode(category))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
