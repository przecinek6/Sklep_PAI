import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import './FeaturedSlider.css';

interface Product {
  id: string;
  name: string;
  price: number;
  image_url?: string;
}

interface FeaturedSliderProps {
  products: Product[];
}

export const FeaturedSlider = ({ products }: FeaturedSliderProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [visibleCount, setVisibleCount] = useState(5);

  // Update visible count based on screen width
  useEffect(() => {
    const updateVisibleCount = () => {
      const width = window.innerWidth;
      if (width < 480) setVisibleCount(1);
      else if (width < 768) setVisibleCount(2);
      else if (width < 1024) setVisibleCount(3);
      else if (width < 1280) setVisibleCount(4);
      else setVisibleCount(5);
    };

    updateVisibleCount();
    window.addEventListener('resize', updateVisibleCount);
    return () => window.removeEventListener('resize', updateVisibleCount);
  }, []);

  const maxIndex = Math.max(0, products.length - visibleCount);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev >= maxIndex ? 0 : prev + 1));
  }, [maxIndex]);

  const goToPrev = () => {
    setCurrentIndex((prev) => (prev <= 0 ? maxIndex : prev - 1));
  };

  // Auto-slide every 10 seconds
  useEffect(() => {
    const timer = setInterval(goToNext, 10000);
    return () => clearInterval(timer);
  }, [goToNext]);

  if (products.length === 0) {
    return (
      <section className="featured-slider">
        <div className="featured-container">
          <h2 className="featured-title">Wyróżnione produkty</h2>
          <p className="featured-empty">Brak wyróżnionych produktów</p>
        </div>
      </section>
    );
  }

  return (
    <section className="featured-slider">
      <div className="featured-container">
        <h2 className="featured-title">Wyróżnione produkty</h2>
        
        <div className="slider-wrapper">
          <button
            className="slider-btn slider-btn-prev"
            onClick={goToPrev}
            disabled={products.length <= visibleCount}
            aria-label="Poprzedni produkt"
          >
            <ChevronLeft size={24} />
          </button>

          <div className="slider-track">
            <div
              className="slider-content"
              style={{
                transform: `translateX(calc(-${currentIndex} * ((100% - ${(visibleCount - 1) * 16}px) / ${visibleCount} + 16px)))`,
              }}
            >
              {products.map((product) => (
                <div key={product.id} className="product-card">
                  <div className="product-image">
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} />
                    ) : (
                      <div className="product-image-placeholder">
                        Brak zdjęcia
                      </div>
                    )}
                  </div>
                  <div className="product-info">
                    <h3 className="product-name">{product.name}</h3>
                    <p className="product-price">{product.price.toFixed(2)} zł</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            className="slider-btn slider-btn-next"
            onClick={goToNext}
            disabled={products.length <= visibleCount}
            aria-label="Następny produkt"
          >
            <ChevronRight size={24} />
          </button>
        </div>

        {/* Indicators */}
        {products.length > visibleCount && (
          <div className="slider-indicators">
            {Array.from({ length: maxIndex + 1 }).map((_, index) => (
              <button
                key={index}
                className={`indicator ${index === currentIndex ? 'active' : ''}`}
                onClick={() => setCurrentIndex(index)}
                aria-label={`Przejdź do slajdu ${index + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
