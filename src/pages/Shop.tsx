import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Navbar } from '../components/Navbar';
import { FeaturedSlider } from '../components/FeaturedSlider';
import { Pagination } from '../components/Pagination';
import { useCart } from '../hooks/useCart';
import './Shop.css';

interface Category {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  children?: Category[];
}

interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  image_url?: string;
  category_id: string;
}

export const Shop = () => {
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const shopMainRef = useRef<HTMLElement>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [sliderName, setSliderName] = useState<string>('Wyróżnione produkty');
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);
  const productsPerPage = 12;

  // Funkcja pomocnicza do znalezienia kategorii rekurencyjnie
  const findCategoryById = (categoryId: string, categoryList: Category[]): Category | null => {
    for (const category of categoryList) {
      if (category.id === categoryId) {
        return category;
      }
      if (category.children) {
        const found = findCategoryById(categoryId, category.children);
        if (found) return found;
      }
    }
    return null;
  };

  // Funkcja rekurencyjnie zbierająca wszystkie ID kategorii i jej podkategorii
  const getAllCategoryIds = (category: Category): string[] => {
    const ids = [category.id];
    if (category.children && category.children.length > 0) {
      category.children.forEach(child => {
        ids.push(...getAllCategoryIds(child));
      });
    }
    return ids;
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load categories
      const { data: categoriesData } = await supabase
        .from('categories')
        .select('*')
        .order('name');

      if (categoriesData) {
        // Build category tree
        const categoryMap = new Map<string, Category>();
        const rootCategories: Category[] = [];

        categoriesData.forEach((cat) => {
          categoryMap.set(cat.id, { ...cat, children: [] });
        });

        categoriesData.forEach((cat) => {
          const category = categoryMap.get(cat.id)!;
          if (cat.parent_id) {
            const parent = categoryMap.get(cat.parent_id);
            if (parent) {
              parent.children!.push(category);
            }
          } else {
            rootCategories.push(category);
          }
        });

        setCategories(rootCategories);
      }

      // Load featured products from active slider template
      const { data: activeTemplate } = await supabase
        .from('slider_templates')
        .select('id, name')
        .eq('is_active', true)
        .single();

      if (activeTemplate) {
        setSliderName(activeTemplate.name);
        
        const { data: sliderProducts } = await supabase
          .from('slider_template_products')
          .select(`
            display_order,
            product:products(
              *,
              product_images(
                original_url,
                medium_url,
                thumbnail_url,
                display_order
              )
            )
          `)
          .eq('template_id', activeTemplate.id)
          .order('display_order', { ascending: true });

        if (sliderProducts) {
          const mappedFeatured = sliderProducts.map((sp: any) => ({
            ...sp.product,
            image_url: sp.product.product_images?.[0]?.medium_url || sp.product.product_images?.[0]?.thumbnail_url || sp.product.product_images?.[0]?.original_url
          }));
          setFeaturedProducts(mappedFeatured);
        }
      }

      // Load all products for shop display
      const { data: allProducts, count } = await supabase
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
        .range(0, productsPerPage - 1);

      if (count !== null) {
        setTotalProducts(count);
      }

      if (allProducts && allProducts.length > 0) {
        // Map products with images
        const mappedProducts = allProducts.map(product => ({
          ...product,
          image_url: product.product_images?.[0]?.thumbnail_url || product.product_images?.[0]?.original_url
        }));

        setProducts(mappedProducts);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryClick = async (categoryId: string | null) => {
    setSelectedCategory(categoryId);
    setCurrentPage(1); // Reset to first page when changing category
    
    if (!categoryId) {
      // Load all products
      const { data, count } = await supabase
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
        .range(0, productsPerPage - 1);
      
      if (count !== null) {
        setTotalProducts(count);
      }
      
      const mappedProducts = data?.map(product => ({
        ...product,
        image_url: product.product_images?.[0]?.thumbnail_url || product.product_images?.[0]?.original_url
      })) || [];
      
      setProducts(mappedProducts);
    } else {
      // Znajdź wybraną kategorię
      const selectedCategoryData = findCategoryById(categoryId, categories);
      
      if (selectedCategoryData) {
        // Zbierz ID wybranej kategorii i wszystkich jej podkategorii
        const categoryIds = getAllCategoryIds(selectedCategoryData);
        
        // Load products for selected category and all its subcategories
        const { data, count } = await supabase
          .from('products')
          .select(`
            *,
            product_images (
              original_url,
              thumbnail_url,
              display_order
            )
          `, { count: 'exact' })
          .in('category_id', categoryIds)
          .eq('is_active', true)
          .range(0, productsPerPage - 1);
        
        if (count !== null) {
          setTotalProducts(count);
        }
        
        const mappedProducts = data?.map(product => ({
          ...product,
          image_url: product.product_images?.[0]?.thumbnail_url || product.product_images?.[0]?.original_url
        })) || [];
        
        setProducts(mappedProducts);
      }
    }
  };

  const loadPage = async (page: number) => {
    const from = (page - 1) * productsPerPage;
    const to = from + productsPerPage - 1;

    // Scroll to top of shop-main section
    if (shopMainRef.current) {
      const navbarHeight = 60; // Wysokość navbara
      const elementPosition = shopMainRef.current.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - navbarHeight;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }

    if (!selectedCategory) {
      // Load all products
      const { data } = await supabase
        .from('products')
        .select(`
          *,
          product_images (
            original_url,
            thumbnail_url,
            display_order
          )
        `)
        .eq('is_active', true)
        .range(from, to);
      
      const mappedProducts = data?.map(product => ({
        ...product,
        image_url: product.product_images?.[0]?.thumbnail_url || product.product_images?.[0]?.original_url
      })) || [];
      
      setProducts(mappedProducts);
    } else {
      // Znajdź wybraną kategorię
      const selectedCategoryData = findCategoryById(selectedCategory, categories);
      
      if (selectedCategoryData) {
        // Zbierz ID wybranej kategorii i wszystkich jej podkategorii
        const categoryIds = getAllCategoryIds(selectedCategoryData);
        
        // Load products for selected category and all its subcategories
        const { data } = await supabase
          .from('products')
          .select(`
            *,
            product_images (
              original_url,
              thumbnail_url,
              display_order
            )
          `)
          .in('category_id', categoryIds)
          .eq('is_active', true)
          .range(from, to);
        
        const mappedProducts = data?.map(product => ({
          ...product,
          image_url: product.product_images?.[0]?.thumbnail_url || product.product_images?.[0]?.original_url
        })) || [];
        
        setProducts(mappedProducts);
      }
    }
    
    setCurrentPage(page);
  };

  const renderCategory = (category: Category, level: number = 0) => (
    <div key={category.id} className="category-item" style={{ marginLeft: `${level * 12}px` }}>
      <button
        className={`category-btn ${selectedCategory === category.id ? 'active' : ''}`}
        onClick={() => handleCategoryClick(category.id)}
      >
        {level > 0 && <span className="category-marker">└ </span>}
        {category.name}
      </button>
      {category.children && category.children.length > 0 && (
        <div className="category-children">
          {category.children.map((child) => renderCategory(child, level + 1))}
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="shop-page">
        <Navbar />
        <div className="shop-loading">
          <div className="spinner"></div>
          <p>Ładowanie sklepu...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="shop-page">
      <Navbar />
      
      <FeaturedSlider products={featuredProducts} sliderName={sliderName} />

      <main className="shop-main" ref={shopMainRef}>
        <div className="shop-container">
          {/* Sidebar - Categories */}
          <aside className="shop-sidebar">
            <h2 className="sidebar-title">Kategorie</h2>
            <div className="categories-list">
              <button
                className={`category-btn ${selectedCategory === null ? 'active' : ''}`}
                onClick={() => handleCategoryClick(null)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7" strokeLinecap="round" strokeLinejoin="round"/>
                  <rect x="14" y="3" width="7" height="7" strokeLinecap="round" strokeLinejoin="round"/>
                  <rect x="14" y="14" width="7" height="7" strokeLinecap="round" strokeLinejoin="round"/>
                  <rect x="3" y="14" width="7" height="7" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Wszystkie produkty
              </button>
              {categories.map((category) => renderCategory(category))}
            </div>
          </aside>

          {/* Main Content - Products */}
          <section className="shop-content">
            <h2 className="content-title">
              {selectedCategory 
                ? findCategoryById(selectedCategory, categories)?.name || 'Produkty'
                : 'Wszystkie produkty'
              }
            </h2>

            {products.length === 0 ? (
              <div className="products-empty">
                <p>Brak produktów w tej kategorii</p>
              </div>
            ) : (
              <div className="products-grid">
                {products.map((product) => (
                  <div 
                    key={product.id} 
                    className="product-card-shop"
                    onClick={() => navigate(`/product/${product.slug}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="product-image-shop">
                      {product.image_url ? (
                        <img src={product.image_url} alt={product.name} />
                      ) : (
                        <div className="product-image-placeholder">
                          Brak zdjęcia
                        </div>
                      )}
                    </div>
                    <div className="product-info-shop">
                      <h3 className="product-name-shop">{product.name}</h3>
                      <p className="product-description">{product.description}</p>
                      <div className="product-footer">
                        <span className="product-price-shop">{product.price.toFixed(2)} zł</span>
                        <button 
                          className="btn-add-to-cart"
                          onClick={async (e) => {
                            e.stopPropagation();
                            const btn = e.currentTarget as HTMLButtonElement;
                            const originalText = btn.innerHTML;
                            
                            try {
                              btn.disabled = true;
                              btn.innerHTML = '✓ Dodano!';
                              btn.style.background = '#28a745';
                              
                              await addToCart(product.id, 1);
                              
                              setTimeout(() => {
                                btn.innerHTML = originalText;
                                btn.style.background = '';
                                btn.disabled = false;
                              }, 2000);
                            } catch (err) {
                              console.error('Error adding to cart:', err);
                              btn.innerHTML = originalText;
                              btn.style.background = '';
                              btn.disabled = false;
                            }
                          }}
                        >
                          Dodaj do koszyka
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalProducts > productsPerPage && (
              <Pagination
                currentPage={currentPage}
                totalPages={Math.ceil(totalProducts / productsPerPage)}
                onPageChange={loadPage}
                itemsPerPage={productsPerPage}
                totalItems={totalProducts}
              />
            )}
          </section>
        </div>
      </main>
    </div>
  );
};
