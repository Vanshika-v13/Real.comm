import { getRequestPath, isAuthSessionEndpoint, isSettingsRequest } from './requestPaths';

/**
 * @typedef {'auth' | 'validation' | 'settings' | 'network' | 'unknown'} ApiErrorKind
 */

/**
 * @returns {ApiErrorKind}
 */
export function classifyApiError(error) {
  if (!error?.response) {
    return 'network';
  }

  const status = error.response.status;
  const config = error.config || {};

  if (isSettingsRequest(config)) {
    if (status === 400 || status === 422) {
      return 'validation';
    }
    return 'settings';
  }

  if (status === 400 || status === 422) {
    return 'validation';
  }

  if (isAuthenticationFailure(error)) {
    return 'auth';
  }

  return 'unknown';
}

/**
 * Session logout is allowed ONLY for 401 on core auth session endpoints.
 * Never for settings, validation (400/422), or other API routes.
 */
export function isAuthenticationFailure(error) {
  const status = error?.response?.status;
  if (status !== 401) {
    return false;
  }

  const config = error.config || {};
  if (isSettingsRequest(config)) {
    return false;
  }

  const path = getRequestPath(config);
  if (path.includes('/auth/login') || path.includes('/auth/register')) {
    return false;
  }

  return isAuthSessionEndpoint(config);
}

export function getApiErrorMessage(error, fallback = 'Something went wrong') {
  if (!error?.response) {
    return error?.message || 'Network error. Check your connection and try again.';
  }
  const data = error.response.data;
  const validationMsg = data?.errors?.[0]?.message;
  return validationMsg || data?.message || fallback;
}
