import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Navbar } from '../components/Navbar';
import { Pagination } from '../components/Pagination';
import type { Product } from '../types/database.types';
import './SearchPage.css';

interface ProductWithImage extends Product {
  image_url?: string;
}

export const SearchPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  
  const [products, setProducts] = useState<ProductWithImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);
  const productsPerPage = 12;

  useEffect(() => {
    if (query.trim()) {
      searchProducts(1);
    } else {
      setProducts([]);
      setTotalProducts(0);
    }
  }, [query]);

  const searchProducts = async (page: number) => {
    if (!query.trim()) return;

    setLoading(true);
    try {
      const from = (page - 1) * productsPerPage;
      const to = from + productsPerPage - 1;

      // Wyszukiwanie w nazwie i opisie produktu
      const { data, count, error } = await supabase
        .from('products')
        .select(`
          *,
          product_images (
            original_url,
            thumbnail_url,
            display_order
          )
        `, { count: 'exact' })
        .eq('is_active', true)
        .or(`name.ilike.%${query}%,description.ilike.%${query}%`)
        .range(from, to)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (count !== null) {
        setTotalProducts(count);
      }

      if (data) {
        const mappedProducts = data.map(product => ({
          ...product,
          image_url: product.product_images?.[0]?.thumbnail_url || product.product_images?.[0]?.original_url
        }));
        setProducts(mappedProducts);
      }
    } catch (error) {
      console.error('Error searching products:', error);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const loadPage = async (page: number) => {
    setCurrentPage(page);
    await searchProducts(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="search-page">
      <Navbar />

      <main className="search-main">
        <div className="search-container">
          <div className="search-header">
            <h1 className="search-title">
              {query ? (
                <>
                  Wyniki wyszukiwania dla: <span className="search-query">"{query}"</span>
                </>
              ) : (
                'Wyszukiwanie'
              )}
            </h1>
            {!loading && query && (
              <p className="search-results-count">
                {totalProducts === 0 
                  ? 'Nie znaleziono produktów'
                  : totalProducts === 1
                  ? 'Znaleziono 1 produkt'
                  : `Znaleziono ${totalProducts} produktów`
                }
              </p>
            )}
          </div>

          {loading ? (
            <div className="search-loading">
              <div className="spinner"></div>
              <p>Wyszukiwanie...</p>
            </div>
          ) : !query ? (
            <div className="search-empty">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="11" cy="11" r="8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="m21 21-4.35-4.35" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <h2>Wpisz frazę do wyszukania</h2>
              <p>Użyj paska wyszukiwania powyżej, aby znaleźć produkty</p>
            </div>
          ) : products.length === 0 ? (
            <div className="search-no-results">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="11" cy="11" r="8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="m21 21-4.35-4.35" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <line x1="8" y1="11" x2="14" y2="11" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <h2>Brak wyników</h2>
              <p>Nie znaleziono produktów dla frazy <strong>"{query}"</strong></p>
              <button className="btn-back-shop" onClick={() => navigate('/')}>
                Wróć do sklepu
              </button>
            </div>
          ) : (
            <>
              <div className="products-grid">
                {products.map((product) => (
                  <div 
                    key={product.id} 
                    className="product-card"
                    onClick={() => navigate(`/product/${product.slug}`)}
                  >
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
                      <p className="product-description">{product.description}</p>
                      <div className="product-footer">
                        <span className="product-price">{product.price.toFixed(2)} zł</span>
                        <button 
                          className="btn-add-to-cart"
                          onClick={(e) => {
                            e.stopPropagation();
                            alert('Dodano do koszyka');
                          }}
                        >
                          Dodaj do koszyka
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {totalProducts > productsPerPage && (
                <Pagination
                  currentPage={currentPage}
                  totalPages={Math.ceil(totalProducts / productsPerPage)}
                  onPageChange={loadPage}
                  itemsPerPage={productsPerPage}
                  totalItems={totalProducts}
                />
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
};
