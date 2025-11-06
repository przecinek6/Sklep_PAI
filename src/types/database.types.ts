export interface UserProfile {
  id: string;
  email: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
  phone?: string;
  street_address?: string;
  city?: string;
  postal_code?: string;
  country?: string;
  provider?: 'google' | 'github' | 'email';
  locale?: string;
  created_at: string;
  updated_at: string;
}

export interface AuthResponse {
  user: UserProfile | null;
  error: Error | null;
}
