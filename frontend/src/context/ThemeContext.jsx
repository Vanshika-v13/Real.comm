import React, { createContext, useContext, useState, useEffect } from 'react';
import { applyTheme } from '../utils/theme';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  // Read theme from localStorage on startup, fallback to dark
  const [theme, setThemeState] = useState(() => {
    const saved = localStorage.getItem('theme');
    return (saved === 'light' || saved === 'dark') ? saved : 'dark';
  });

  // Apply theme on initial mount
  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem('theme', theme);
  }, []); // Run only once on mount since changeTheme handles updates synchronously

  const changeTheme = (newTheme) => {
    if (newTheme === 'dark' || newTheme === 'light') {
      applyTheme(newTheme); // Apply immediately to DOM before React re-render
      localStorage.setItem('theme', newTheme);
      setThemeState(newTheme);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, changeTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
