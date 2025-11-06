import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import './Home.css';

export const Home = () => {
  const { user } = useAuth();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="home-container">
      <motion.div
        className="home-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <h1>Welcome to Sklep PAI! 🎉</h1>
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
        </div>

        <motion.button
          className="sign-out-button"
          onClick={handleSignOut}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          Sign Out
        </motion.button>

        <div className="coming-soon">
          <h2>Coming Soon</h2>
          <p>Sklep features will be added here...</p>
        </div>
      </motion.div>
    </div>
  );
};
