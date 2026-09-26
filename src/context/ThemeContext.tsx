import React, { createContext, useContext, useEffect, useState } from 'react';
import { StorageService, errorMessage } from '../services/storage';
import { useToast } from './ToastContext';

interface ThemeContextType {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
  themeError: string;
}
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);
export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [initial] = useState(() => {
    try {
      return { theme: StorageService.getTheme(), error: '' };
    } catch (error) {
      return { theme: 'light' as const, error: errorMessage(error) };
    }
  });
  const [theme, setThemeState] = useState(initial.theme);
  const [themeError, setThemeError] = useState(initial.error);
  const { showToast } = useToast();
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);
  const setTheme = (next: 'light' | 'dark') => {
    try {
      StorageService.setTheme(next);
      setThemeState(next);
      setThemeError('');
    } catch (error) {
      showToast(errorMessage(error), 'error');
    }
  };
  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        toggleTheme: () => setTheme(theme === 'light' ? 'dark' : 'light'),
        themeError,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
};
