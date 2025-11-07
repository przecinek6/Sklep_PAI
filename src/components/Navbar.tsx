import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, Search, User, ChevronDown, LogOut, Settings, ShieldCheck, UserCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import './Navbar.css';

export const Navbar = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [userRole, setUserRole] = useState<string>('user');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const navigate = useNavigate();
  const dropdownRef = useRef<HTMLDivElement>(null);

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
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
    }
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
        <form className="navbar-search" onSubmit={handleSearch}>
          <div className="search-wrapper">
            <Search className="search-icon" size={20} />
            <input
              type="text"
              placeholder="Szukaj produktów..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>
        </form>

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
              <Link to="/cart" className="btn-cart">
                <ShoppingCart size={24} />
                <span className="cart-badge">0</span>
              </Link>
            </>
          ) : (
            <>
              <Link to="/login" className="btn-login">
                Zaloguj się
              </Link>
              <Link to="/cart" className="btn-cart">
                <ShoppingCart size={24} />
                <span className="cart-badge">0</span>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};
