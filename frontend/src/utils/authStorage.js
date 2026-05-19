const TOKEN_KEY = 'token';
const REMEMBER_KEY = 'remember_me';

export const isRememberMeEnabled = () => localStorage.getItem(REMEMBER_KEY) === '1';

export const setRememberMePreference = (remember) => {
  if (remember) {
    localStorage.setItem(REMEMBER_KEY, '1');
  } else {
    localStorage.removeItem(REMEMBER_KEY);
  }
};

export const persistAuthToken = (token, rememberMe = false) => {
  setRememberMePreference(rememberMe);
  if (rememberMe) {
    localStorage.setItem(TOKEN_KEY, token);
    sessionStorage.removeItem(TOKEN_KEY);
  } else {
    sessionStorage.setItem(TOKEN_KEY, token);
    localStorage.removeItem(TOKEN_KEY);
  }
};

export const getAuthToken = () =>
  localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);

export const clearAuthToken = () => {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REMEMBER_KEY);
};
