import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Navbar } from '../components/Navbar';
import { ProductReviews } from '../components/ProductReviews';
import { ProductQuestions } from '../components/ProductQuestions';
import { ProductReportModal } from '../components/ProductReportModal';
import { Flag } from 'lucide-react';
import type { Product, ProductImage, UserProfile } from '../types/database.types';
import './ProductPage.css';

interface ProductWithImages extends Product {
  product_images: ProductImage[];
  category?: {
    id: string;
    name: string;
  };
}

export const ProductPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<ProductWithImages | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<ProductImage | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImageIndex, setLightboxImageIndex] = useState(0);
  const [showReportModal, setShowReportModal] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    loadCurrentUser();
  }, []);

  useEffect(() => {
    if (slug) {
      loadProduct();
    }
  }, [slug]);

  const loadCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        
        setCurrentUser(profile);
      }
    } catch (error) {
      console.error('Error loading user:', error);
    }
  };

  useEffect(() => {
    if (slug) {
      loadProduct();
    }
  }, [slug]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!lightboxOpen) return;

      if (e.key === 'Escape') {
        closeLightbox();
      } else if (e.key === 'ArrowLeft') {
        prevImage();
      } else if (e.key === 'ArrowRight') {
        nextImage();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxOpen, lightboxImageIndex]);

  useEffect(() => {
    if (lightboxOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [lightboxOpen]);

  const loadProduct = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          product_images (*),
          category:categories (
            id,
            name
          )
        `)
        .eq('slug', slug)
        .eq('is_active', true)
        .single();

      if (error) throw error;

      if (data) {
        setProduct(data as ProductWithImages);
        
        // Ustaw pierwsze zdjęcie jako wybrane
        if (data.product_images && data.product_images.length > 0) {
          const sortedImages = [...data.product_images].sort((a, b) => a.display_order - b.display_order);
          setSelectedImage(sortedImages[0]);
        }
      }
    } catch (error) {
      console.error('Error loading product:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleQuantityChange = (value: number) => {
    const newQuantity = Math.max(1, Math.min(value, product?.stock_quantity || 1));
    setQuantity(newQuantity);
  };

  const handleAddToCart = () => {
    // TODO: Implementacja koszyka
    alert(`Dodano ${quantity} szt. do koszyka`);
  };

  const openLightbox = (index: number) => {
    setLightboxImageIndex(index);
    setLightboxOpen(true);
  };

  const closeLightbox = () => {
    setLightboxOpen(false);
  };

  const nextImage = () => {
    if (!product?.product_images) return;
    setLightboxImageIndex((prev) => 
      prev === product.product_images.length - 1 ? 0 : prev + 1
    );
  };

  const prevImage = () => {
    if (!product?.product_images) return;
    setLightboxImageIndex((prev) => 
      prev === 0 ? product.product_images.length - 1 : prev - 1
    );
  };

  if (loading) {
    return (
      <div className="product-page">
        <Navbar />
        <div className="product-loading">
          <div className="product-spinner"></div>
          <p>Ładowanie produktu...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="product-page">
        <Navbar />
        <div className="product-not-found">
          <h1>Produkt nie znaleziony</h1>
          <p>Przepraszamy, nie możemy znaleźć tego produktu.</p>
          <button className="btn-back" onClick={() => navigate('/')}>
            Wróć do sklepu
          </button>
        </div>
      </div>
    );
  }

  const sortedImages = product.product_images
    ? [...product.product_images].sort((a, b) => a.display_order - b.display_order)
    : [];

  return (
    <div className="product-page">
      <Navbar />

      <div className="product-container">
        {/* Breadcrumbs */}
        <nav className="breadcrumbs">
          <button onClick={() => navigate('/')} className="breadcrumb-link">
            Sklep
          </button>
          {product.category && (
            <>
              <span className="breadcrumb-separator">/</span>
              <span className="breadcrumb-current">{product.category.name}</span>
            </>
          )}
          <span className="breadcrumb-separator">/</span>
          <span className="breadcrumb-current">{product.name}</span>
        </nav>

        {/* Main Product Section */}
        <div className="product-main">
          {/* Left Column - Images */}
          <div className="product-gallery">
            <div className="main-image" onClick={() => openLightbox(sortedImages.findIndex(img => img.id === selectedImage?.id))}>
              {selectedImage ? (
                <img
                  src={selectedImage.large_url || selectedImage.original_url}
                  alt={product.name}
                  style={{ cursor: 'pointer' }}
                />
              ) : (
                <div className="no-image">Brak zdjęcia</div>
              )}
            </div>

            {sortedImages.length > 1 && (
              <div className="thumbnail-gallery">
                {sortedImages.map((img) => (
                  <div
                    key={img.id}
                    className={`thumbnail ${selectedImage?.id === img.id ? 'active' : ''}`}
                    onClick={() => setSelectedImage(img)}
                  >
                    <img
                      src={img.thumbnail_url || img.original_url}
                      alt={product.name}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Column - Product Info */}
          <div className="product-info">
            <h1 className="product-title">{product.name}</h1>

            {/* Price Section */}
            <div className="product-price-section">
              <div className="price-wrapper">
                <div className="current-price">{product.price.toFixed(2)} zł</div>
              </div>
            </div>

            {/* Stock Status */}
            <div className="stock-status">
              {product.stock_quantity > 0 ? (
                <>
                  <span className="status-icon in-stock">✓</span>
                  <span className="status-text">
                    Dostępne: <strong>{product.stock_quantity} szt.</strong>
                  </span>
                </>
              ) : (
                <>
                  <span className="status-icon out-of-stock">✕</span>
                  <span className="status-text">Brak w magazynie</span>
                </>
              )}
            </div>

            {/* Quantity & Add to Cart */}
            <div className="purchase-section">
              <div className="quantity-selector">
                <label>Ilość:</label>
                <div className="quantity-controls">
                  <button
                    className="qty-btn"
                    onClick={() => handleQuantityChange(quantity - 1)}
                    disabled={quantity <= 1}
                  >
                    −
                  </button>
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => handleQuantityChange(parseInt(e.target.value) || 1)}
                    min="1"
                    max={product.stock_quantity}
                  />
                  <button
                    className="qty-btn"
                    onClick={() => handleQuantityChange(quantity + 1)}
                    disabled={quantity >= product.stock_quantity}
                  >
                    +
                  </button>
                </div>
              </div>

              <button
                className="btn-add-to-cart-product"
                onClick={handleAddToCart}
                disabled={product.stock_quantity === 0}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M9 2L7.17 4H4a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-3.17L15 2H9z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="12" cy="13" r="3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Dodaj do koszyka
              </button>
            </div>

            {/* Report Product Button */}
            {currentUser && (
              <button
                className="btn-report-product"
                onClick={() => setShowReportModal(true)}
                title="Zgłoś problem z produktem"
              >
                <Flag size={18} />
                Zgłoś problem
              </button>
            )}
          </div>
        </div>

        {/* Product Description */}
        {product.description && (
          <div className="product-description-section">
            <h2>Opis produktu</h2>
            <div 
              className="description-content"
              dangerouslySetInnerHTML={{ __html: product.description }}
            />
          </div>
        )}

        {/* Reviews & Questions */}
        <ProductReviews 
          productId={product.id}
          currentUserId={currentUser?.id}
        />

        <ProductQuestions 
          productId={product.id}
          currentUserId={currentUser?.id}
          userRole={currentUser?.role}
        />
      </div>

      {/* Report Modal */}
      {showReportModal && currentUser && (
        <ProductReportModal
          productId={product.id}
          productName={product.name}
          currentUserId={currentUser.id}
          onClose={() => setShowReportModal(false)}
        />
      )}

      {/* Lightbox */}
      {lightboxOpen && sortedImages.length > 0 && (
        <div className="lightbox-overlay" onClick={closeLightbox}>
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <button className="lightbox-close" onClick={closeLightbox}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M18 6L6 18M6 6l12 12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            {sortedImages.length > 1 && (
              <>
                <button className="lightbox-nav lightbox-prev" onClick={prevImage}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M15 18l-6-6 6-6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                <button className="lightbox-nav lightbox-next" onClick={nextImage}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M9 18l6-6-6-6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </>
            )}

            <img
              src={sortedImages[lightboxImageIndex]?.original_url}
              alt={product.name}
              className="lightbox-image"
            />

            <div className="lightbox-counter">
              {lightboxImageIndex + 1} / {sortedImages.length}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
