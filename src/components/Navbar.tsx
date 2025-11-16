import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, Search, User, ChevronDown, LogOut, Settings, ShieldCheck, UserCircle, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import CartIcon from './CartIcon';
import './Navbar.css';

interface SearchSuggestion {
  id: string;
  name: string;
  slug: string;
  price: number;
  image_url?: string;
}

export const Navbar = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [userRole, setUserRole] = useState<string>('user');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const navigate = useNavigate();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    // Get current user
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserProfile(session.user.id);
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserProfile(session.user.id);
      } else {
        setUserRole('user');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search suggestions with debounce
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchQuery.trim().length >= 2) {
      setLoadingSuggestions(true);
      searchTimeoutRef.current = window.setTimeout(() => {
        loadSuggestions(searchQuery);
      }, 300);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  const loadUserProfile = async (userId: string) => {
    try {
      const { data } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', userId)
        .single();
      
      if (data) {
        setUserRole(data.role || 'user');
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  };

  const loadSuggestions = async (query: string) => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select(`
          id,
          name,
          slug,
          price,
          product_images (
            thumbnail_url,
            display_order
          )
        `)
        .eq('is_active', true)
        .ilike('name', `%${query}%`)
        .limit(5)
        .order('name');

      if (error) throw error;

      if (data) {
        const mapped = data.map(product => ({
          id: product.id,
          name: product.name,
          slug: product.slug,
          price: product.price,
          image_url: product.product_images?.[0]?.thumbnail_url
        }));
        setSuggestions(mapped);
        setShowSuggestions(true);
      }
    } catch (error) {
      console.error('Error loading suggestions:', error);
      setSuggestions([]);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
      setShowSuggestions(false);
      setSearchQuery('');
    }
  };

  const handleSuggestionClick = (slug: string) => {
    navigate(`/product/${slug}`);
    setShowSuggestions(false);
    setSearchQuery('');
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setDropdownOpen(false);
    navigate('/');
  };

  const getUserDisplayName = () => {
    if (user?.user_metadata?.full_name) {
      return user.user_metadata.full_name;
    }
    if (user?.email) {
      return user.email.split('@')[0];
    }
    return 'Użytkownik';
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        {/* Segment 1: Logo */}
        <Link to="/" className="navbar-logo">
          Tech Shop
        </Link>

        {/* Segment 2: Search */}
        <div className="navbar-search" ref={searchRef}>
          <form onSubmit={handleSearch}>
            <div className="search-wrapper">
              <Search className="search-icon" size={20} />
              <input
                type="text"
                placeholder="Szukaj produktów..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => searchQuery.trim().length >= 2 && setShowSuggestions(true)}
                className="search-input"
                autoComplete="off"
              />
              {searchQuery && (
                <button
                  type="button"
                  className="search-clear"
                  onClick={clearSearch}
                  aria-label="Wyczyść wyszukiwanie"
                >
                  <X size={18} />
                </button>
              )}
            </div>
          </form>

          {/* Search Suggestions Dropdown */}
          {showSuggestions && (
            <div className="search-suggestions">
              {loadingSuggestions ? (
                <div className="suggestions-loading">
                  <div className="suggestions-spinner"></div>
                  <span>Wyszukiwanie...</span>
                </div>
              ) : suggestions.length > 0 ? (
                <>
                  {suggestions.map(suggestion => (
                    <button
                      key={suggestion.id}
                      className="suggestion-item"
                      onClick={() => handleSuggestionClick(suggestion.slug)}
                    >
                      {suggestion.image_url ? (
                        <img 
                          src={suggestion.image_url} 
                          alt={suggestion.name}
                          className="suggestion-image"
                        />
                      ) : (
                        <div className="suggestion-image-placeholder">
                          <Search size={16} />
                        </div>
                      )}
                      <div className="suggestion-info">
                        <span className="suggestion-name">{suggestion.name}</span>
                        <span className="suggestion-price">{suggestion.price.toFixed(2)} zł</span>
                      </div>
                    </button>
                  ))}
                  <button className="suggestion-see-all" onClick={handleSearch}>
                    Zobacz wszystkie wyniki dla "{searchQuery}"
                  </button>
                </>
              ) : searchQuery.trim().length >= 2 ? (
                <div className="suggestions-empty">
                  Brak wyników dla "{searchQuery}"
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Segment 3: Buttons */}
        <div className="navbar-actions">
          {user ? (
            <>
              {/* User Menu */}
              <div className="user-menu" ref={dropdownRef}>
                <button 
                  className="user-menu-button"
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                >
                  <User size={20} />
                  <span className="user-name">{getUserDisplayName()}</span>
                  <ChevronDown size={16} className={`chevron ${dropdownOpen ? 'open' : ''}`} />
                </button>

                {dropdownOpen && (
                  <div className="dropdown-menu">
                    <div className="dropdown-header">
                      <User size={20} />
                      <div className="user-info">
                        <div className="user-info-name">{getUserDisplayName()}</div>
                        <div className="user-info-email">{user.email}</div>
                      </div>
                    </div>
                    <div className="dropdown-divider"></div>
                    
                    <Link to="/profile" className="dropdown-item" onClick={() => setDropdownOpen(false)}>
                      <UserCircle size={18} />
                      <span>Moje konto</span>
                    </Link>

                    <Link to="/orders" className="dropdown-item" onClick={() => setDropdownOpen(false)}>
                      <ShoppingCart size={18} />
                      <span>Moje zamówienia</span>
                    </Link>

                    <Link to="/settings" className="dropdown-item" onClick={() => setDropdownOpen(false)}>
                      <Settings size={18} />
                      <span>Ustawienia</span>
                    </Link>

                    {(userRole === 'moderator' || userRole === 'admin') && (
                      <>
                        <div className="dropdown-divider"></div>
                        <Link to="/moderator" className="dropdown-item moderator" onClick={() => setDropdownOpen(false)}>
                          <ShieldCheck size={18} />
                          <span>Panel moderatora</span>
                        </Link>
                      </>
                    )}

                    {userRole === 'admin' && (
                      <Link to="/admin" className="dropdown-item admin" onClick={() => setDropdownOpen(false)}>
                        <ShieldCheck size={18} />
                        <span>Panel admina</span>
                      </Link>
                    )}

                    <div className="dropdown-divider"></div>
                    <button className="dropdown-item logout" onClick={handleLogout}>
                      <LogOut size={18} />
                      <span>Wyloguj się</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Cart Button */}
              <CartIcon />
            </>
          ) : (
            <>
              <Link to="/login" className="btn-login">
                Zaloguj się
              </Link>
              <CartIcon />
            </>
          )}
        </div>
      </div>
    </nav>
  );
};
