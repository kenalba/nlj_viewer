import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { Theme } from '@mui/material/styles';
import { hyundaiTheme } from '../theme/hyundaiTheme';
import { unfilteredTheme } from '../theme/unfilteredTheme';

export type ThemeMode = 'unfiltered' | 'hyundai';

interface ThemeContextType {
  currentTheme: Theme;
  themeMode: ThemeMode;
  toggleTheme: () => void;
  setThemeMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'nlj_theme_mode';

export const ThemeProvider: React.FC<{ children: ReactNode; initialTheme?: ThemeMode }> = ({ children, initialTheme }) => {
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    // For testing, use initialTheme if provided
    if (initialTheme) {
      return initialTheme;
    }
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    return (savedTheme as ThemeMode) || 'hyundai'; // Default to hyundai
  });

  const currentTheme = themeMode === 'hyundai' ? hyundaiTheme : unfilteredTheme;

  const toggleTheme = () => {
    const newMode = themeMode === 'hyundai' ? 'unfiltered' : 'hyundai';
    setThemeMode(newMode);
  };

  const handleSetThemeMode = (mode: ThemeMode) => {
    setThemeMode(mode);
  };

  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, themeMode);
  }, [themeMode]);

  return (
    <ThemeContext.Provider
      value={{
        currentTheme,
        themeMode,
        toggleTheme,
        setThemeMode: handleSetThemeMode,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};