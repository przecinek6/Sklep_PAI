import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { UserRole } from '../types/database.types';

interface UseAdminCheckReturn {
  isAdmin: boolean;
  isModerator: boolean;
  role: UserRole | null;
  loading: boolean;
}

export const useAdminCheck = (): UseAdminCheckReturn => {
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    checkUserRole();
  }, []);

  const checkUserRole = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        navigate('/login');
        return;
      }

      const { data: profile, error } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      setRole(profile.role);
    } catch (error) {
      console.error('Error checking user role:', error);
      setRole(null);
    } finally {
      setLoading(false);
    }
  };

  return {
    isAdmin: role === 'admin',
    isModerator: role === 'moderator',
    role,
    loading,
  };
};
