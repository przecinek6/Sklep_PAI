import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Theme } from '../types/database.types';

interface ThemeContextType {
  currentTheme: Theme | null;
  availableThemes: Theme[];
  loading: boolean;
  setUserTheme: (themeId: string) => Promise<void>;
  applyTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [currentTheme, setCurrentTheme] = useState<Theme | null>(null);
  const [availableThemes, setAvailableThemes] = useState<Theme[]>([]);
  const [loading, setLoading] = useState(true);

  // Funkcja obliczająca dodatkowe kolory na podstawie głównego koloru
  const generateColorVariants = (hexColor: string) => {
    // Konwersja HEX na RGB
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    // Hover (ciemniejszy o 10%)
    const darken = (value: number) => Math.max(0, Math.floor(value * 0.9));
    const hoverColor = `#${darken(r).toString(16).padStart(2, '0')}${darken(g).toString(16).padStart(2, '0')}${darken(b).toString(16).padStart(2, '0')}`;

    // Light (jaśniejszy o 40%)
    const lighten = (value: number) => Math.min(255, Math.floor(value + (255 - value) * 0.4));
    const lightColor = `#${lighten(r).toString(16).padStart(2, '0')}${lighten(g).toString(16).padStart(2, '0')}${lighten(b).toString(16).padStart(2, '0')}`;

    return { hover: hoverColor, light: lightColor };
  };

  // Zastosuj motyw do CSS variables
  const applyTheme = (theme: Theme) => {
    const root = document.documentElement;

    // Główne kolory
    root.style.setProperty('--primary-color', theme.primary_color);
    root.style.setProperty('--secondary-color', theme.secondary_color);
    root.style.setProperty('--accent-color', theme.accent_color);

    // Wygeneruj warianty
    const primaryVariants = generateColorVariants(theme.primary_color);
    const secondaryVariants = generateColorVariants(theme.secondary_color);
    const accentVariants = generateColorVariants(theme.accent_color);

    root.style.setProperty('--primary-hover', primaryVariants.hover);
    root.style.setProperty('--primary-light', primaryVariants.light);
    root.style.setProperty('--secondary-hover', secondaryVariants.hover);
    root.style.setProperty('--secondary-light', secondaryVariants.light);
    root.style.setProperty('--accent-hover', accentVariants.hover);
    root.style.setProperty('--accent-light', accentVariants.light);

    setCurrentTheme(theme);
  };

  // Załaduj dostępne motywy
  const loadAvailableThemes = async () => {
    try {
      const { data, error } = await supabase
        .from('themes')
        .select('*')
        .order('name');

      if (error) throw error;
      setAvailableThemes(data || []);
    } catch (error) {
      console.error('Error loading themes:', error);
    }
  };

  // Załaduj motyw użytkownika lub domyślny
  const loadUserTheme = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        // Sprawdź czy użytkownik ma ustawiony motyw
        const { data: preferences } = await supabase
          .from('user_preferences')
          .select('theme_id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (preferences?.theme_id) {
          // Załaduj wybrany motyw
          const { data: theme } = await supabase
            .from('themes')
            .select('*')
            .eq('id', preferences.theme_id)
            .single();

          if (theme) {
            applyTheme(theme);
            return;
          }
        }
      }

      // Jeśli nie ma preferencji, załaduj aktywny motyw
      const { data: activeTheme } = await supabase
        .from('themes')
        .select('*')
        .eq('is_active', true)
        .single();

      if (activeTheme) {
        applyTheme(activeTheme);
      }
    } catch (error) {
      console.error('Error loading user theme:', error);
    } finally {
      setLoading(false);
    }
  };

  // Ustaw motyw dla użytkownika
  const setUserTheme = async (themeId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Zapisz preferencję
      const { error } = await supabase
        .from('user_preferences')
        .upsert({
          user_id: user.id,
          theme_id: themeId,
        });

      if (error) throw error;

      // Załaduj i zastosuj nowy motyw
      const { data: theme } = await supabase
        .from('themes')
        .select('*')
        .eq('id', themeId)
        .single();

      if (theme) {
        applyTheme(theme);
      }
    } catch (error) {
      console.error('Error setting user theme:', error);
      throw error;
    }
  };

  useEffect(() => {
    loadAvailableThemes();
    loadUserTheme();
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        currentTheme,
        availableThemes,
        loading,
        setUserTheme,
        applyTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};
