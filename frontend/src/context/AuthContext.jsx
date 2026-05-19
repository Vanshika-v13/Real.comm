import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';
import socketService from '../services/socketService';
import {
  clearAuthToken,
  getAuthToken,
  persistAuthToken,
} from '../utils/authStorage';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    const token = getAuthToken();
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const response = await api.get('/auth/me');
      setUser(response.data.data.user);
      socketService.connect();
    } catch {
      clearAuthToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password, rememberMe = false) => {
    const response = await api.post('/auth/login', { email, password });
    const { token, user: userData } = response.data.data;
    persistAuthToken(token, rememberMe);
    setUser(userData);
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
    setUser(userData);
    socketService.connect();
    return response.data;
  };

  const logout = () => {
    clearAuthToken();
    setUser(null);
    socketService.disconnect();
  };

  return (
    <AuthContext.Provider value={{ user, setUser, login, register, logout, loading, checkUser }}>
      {children}
    </AuthContext.Provider>
  );
};
