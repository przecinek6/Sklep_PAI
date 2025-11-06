import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useState, useEffect } from 'react';
import type { UserRole } from '../types/database.types';
import './Home.css';

export const Home = () => {
  const { user } = useAuth();
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [isBanned, setIsBanned] = useState(false);
  const [banReason, setBanReason] = useState<string>('');

  useEffect(() => {
    const loadUserRole = async () => {
      if (!user) return;

      const { data } = await supabase
        .from('user_profiles')
        .select('role, is_banned, ban_reason')
        .eq('id', user.id)
        .single();

      if (data) {
        setUserRole(data.role);
        setIsBanned(data.is_banned || false);
        setBanReason(data.ban_reason || '');
      }
    };

    loadUserRole();
  }, [user]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  // If user is banned, show suspension notice
  if (isBanned) {
    return (
      <div className="home-container">
        <motion.div
          className="suspended-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="suspended-icon">⚠</div>
          <h1>Konto zostało zawieszone</h1>
          <div className="suspended-info">
            <p>
              <strong>Powód zawieszenia:</strong>
            </p>
            <p className="ban-reason">{banReason || 'Nie podano powodu'}</p>
            <p className="help-text">
              Jeśli uważasz, że to pomyłka, skontaktuj się z administratorem.
            </p>
          </div>
          <motion.button
            className="sign-out-button"
            onClick={handleSignOut}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Wyloguj się
          </motion.button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="home-container">
      <motion.div
        className="home-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <h1>Witaj w Sklep PAI!</h1>
        <div className="user-info">
          <p>
            <strong>Email:</strong> {user?.email}
          </p>
          <p>
            <strong>User ID:</strong> {user?.id}
          </p>
          <p>
            <strong>Provider:</strong> {user?.app_metadata?.provider || 'email'}
          </p>
          {userRole && (
            <p>
              <strong>Rola:</strong> {
                userRole === 'admin' ? 'Administrator' :
                userRole === 'moderator' ? 'Moderator' :
                'Użytkownik'
              }
            </p>
          )}
        </div>

        <div className="home-actions">
          {userRole === 'admin' && (
            <Link to="/admin" className="admin-link">
              Panel Administracyjny
            </Link>
          )}

          <motion.button
            className="sign-out-button"
            onClick={handleSignOut}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Wyloguj się
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
};
