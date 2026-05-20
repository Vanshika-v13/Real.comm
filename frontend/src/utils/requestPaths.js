export function getRequestPath(config) {
  const url = config?.url || '';
  if (url.startsWith('http')) {
    try {
      return new URL(url).pathname;
    } catch {
      return url;
    }
  }
  return url;
}

export function isSettingsRequest(config) {
  return getRequestPath(config).includes('/settings');
}

/** Core session endpoints — only these may trigger global logout on 401. */
export function isAuthSessionEndpoint(config) {
  const path = getRequestPath(config);
  return path.includes('/auth/me') || path.includes('/auth/logout');
}
