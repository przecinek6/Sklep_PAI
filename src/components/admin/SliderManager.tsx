import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import type { SliderTemplate, Product, ProductImage } from '../../types/database.types';
import './SliderManager.css';

interface SliderTemplateProduct {
  id: string;
  template_id: string;
  product_id: string;
  display_order: number;
  product: Product & { product_images: ProductImage[] };
}

interface TemplateFormData {
  name: string;
}

export const SliderManager = () => {
  const [templates, setTemplates] = useState<SliderTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<SliderTemplate | null>(null);
  const [formData, setFormData] = useState<TemplateFormData>({ name: '' });
  
  // Stan dla edycji produktów w szablonie
  const [editingProducts, setEditingProducts] = useState(false);
  const [currentTemplate, setCurrentTemplate] = useState<SliderTemplate | null>(null);
  const [templateProducts, setTemplateProducts] = useState<SliderTemplateProduct[]>([]);
  const [availableProducts, setAvailableProducts] = useState<(Product & { product_images: ProductImage[] })[]>([]);
  
  // Drag & drop state
  const [draggedItem, setDraggedItem] = useState<number | null>(null);
  const [draggedAvailableProduct, setDraggedAvailableProduct] = useState<(Product & { product_images: ProductImage[] }) | null>(null);
  const [isDropZoneActive, setIsDropZoneActive] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('slider_templates')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Error loading templates:', error);
      alert('Błąd ładowania szablonów');
    } finally {
      setLoading(false);
    }
  };

  const loadTemplateProducts = async (templateId: string) => {
    try {
      const { data, error } = await supabase
        .from('slider_template_products')
        .select(`
          *,
          product:products(
            *,
            product_images(*)
          )
        `)
        .eq('template_id', templateId)
        .order('display_order', { ascending: true });

      if (error) throw error;
      setTemplateProducts((data || []) as SliderTemplateProduct[]);
    } catch (error) {
      console.error('Error loading template products:', error);
      alert('Błąd ładowania produktów szablonu');
    }
  };

  const loadAvailableProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*, product_images(*)')
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) throw error;
      setAvailableProducts(data || []);
    } catch (error) {
      console.error('Error loading products:', error);
      alert('Błąd ładowania produktów');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      alert('Nazwa szablonu jest wymagana');
      return;
    }

    try {
      if (editingTemplate) {
        const { error } = await supabase
          .from('slider_templates')
          .update({ name: formData.name.trim() })
          .eq('id', editingTemplate.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('slider_templates')
          .insert({ name: formData.name.trim() });

        if (error) throw error;
      }

      resetForm();
      loadTemplates();
    } catch (error: any) {
      console.error('Error saving template:', error);
      alert(error.message || 'Błąd zapisywania szablonu');
    }
  };

  const handleSetActive = async (templateId: string) => {
    try {
      const { error } = await supabase
        .from('slider_templates')
        .update({ is_active: true })
        .eq('id', templateId);

      if (error) throw error;
      loadTemplates();
    } catch (error) {
      console.error('Error setting active template:', error);
      alert('Błąd ustawiania aktywnego szablonu');
    }
  };

  const handleDelete = async (templateId: string) => {
    if (!confirm('Czy na pewno chcesz usunąć ten szablon slidera?')) return;

    try {
      const { error } = await supabase
        .from('slider_templates')
        .delete()
        .eq('id', templateId);

      if (error) throw error;
      loadTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      alert('Błąd usuwania szablonu');
    }
  };

  const startEdit = (template: SliderTemplate) => {
    setEditingTemplate(template);
    setFormData({ name: template.name });
    setShowForm(true);
  };

  const startEditProducts = async (template: SliderTemplate) => {
    setCurrentTemplate(template);
    setEditingProducts(true);
    await loadTemplateProducts(template.id);
    await loadAvailableProducts();
  };

  const resetForm = () => {
    setEditingTemplate(null);
    setFormData({ name: '' });
    setShowForm(false);
  };

  const closeProductEditor = () => {
    setEditingProducts(false);
    setCurrentTemplate(null);
    setTemplateProducts([]);
    setAvailableProducts([]);
  };

  const addProductToTemplate = async (product: Product & { product_images: ProductImage[] }) => {
    if (!currentTemplate) return;

    // Sprawdź czy produkt już jest w szablonie
    if (templateProducts.some(tp => tp.product_id === product.id)) {
      alert('Ten produkt już znajduje się w szablonie');
      return;
    }

    try {
      const maxOrder = templateProducts.length > 0
        ? Math.max(...templateProducts.map(tp => tp.display_order))
        : -1;

      const { error } = await supabase
        .from('slider_template_products')
        .insert({
          template_id: currentTemplate.id,
          product_id: product.id,
          display_order: maxOrder + 1
        });

      if (error) throw error;
      await loadTemplateProducts(currentTemplate.id);
    } catch (error) {
      console.error('Error adding product to template:', error);
      alert('Błąd dodawania produktu do szablonu');
    }
  };

  const removeProductFromTemplate = async (templateProductId: string) => {
    if (!currentTemplate) return;

    try {
      const { error } = await supabase
        .from('slider_template_products')
        .delete()
        .eq('id', templateProductId);

      if (error) throw error;
      await loadTemplateProducts(currentTemplate.id);
    } catch (error) {
      console.error('Error removing product from template:', error);
      alert('Błąd usuwania produktu z szablonu');
    }
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedItem(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    
    if (draggedItem === null || draggedItem === index) return;

    const newProducts = [...templateProducts];
    const draggedProduct = newProducts[draggedItem];
    
    // Usuń element z obecnej pozycji
    newProducts.splice(draggedItem, 1);
    // Wstaw na nowej pozycji
    newProducts.splice(index, 0, draggedProduct);
    
    setTemplateProducts(newProducts);
    setDraggedItem(index);
  };

  const handleDragEnd = async () => {
    if (!currentTemplate) return;

    try {
      // Zaktualizuj display_order dla wszystkich produktów
      const updates = templateProducts.map((tp, index) => ({
        id: tp.id,
        display_order: index
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from('slider_template_products')
          .update({ display_order: update.display_order })
          .eq('id', update.id);

        if (error) throw error;
      }

      await loadTemplateProducts(currentTemplate.id);
    } catch (error) {
      console.error('Error updating product order:', error);
      alert('Błąd aktualizacji kolejności produktów');
    } finally {
      setDraggedItem(null);
    }
  };

  // Drag & drop dla dostępnych produktów
  const handleAvailableProductDragStart = (e: React.DragEvent, product: Product & { product_images: ProductImage[] }) => {
    setDraggedAvailableProduct(product);
    setIsDropZoneActive(true);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleAvailableProductDragEnd = () => {
    setDraggedAvailableProduct(null);
    setIsDropZoneActive(false);
  };

  const handleDropZoneDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDropZoneDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDropZoneActive(false);

    if (!draggedAvailableProduct || !currentTemplate) return;

    await addProductToTemplate(draggedAvailableProduct);
    setDraggedAvailableProduct(null);
  };

  const getProductImage = (product: Product & { product_images: ProductImage[] }) => {
    if (product.product_images && product.product_images.length > 0) {
      const sortedImages = [...product.product_images].sort((a, b) => a.display_order - b.display_order);
      return sortedImages[0].thumbnail_url || sortedImages[0].original_url;
    }
    return 'https://via.placeholder.com/150';
  };

  if (loading) {
    return <div className="slider-loading">Ładowanie szablonów slidera...</div>;
  }

  if (editingProducts && currentTemplate) {
    return (
      <div className="slider-manager">
        <div className="slider-header">
          <div>
            <h2>Edycja szablonu: {currentTemplate.name}</h2>
            <p className="slider-hint">Przeciągnij produkty aby zmienić ich kolejność</p>
          </div>
          <button className="btn-secondary" onClick={closeProductEditor}>
            Powrót do listy szablonów
          </button>
        </div>

        <div className="product-editor">
          <div 
            className={`template-products-section ${isDropZoneActive ? 'drop-zone-active' : ''}`}
            onDragOver={handleDropZoneDragOver}
            onDrop={handleDropZoneDrop}
          >
            <h3>Produkty w sliderze ({templateProducts.length})</h3>
            {templateProducts.length === 0 ? (
              <div className="empty-products">
                <p>Brak produktów w szablonie. Dodaj produkty z listy obok.</p>
              </div>
            ) : (
              <div className="template-products-list">
                {templateProducts.map((tp, index) => (
                  <div
                    key={tp.id}
                    className={`template-product-item ${draggedItem === index ? 'dragging' : ''}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                  >
                    <div className="drag-handle">⋮⋮</div>
                    <img src={getProductImage(tp.product)} alt={tp.product.name} />
                    <div className="product-info">
                      <h4>{tp.product.name}</h4>
                      <p className="product-price">{tp.product.price.toFixed(2)} zł</p>
                    </div>
                    <button
                      className="btn-remove"
                      onClick={() => removeProductFromTemplate(tp.id)}
                      title="Usuń z szablonu"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="available-products-section">
            <h3>Dostępne produkty</h3>
            <div className="available-products-list">
              {availableProducts
                .filter(p => !templateProducts.some(tp => tp.product_id === p.id))
                .map(product => (
                  <div 
                    key={product.id} 
                    className="available-product-item"
                    draggable
                    onDragStart={(e) => handleAvailableProductDragStart(e, product)}
                    onDragEnd={handleAvailableProductDragEnd}
                  >
                    <div className="drag-handle">⋮⋮</div>
                    <img src={getProductImage(product)} alt={product.name} />
                    <div className="product-info">
                      <h4>{product.name}</h4>
                      <p className="product-price">{product.price.toFixed(2)} zł</p>
                    </div>
                    <button
                      className="btn-add"
                      onClick={() => addProductToTemplate(product)}
                      title="Dodaj do szablonu"
                    >
                      +
                    </button>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="slider-manager">
      <div className="slider-header">
        <div>
          <h2>Zarządzanie sliderem</h2>
          <p className="slider-hint">Twórz szablony slidera i zarządzaj produktami</p>
        </div>
        <button
          className="btn-primary"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? 'Anuluj' : 'Nowy szablon'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="slider-form">
          <div className="form-group">
            <label>Nazwa szablonu</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ name: e.target.value })}
              placeholder="np. Slider świąteczny, Slider promocyjny..."
              required
            />
          </div>

          <div className="form-actions">
            <button type="submit" className="btn-primary">
              {editingTemplate ? 'Zapisz zmiany' : 'Utwórz szablon'}
            </button>
            <button type="button" className="btn-secondary" onClick={resetForm}>
              Anuluj
            </button>
          </div>
        </form>
      )}

      <div className="templates-list">
        {templates.length === 0 ? (
          <div className="no-templates">
            <p>Brak szablonów slidera. Utwórz pierwszy szablon!</p>
          </div>
        ) : (
          templates.map(template => (
            <div key={template.id} className={`template-card ${template.is_active ? 'active' : ''}`}>
              <div className="template-card-header">
                <h3>{template.name}</h3>
                {template.is_active && <span className="active-badge">Aktywny</span>}
              </div>
              
              <div className="template-card-meta">
                <span>Utworzono: {new Date(template.created_at!).toLocaleDateString('pl-PL')}</span>
              </div>

              <div className="template-card-actions">
                <button
                  className="btn-edit"
                  onClick={() => startEditProducts(template)}
                >
                  Edytuj produkty
                </button>
                <button
                  className="btn-edit-name"
                  onClick={() => startEdit(template)}
                >
                  Zmień nazwę
                </button>
                {!template.is_active && (
                  <button
                    className="btn-activate"
                    onClick={() => handleSetActive(template.id)}
                  >
                    Ustaw jako aktywny
                  </button>
                )}
                <button
                  className="btn-delete"
                  onClick={() => handleDelete(template.id)}
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
