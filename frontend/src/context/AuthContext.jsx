import React, { createContext, useContext, useState, useEffect } from 'react';
import api, { setDefaultAuthToken } from '../api/axios';
import socketService from '../services/socketService';
import {
  clearAuthToken,
  getAuthToken,
  initAuthStorageSync,
  persistAuthToken,
} from '../utils/authStorage';
import { isAuthenticationFailure } from '../utils/apiErrors';
import { useTheme } from './ThemeContext';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const { changeTheme } = useTheme();

  useEffect(() => {
    checkUser();
  }, []);

  useEffect(() => {
    const cleanup = initAuthStorageSync({
      onTokenUpdated: () => {
        socketService.reconnectWithLatestToken();
      },
      onTokenCleared: () => {
        setUser(null);
        socketService.disconnect();
      },
    });
    return cleanup;
  }, []);

  const checkUser = async () => {
    const token = getAuthToken();
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const response = await api.get('/auth/me');
      const userData = response.data.data.user;
      setUser(userData);
      
      if (userData?.themePreference) {
        localStorage.setItem('theme', userData.themePreference);
        changeTheme(userData.themePreference);
      }
      
      socketService.connect();
    } catch (error) {
      if (isAuthenticationFailure(error)) {
        clearAuthToken();
        setDefaultAuthToken(null);
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password, rememberMe = false) => {
    const response = await api.post('/auth/login', { email, password });
    const { token, user: userData } = response.data.data;
    persistAuthToken(token, rememberMe);
    setDefaultAuthToken(token);
    setUser(userData);
    
    if (userData?.themePreference) {
      localStorage.setItem('theme', userData.themePreference);
      changeTheme(userData.themePreference);
    }
    
    socketService.connect();
    return response.data;
  };

  const register = async (name, email, password, rememberMe = true) => {
    const response = await api.post('/auth/register', {
      name: name.trim(),
      email: email.trim(),
      password,
    });
    const { token, user: userData } = response.data.data;
    persistAuthToken(token, rememberMe);
    setDefaultAuthToken(token);
    setUser(userData);
    
    if (userData?.themePreference) {
      localStorage.setItem('theme', userData.themePreference);
      changeTheme(userData.themePreference);
    }
    
    socketService.connect();
    return response.data;
  };

  const logout = () => {
    clearAuthToken();
    setDefaultAuthToken(null);
    setUser(null);
    socketService.disconnect();
  };

  return (
    <AuthContext.Provider value={{ user, setUser, login, register, logout, loading, checkUser }}>
      {children}
    </AuthContext.Provider>
  );
};
