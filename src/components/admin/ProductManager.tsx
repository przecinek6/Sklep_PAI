import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import type { Product, Category } from '../../types/database.types';
import './ProductManager.css';

interface ImageFile {
  file: File;
  preview: string;
  id: string;
}

export const ProductManager = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    short_description: '',
    price: 0,
    compare_at_price: 0,
    stock_quantity: 0,
    sku: '',
    category_id: null as string | null,
    is_active: true,
    is_featured: false,
  });

  const [images, setImages] = useState<ImageFile[]>([]);

  useEffect(() => {
    loadProducts();
    loadCategories();
  }, []);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error loading products:', error);
      alert('Błąd ładowania produktów');
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
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
      slug: editingProduct ? formData.slug : generateSlug(name),
    });
  };

  // Obsługa drag & drop
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  };

  const handleFiles = (fileList: FileList) => {
    const newImages: ImageFile[] = [];
    
    Array.from(fileList).forEach(file => {
      if (file.type.startsWith('image/')) {
        const preview = URL.createObjectURL(file);
        newImages.push({
          file,
          preview,
          id: Math.random().toString(36).substr(2, 9),
        });
      }
    });

    setImages(prev => [...prev, ...newImages]);
  };

  const removeImage = (id: string) => {
    setImages(prev => {
      const image = prev.find(img => img.id === id);
      if (image) {
        URL.revokeObjectURL(image.preview);
      }
      return prev.filter(img => img.id !== id);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      let productId: string;

      if (editingProduct) {
        // Aktualizacja
        const { error } = await supabase
          .from('products')
          .update({
            name: formData.name,
            slug: formData.slug,
            description: formData.description || null,
            short_description: formData.short_description || null,
            price: formData.price,
            compare_at_price: formData.compare_at_price || null,
            stock_quantity: formData.stock_quantity,
            sku: formData.sku || null,
            category_id: formData.category_id,
            is_active: formData.is_active,
            is_featured: formData.is_featured,
          })
          .eq('id', editingProduct.id);

        if (error) throw error;
        productId = editingProduct.id;
      } else {
        // Tworzenie
        const { data, error } = await supabase
          .from('products')
          .insert([{
            name: formData.name,
            slug: formData.slug,
            description: formData.description || null,
            short_description: formData.short_description || null,
            price: formData.price,
            compare_at_price: formData.compare_at_price || null,
            stock_quantity: formData.stock_quantity,
            sku: formData.sku || null,
            category_id: formData.category_id,
            is_active: formData.is_active,
            is_featured: formData.is_featured,
          }])
          .select()
          .single();

        if (error) throw error;
        productId = data.id;
      }

      // Upload zdjęć jeśli są
      if (images.length > 0) {
        await uploadImages(productId);
      }

      resetForm();
      loadProducts();
    } catch (error: any) {
      console.error('Error saving product:', error);
      alert(error.message || 'Błąd zapisywania produktu');
    }
  };

  const uploadImages = async (productId: string) => {
    setUploadingImages(true);
    
    try {
      for (let i = 0; i < images.length; i++) {
        const image = images[i];
        const fileExt = image.file.name.split('.').pop();
        const fileName = `${productId}_${Date.now()}_${i}.${fileExt}`;
        const filePath = `products/${fileName}`;

        // Upload do Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(filePath, image.file);

        if (uploadError) throw uploadError;

        // Pobierz publiczny URL
        const { data: { publicUrl } } = supabase.storage
          .from('product-images')
          .getPublicUrl(filePath);

        // Zapisz do bazy
        const { error: dbError } = await supabase
          .from('product_images')
          .insert([{
            product_id: productId,
            original_url: publicUrl,
            display_order: i,
            alt_text: formData.name,
          }]);

        if (dbError) throw dbError;
      }
    } catch (error) {
      console.error('Error uploading images:', error);
      throw error;
    } finally {
      setUploadingImages(false);
    }
  };

  const handleDelete = async (productId: string) => {
    if (!confirm('Czy na pewno chcesz usunąć ten produkt?')) return;

    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId);

      if (error) throw error;
      loadProducts();
    } catch (error) {
      console.error('Error deleting product:', error);
      alert('Błąd usuwania produktu');
    }
  };

  const startEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      slug: product.slug,
      description: product.description || '',
      short_description: product.short_description || '',
      price: product.price,
      compare_at_price: product.compare_at_price || 0,
      stock_quantity: product.stock_quantity,
      sku: product.sku || '',
      category_id: product.category_id || null,
      is_active: product.is_active,
      is_featured: product.is_featured,
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setEditingProduct(null);
    setFormData({
      name: '',
      slug: '',
      description: '',
      short_description: '',
      price: 0,
      compare_at_price: 0,
      stock_quantity: 0,
      sku: '',
      category_id: null,
      is_active: true,
      is_featured: false,
    });
    setImages([]);
    setShowForm(false);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN',
    }).format(price);
  };

  if (loading) {
    return <div className="product-loading">Ładowanie produktów...</div>;
  }

  return (
    <div className="product-manager">
      <div className="product-header">
        <h2>Zarządzanie produktami</h2>
        <button
          className="btn-primary"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? 'Anuluj' : 'Dodaj produkt'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="product-form">
          <div className="form-section">
            <h3>Podstawowe informacje</h3>
            
            <div className="form-row">
              <div className="form-group">
                <label>Nazwa produktu *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="np. iPhone 15 Pro"
                  required
                />
              </div>

              <div className="form-group">
                <label>Slug (URL) *</label>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  placeholder="iphone-15-pro"
                  pattern="^[a-z0-9-]+$"
                  required
                />
                <small>Tylko małe litery, cyfry i myślniki</small>
              </div>
            </div>

            <div className="form-group">
              <label>Krótki opis</label>
              <input
                type="text"
                value={formData.short_description}
                onChange={(e) => setFormData({ ...formData, short_description: e.target.value })}
                placeholder="Krótki opis wyświetlany na liście produktów"
                maxLength={500}
              />
            </div>

            <div className="form-group">
              <label>Pełny opis</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Szczegółowy opis produktu"
                rows={5}
              />
            </div>
          </div>

          <div className="form-section">
            <h3>Cena i magazyn</h3>
            
            <div className="form-row">
              <div className="form-group">
                <label>Cena *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                  required
                />
              </div>

              <div className="form-group">
                <label>Cena przed rabatem</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.compare_at_price}
                  onChange={(e) => setFormData({ ...formData, compare_at_price: parseFloat(e.target.value) || 0 })}
                />
              </div>

              <div className="form-group">
                <label>Stan magazynowy *</label>
                <input
                  type="number"
                  min="0"
                  value={formData.stock_quantity}
                  onChange={(e) => setFormData({ ...formData, stock_quantity: parseInt(e.target.value) || 0 })}
                  required
                />
              </div>

              <div className="form-group">
                <label>SKU</label>
                <input
                  type="text"
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  placeholder="Kod produktu"
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h3>Kategoria i status</h3>
            
            <div className="form-row">
              <div className="form-group">
                <label>Kategoria</label>
                <select
                  value={formData.category_id || ''}
                  onChange={(e) => setFormData({ ...formData, category_id: e.target.value || null })}
                >
                  <option value="">Brak kategorii</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.icon} {cat.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  />
                  <span>Aktywny (widoczny w sklepie)</span>
                </label>
              </div>

              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.is_featured}
                    onChange={(e) => setFormData({ ...formData, is_featured: e.target.checked })}
                  />
                  <span>Wyróżniony (promowany)</span>
                </label>
              </div>
            </div>
          </div>

          <div className="form-section">
            <h3>Zdjęcia produktu</h3>
            
            <div
              className={`dropzone ${dragActive ? 'drag-active' : ''}`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileInput}
                style={{ display: 'none' }}
              />
              <div className="dropzone-content">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M17 8L12 3L7 8"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M12 3V15"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <p><strong>Kliknij lub przeciągnij zdjęcia</strong></p>
                <p className="dropzone-hint">PNG, JPG, WEBP do 10MB</p>
              </div>
            </div>

            {images.length > 0 && (
              <div className="images-preview">
                {images.map(image => (
                  <div key={image.id} className="image-preview-item">
                    <img src={image.preview} alt="Preview" />
                    <button
                      type="button"
                      className="remove-image"
                      onClick={() => removeImage(image.id)}
                    >
                      Usuń
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={uploadingImages}>
              {uploadingImages ? 'Przesyłanie...' : editingProduct ? 'Zapisz zmiany' : 'Utwórz produkt'}
            </button>
            <button type="button" className="btn-secondary" onClick={resetForm}>
              Anuluj
            </button>
          </div>
        </form>
      )}

      <div className="products-list">
        {products.length === 0 ? (
          <p className="empty-state">Brak produktów. Dodaj pierwszy produkt!</p>
        ) : (
          <div className="products-grid">
            {products.map(product => (
              <div key={product.id} className="product-card">
                <div className="product-header-card">
                  <h3>{product.name}</h3>
                  {product.is_featured && <span className="featured-badge">Wyróżniony</span>}
                  {!product.is_active && <span className="inactive-badge">Nieaktywny</span>}
                </div>
                
                <div className="product-details-card">
                  <div className="product-price">
                    {formatPrice(product.price)}
                    {product.compare_at_price && product.compare_at_price > product.price && (
                      <span className="old-price">{formatPrice(product.compare_at_price)}</span>
                    )}
                  </div>
                  <div className="product-stock">
                    Stan: <strong>{product.stock_quantity}</strong> szt.
                  </div>
                  {product.sku && (
                    <div className="product-sku">SKU: {product.sku}</div>
                  )}
                </div>

                <div className="product-actions-card">
                  <button className="btn-small" onClick={() => startEdit(product)}>
                    Edytuj
                  </button>
                  <button className="btn-small btn-danger" onClick={() => handleDelete(product.id)}>
                    Usuń
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
