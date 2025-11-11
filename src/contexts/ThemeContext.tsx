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
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
  };

  const rgbToHex = (r: number, g: number, b: number) => {
    return "#" + [r, g, b].map(x => {
      const hex = Math.round(x).toString(16);
      return hex.length === 1 ? "0" + hex : hex;
    }).join('');
  };

  const generateColorVariants = (hexColor: string) => {
    const rgb = hexToRgb(hexColor);

    // Hover (ciemniejszy o 15%)
    const darkenHover = (value: number) => Math.max(0, Math.floor(value * 0.85));
    const hover = rgbToHex(darkenHover(rgb.r), darkenHover(rgb.g), darkenHover(rgb.b));

    // Light (jaśniejszy o 80%)
    const lighten = (value: number) => Math.min(255, Math.floor(value + (255 - value) * 0.8));
    const light = rgbToHex(lighten(rgb.r), lighten(rgb.g), lighten(rgb.b));

    // Lighter (jaśniejszy o 95%)
    const lightenMore = (value: number) => Math.min(255, Math.floor(value + (255 - value) * 0.95));
    const lighter = rgbToHex(lightenMore(rgb.r), lightenMore(rgb.g), lightenMore(rgb.b));

    // Dark (ciemniejszy o 30%)
    const darken = (value: number) => Math.max(0, Math.floor(value * 0.7));
    const dark = rgbToHex(darken(rgb.r), darken(rgb.g), darken(rgb.b));

    return { hover, light, lighter, dark };
  };

  // Zastosuj motyw do CSS variables
  const applyTheme = (theme: Theme) => {
    const root = document.documentElement;

    // Główne 3 kolory
    root.style.setProperty('--primary-color', theme.primary_color);
    root.style.setProperty('--secondary-color', theme.secondary_color);
    root.style.setProperty('--accent-color', theme.accent_color);

    // Wygeneruj warianty dla PRIMARY
    const primaryVariants = generateColorVariants(theme.primary_color);
    root.style.setProperty('--primary-hover', primaryVariants.hover);
    root.style.setProperty('--primary-light', primaryVariants.light);
    root.style.setProperty('--primary-lighter', primaryVariants.lighter);
    root.style.setProperty('--primary-dark', primaryVariants.dark);

    // Wygeneruj warianty dla SECONDARY
    const secondaryVariants = generateColorVariants(theme.secondary_color);
    root.style.setProperty('--secondary-hover', secondaryVariants.hover);
    root.style.setProperty('--secondary-light', secondaryVariants.light);
    root.style.setProperty('--secondary-lighter', secondaryVariants.lighter);
    root.style.setProperty('--secondary-dark', secondaryVariants.dark);

    // Wygeneruj warianty dla ACCENT
    const accentVariants = generateColorVariants(theme.accent_color);
    root.style.setProperty('--accent-hover', accentVariants.hover);
    root.style.setProperty('--accent-light', accentVariants.light);
    root.style.setProperty('--accent-lighter', accentVariants.lighter);
    root.style.setProperty('--accent-dark', accentVariants.dark);

    // Kolory systemowe oparte na trzech głównych
    const primaryRgb = hexToRgb(theme.primary_color);
    const accentRgb = hexToRgb(theme.accent_color);

    // Background i Surface oparte na ACCENT (zwykle najciemniejszy)
    root.style.setProperty('--background', accentVariants.lighter);
    root.style.setProperty('--surface', accentVariants.light);
    root.style.setProperty('--border', `rgba(${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}, 0.15)`);

    // Teksty oparte na ACCENT
    root.style.setProperty('--text-primary', accentVariants.dark);
    root.style.setProperty('--text-secondary', `rgba(${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}, 0.7)`);
    root.style.setProperty('--text-tertiary', `rgba(${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}, 0.5)`);

    // Success, warning, error oparte na PRIMARY i SECONDARY
    root.style.setProperty('--success', '#10b981');
    root.style.setProperty('--warning', '#f59e0b');
    root.style.setProperty('--error', '#ef4444');
    root.style.setProperty('--info', theme.primary_color);

    // Shadow oparte na PRIMARY
    root.style.setProperty('--shadow-sm', `0 1px 2px 0 rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.05)`);
    root.style.setProperty('--shadow-md', `0 4px 6px -1px rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.1)`);
    root.style.setProperty('--shadow-lg', `0 10px 15px -3px rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.1)`);

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
