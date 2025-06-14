'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { ThemeState } from '../../types/content';

interface ThemeContextType {
  theme: ThemeState;
  setTheme: (mode: 'light' | 'dark' | 'system') => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeState>({
    mode: 'system',
    systemPreference: 'light'
  });

  // Load saved theme and set up system preference detection
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const updateSystemPreference = () => {
      setThemeState(prev => ({
        ...prev,
        systemPreference: mediaQuery.matches ? 'dark' : 'light'
      }));
    };

    // Set initial system preference
    const initialSystemPreference = mediaQuery.matches ? 'dark' : 'light';
    
    // Load saved theme from localStorage, defaulting to system
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | 'system';
    const themeMode = savedTheme && ['light', 'dark', 'system'].includes(savedTheme) ? savedTheme : 'system';
    
    setThemeState({
      mode: themeMode,
      systemPreference: initialSystemPreference
    });

    // Listen for system preference changes
    mediaQuery.addEventListener('change', updateSystemPreference);
    return () => mediaQuery.removeEventListener('change', updateSystemPreference);
  }, []);

  // Apply theme to document
  useEffect(() => {
    const isDark = theme.mode === 'dark' || 
      (theme.mode === 'system' && theme.systemPreference === 'dark');
    
    console.log('Applying theme:', { theme, isDark, classList: document.documentElement.classList.toString() });
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem('theme', theme.mode);
    console.log('After toggle:', { classList: document.documentElement.classList.toString() });
  }, [theme]);

  const setTheme = (mode: 'light' | 'dark' | 'system') => {
    setThemeState(prev => ({ ...prev, mode }));
  };

  const toggleTheme = () => {
    const currentMode = theme.mode === 'dark' || 
      (theme.mode === 'system' && theme.systemPreference === 'dark') ? 'dark' : 'light';
    const newMode = currentMode === 'dark' ? 'light' : 'dark';
    console.log('Toggle theme:', { currentMode, newMode, currentTheme: theme });
    setTheme(newMode);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}