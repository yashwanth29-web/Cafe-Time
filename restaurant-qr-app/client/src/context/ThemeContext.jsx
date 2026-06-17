import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';

const ThemeContext = createContext();

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }) => {
  const { user } = useAuth();
  
  const [themeMode, setThemeMode] = useState(() => {
    return localStorage.getItem('themeMode') || 'system';
  });
  
  const [primaryColor, setPrimaryColor] = useState('#D47F46'); // Default Coffee Brown

  // Fetch primary color from database on login/mount
  useEffect(() => {
    const fetchCafeTheme = async () => {
      if (user && user.cafeId) {
        try {
          const res = await axios.get('/api/admin/setup', { withCredentials: true });
          if (res.data.success && res.data.cafe && res.data.cafe.uiPrimaryColor) {
            setPrimaryColor(res.data.cafe.uiPrimaryColor);
          }
        } catch (err) {
          console.error("Failed to fetch cafe theme:", err);
        }
      }
    };
    
    // Only fetch if it's an admin/owner/staff role
    if (user && user.role !== 'customer') {
      fetchCafeTheme();
    }
  }, [user]);

  // Apply Theme Mode (Light/Dark/System)
  useEffect(() => {
    const root = document.documentElement;
    
    let activeTheme = themeMode;
    if (themeMode === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      activeTheme = prefersDark ? 'dark' : 'light';
    }

    if (activeTheme === 'dark') {
      root.setAttribute('data-theme', 'dark');
    } else {
      root.removeAttribute('data-theme');
    }

    // Save preference
    localStorage.setItem('themeMode', themeMode);
  }, [themeMode]);

  // Listen to system theme changes if mode is 'system'
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e) => {
      if (themeMode === 'system') {
        const root = document.documentElement;
        if (e.matches) {
          root.setAttribute('data-theme', 'dark');
        } else {
          root.removeAttribute('data-theme');
        }
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [themeMode]);

  // Apply Primary Color Variable
  useEffect(() => {
    if (primaryColor) {
      document.documentElement.style.setProperty('--color-primary', primaryColor);
      
      // Calculate a slightly darker/lighter version for hover effects
      // This is a simple approximation
      document.documentElement.style.setProperty('--color-primary-hover', primaryColor + 'cc'); 
    }
  }, [primaryColor]);

  const updatePrimaryColor = async (color) => {
    setPrimaryColor(color);
    if (user && ['admin', 'owner'].includes(user.role)) {
      try {
        await axios.put('/api/admin/theme', { uiPrimaryColor: color }, { withCredentials: true });
      } catch (err) {
        console.error("Failed to save theme color to DB:", err);
      }
    }
  };

  const value = {
    themeMode,
    setThemeMode,
    primaryColor,
    updatePrimaryColor
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};
