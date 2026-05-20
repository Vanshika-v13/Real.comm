import { classifyApiError, getApiErrorMessage } from './apiErrors';

/**
 * Extract a user-facing message from a settings API error.
 * Never treats settings/validation/network errors as auth failures.
 */
export function getSettingsErrorMessage(error, fallback = 'Something went wrong') {
  const kind = classifyApiError(error);

  if (kind === 'network') {
    return getApiErrorMessage(error, 'Network error. Check your connection and try again.');
  }

  if (kind === 'validation' || kind === 'settings') {
    return getApiErrorMessage(error, fallback);
  }

  return getApiErrorMessage(error, fallback);
}
