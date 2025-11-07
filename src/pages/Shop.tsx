import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Navbar } from '../components/Navbar';
import { FeaturedSlider } from '../components/FeaturedSlider';
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
  description: string;
  price: number;
  image_url?: string;
  category_id: string;
}

export const Shop = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

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

      // Load featured products (random 10)
      const { data: allProducts } = await supabase
        .from('products')
        .select('*')
        .limit(100);

      if (allProducts && allProducts.length > 0) {
        // Get random products for featured slider
        const shuffled = [...allProducts].sort(() => 0.5 - Math.random());
        setFeaturedProducts(shuffled.slice(0, 10));
        setProducts(shuffled.slice(0, 20)); // Show first 20 products
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryClick = async (categoryId: string | null) => {
    setSelectedCategory(categoryId);
    
    if (!categoryId) {
      // Load all products
      const { data } = await supabase
        .from('products')
        .select('*')
        .limit(20);
      setProducts(data || []);
    } else {
      // Load products for selected category
      const { data } = await supabase
        .from('products')
        .select('*')
        .eq('category_id', categoryId)
        .limit(20);
      setProducts(data || []);
    }
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
      
      <FeaturedSlider products={featuredProducts} />

      <main className="shop-main">
        <div className="shop-container">
          {/* Sidebar - Categories */}
          <aside className="shop-sidebar">
            <h2 className="sidebar-title">Kategorie</h2>
            <div className="categories-list">
              {categories.map((category) => renderCategory(category))}
            </div>
          </aside>

          {/* Main Content - Products */}
          <section className="shop-content">
            <h2 className="content-title">
              {selectedCategory 
                ? categories.find(c => c.id === selectedCategory)?.name || 'Produkty'
                : 'Produkty'
              }
            </h2>

            {products.length === 0 ? (
              <div className="products-empty">
                <p>Brak produktów w tej kategorii</p>
              </div>
            ) : (
              <div className="products-grid">
                {products.map((product) => (
                  <div key={product.id} className="product-card-shop">
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
                        <button className="btn-add-to-cart">Dodaj do koszyka</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
};
