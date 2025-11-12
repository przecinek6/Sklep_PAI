import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import type { Product, Category } from '../../types/database.types';
import { generateImageVariants, getFileExtension } from '../../utils/imageOptimizer';
import './ProductManager.css';

interface ImageFile {
  file: File;
  preview: string;
  id: string;
  type: 'new';
}

interface ExistingImage {
  id: string;
  original_url: string;
  thumbnail_url?: string;
  display_order: number;
  type: 'existing';
  product_id: string;
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
    price: 0,
    stock_quantity: 0,
    category_id: null as string | null,
    is_active: true,
  });

  const [images, setImages] = useState<(ImageFile | ExistingImage)[]>([]);
  const [draggedImageIndex, setDraggedImageIndex] = useState<number | null>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);

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
      slug: generateSlug(name), // Zawsze generuj slug automatycznie
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
          type: 'new',
        });
      }
    });

    setImages(prev => [...prev, ...newImages]);
  };

  const removeImage = (id: string) => {
    setImages(prev => {
      const image = prev.find(img => img.id === id);
      if (image && image.type === 'new') {
        URL.revokeObjectURL(image.preview);
      }
      return prev.filter(img => img.id !== id);
    });
  };

  // Drag and drop dla zmiany kolejności zdjęć
  const handleImageDragStart = (index: number) => {
    setDraggedImageIndex(index);
  };

  const handleImageDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedImageIndex === null || draggedImageIndex === index) return;

    const newImages = [...images];
    const draggedImage = newImages[draggedImageIndex];
    newImages.splice(draggedImageIndex, 1);
    newImages.splice(index, 0, draggedImage);

    setImages(newImages);
    setDraggedImageIndex(index);
  };

  const handleImageDragEnd = () => {
    setDraggedImageIndex(null);
  };

  // Funkcje do edytora HTML
  const insertHtmlTag = (tagStart: string, tagEnd: string = '') => {
    const textarea = descriptionRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = formData.description.substring(start, end);
    const beforeText = formData.description.substring(0, start);
    const afterText = formData.description.substring(end);

    const newText = beforeText + tagStart + selectedText + tagEnd + afterText;
    setFormData({ ...formData, description: newText });

    // Ustaw kursor po wstawionym tagu
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + tagStart.length + selectedText.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
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
            price: formData.price,
            stock_quantity: formData.stock_quantity,
            category_id: formData.category_id,
            is_active: formData.is_active,
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
            price: formData.price,
            stock_quantity: formData.stock_quantity,
            category_id: formData.category_id,
            is_active: formData.is_active,
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
      // Najpierw usuń wszystkie istniejące zdjęcia z bazy (jeśli edytujemy)
      if (editingProduct) {
        const { error: deleteError } = await supabase
          .from('product_images')
          .delete()
          .eq('product_id', productId);
        
        if (deleteError) throw deleteError;
      }
      
      // Następnie zapisz wszystkie zdjęcia w nowej kolejności
      for (let i = 0; i < images.length; i++) {
        const image = images[i];
        
        if (image.type === 'new') {
          // Nowe zdjęcie - wygeneruj wszystkie warianty rozmiarów
          const variants = await generateImageVariants(image.file);
          const fileExt = getFileExtension(image.file.type);
          const baseFileName = `${productId}_${Date.now()}_${i}`;

          // Upload wszystkich wariantów do storage
          const urls: {
            original_url: string;
            large_url: string;
            medium_url: string;
            thumbnail_url: string;
          } = {
            original_url: '',
            large_url: '',
            medium_url: '',
            thumbnail_url: '',
          };

          // Upload original
          const originalPath = `products/${baseFileName}_original.${fileExt}`;
          const { error: uploadOriginalError } = await supabase.storage
            .from('product-images')
            .upload(originalPath, variants.original);
          if (uploadOriginalError) throw uploadOriginalError;

          const { data: { publicUrl: originalUrl } } = supabase.storage
            .from('product-images')
            .getPublicUrl(originalPath);
          urls.original_url = originalUrl;

          // Upload large
          const largePath = `products/${baseFileName}_large.${fileExt}`;
          const { error: uploadLargeError } = await supabase.storage
            .from('product-images')
            .upload(largePath, variants.large);
          if (uploadLargeError) throw uploadLargeError;

          const { data: { publicUrl: largeUrl } } = supabase.storage
            .from('product-images')
            .getPublicUrl(largePath);
          urls.large_url = largeUrl;

          // Upload medium
          const mediumPath = `products/${baseFileName}_medium.${fileExt}`;
          const { error: uploadMediumError } = await supabase.storage
            .from('product-images')
            .upload(mediumPath, variants.medium);
          if (uploadMediumError) throw uploadMediumError;

          const { data: { publicUrl: mediumUrl } } = supabase.storage
            .from('product-images')
            .getPublicUrl(mediumPath);
          urls.medium_url = mediumUrl;

          // Upload thumbnail
          const thumbnailPath = `products/${baseFileName}_thumbnail.${fileExt}`;
          const { error: uploadThumbnailError } = await supabase.storage
            .from('product-images')
            .upload(thumbnailPath, variants.thumbnail);
          if (uploadThumbnailError) throw uploadThumbnailError;

          const { data: { publicUrl: thumbnailUrl } } = supabase.storage
            .from('product-images')
            .getPublicUrl(thumbnailPath);
          urls.thumbnail_url = thumbnailUrl;

          // Zapisz wszystkie URL-e do bazy danych
          const { error: dbError } = await supabase
            .from('product_images')
            .insert([{
              product_id: productId,
              original_url: urls.original_url,
              large_url: urls.large_url,
              medium_url: urls.medium_url,
              thumbnail_url: urls.thumbnail_url,
              display_order: i,
            }]);

          if (dbError) throw dbError;
        } else {
          // Istniejące zdjęcie - tylko aktualizuj display_order
          const { error: updateError } = await supabase
            .from('product_images')
            .insert([{
              product_id: productId,
              original_url: image.original_url,
              thumbnail_url: image.thumbnail_url,
              display_order: i,
            }]);

          if (updateError) throw updateError;
        }
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

  const startEdit = async (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      slug: product.slug,
      description: product.description || '',
      price: product.price,
      stock_quantity: product.stock_quantity,
      category_id: product.category_id || null,
      is_active: product.is_active,
    });
    
    // Pobierz istniejące zdjęcia produktu
    try {
      const { data: existingImages, error } = await supabase
        .from('product_images')
        .select('*')
        .eq('product_id', product.id)
        .order('display_order');
      
      if (error) throw error;
      
      if (existingImages) {
        const mappedImages: ExistingImage[] = existingImages.map(img => ({
          id: img.id,
          original_url: img.original_url,
          thumbnail_url: img.thumbnail_url,
          display_order: img.display_order,
          type: 'existing',
          product_id: img.product_id,
        }));
        setImages(mappedImages);
      }
    } catch (error) {
      console.error('Error loading product images:', error);
    }
    
    setShowForm(true);
  };

  const resetForm = () => {
    setEditingProduct(null);
    setFormData({
      name: '',
      slug: '',
      description: '',
      price: 0,
      stock_quantity: 0,
      category_id: null,
      is_active: true,
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
            
            <div className="form-group">
              <label>Nazwa produktu *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleNameChange(e.target.value)}
                required
              />
              {formData.name && (
                <small style={{ color: 'var(--text-secondary)', marginTop: '4px', display: 'block' }}>
                  URL: {formData.slug || 'będzie wygenerowany automatycznie'}
                </small>
              )}
            </div>

            <div className="form-group">
              <label>Opis</label>
              <div className="html-editor">
                <div className="editor-toolbar">
                  <button 
                    type="button" 
                    className="editor-btn" 
                    onClick={() => insertHtmlTag('<b>', '</b>')}
                    title="Pogrubienie"
                  >
                    <strong>B</strong>
                  </button>
                  <button 
                    type="button" 
                    className="editor-btn" 
                    onClick={() => insertHtmlTag('<i>', '</i>')}
                    title="Kursywa"
                  >
                    <em>I</em>
                  </button>
                  <button 
                    type="button" 
                    className="editor-btn" 
                    onClick={() => insertHtmlTag('<u>', '</u>')}
                    title="Podkreślenie"
                  >
                    <u>U</u>
                  </button>
                  <button 
                    type="button" 
                    className="editor-btn" 
                    onClick={() => insertHtmlTag('<h2>', '</h2>')}
                    title="Nagłówek 2"
                  >
                    H2
                  </button>
                  <button 
                    type="button" 
                    className="editor-btn" 
                    onClick={() => insertHtmlTag('<h3>', '</h3>')}
                    title="Nagłówek 3"
                  >
                    H3
                  </button>
                  <button 
                    type="button" 
                    className="editor-btn" 
                    onClick={() => insertHtmlTag('<p>', '</p>')}
                    title="Paragraf"
                  >
                    P
                  </button>
                  <button 
                    type="button" 
                    className="editor-btn" 
                    onClick={() => insertHtmlTag('<br/>')}
                    title="Nowa linia"
                  >
                    BR
                  </button>
                  <button 
                    type="button" 
                    className="editor-btn" 
                    onClick={() => insertHtmlTag('<ul>\n  <li>', '</li>\n</ul>')}
                    title="Lista punktowana"
                  >
                    UL
                  </button>
                  <button 
                    type="button" 
                    className="editor-btn" 
                    onClick={() => insertHtmlTag('<ol>\n  <li>', '</li>\n</ol>')}
                    title="Lista numerowana"
                  >
                    OL
                  </button>
                  <button 
                    type="button" 
                    className="editor-btn" 
                    onClick={() => insertHtmlTag('<a href="">', '</a>')}
                    title="Link"
                  >
                    A
                  </button>
                </div>
                <textarea
                  ref={descriptionRef}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Szczegółowy opis produktu z obsługą HTML"
                  rows={8}
                  className="html-textarea"
                />
              </div>
            </div>
          </div>

          <div className="form-section">
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
                <label>Ilość *</label>
                <input
                  type="number"
                  min="0"
                  value={formData.stock_quantity}
                  onChange={(e) => setFormData({ ...formData, stock_quantity: parseInt(e.target.value) || 0 })}
                  required
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h3>Kategoria </h3>
            
            <div className="form-row">
              <div className="form-group">
                <select
                  value={formData.category_id || ''}
                  onChange={(e) => setFormData({ ...formData, category_id: e.target.value || null })}
                >
                  <option value="">Brak kategorii</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
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
                {images.map((image, index) => (
                  <div 
                    key={image.id} 
                    className={`image-preview-item ${draggedImageIndex === index ? 'dragging' : ''}`}
                    draggable
                    onDragStart={() => handleImageDragStart(index)}
                    onDragOver={(e) => handleImageDragOver(e, index)}
                    onDragEnd={handleImageDragEnd}
                  >
                    <div className="drag-handle">⋮⋮</div>
                    <img 
                      src={image.type === 'new' ? image.preview : (image.thumbnail_url || image.original_url)} 
                      alt="Preview" 
                    />
                    <button
                      type="button"
                      className="remove-image"
                      onClick={() => removeImage(image.id)}
                    >
                      X
                    </button>
                    <span className="image-order">{index + 1}</span>
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
                  {!product.is_active && <span className="inactive-badge">Nieaktywny</span>}
                </div>
                
                <div className="product-details-card">
                  <div className="product-price">
                    {formatPrice(product.price)}
                  </div>
                  <div className="product-stock">
                    Stan: <strong>{product.stock_quantity}</strong> szt.
                  </div>
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
