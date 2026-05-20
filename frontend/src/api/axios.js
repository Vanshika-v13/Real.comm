import axios from 'axios';
import { clearAuthToken, getAuthToken } from '../utils/authStorage';
import { isAuthenticationFailure } from '../utils/apiErrors';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export { isSettingsRequest, isAuthSessionEndpoint } from '../utils/requestPaths';

export function setDefaultAuthToken(token) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}

export function applyAuthHeader(config, token = getAuthToken()) {
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  } else {
    delete config.headers.Authorization;
  }
  return config;
}

api.interceptors.request.use(
  (config) => {
    const token = getAuthToken();
    setDefaultAuthToken(token);
    return applyAuthHeader(config, token);
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (isAuthenticationFailure(error)) {
      clearAuthToken();
      setDefaultAuthToken(null);
      if (
        window.location.pathname !== '/login'
        && window.location.pathname !== '/register'
      ) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

export default api;
