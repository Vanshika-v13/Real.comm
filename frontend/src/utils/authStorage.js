const TOKEN_KEY = 'token';
const REMEMBER_KEY = 'remember_me';
const TOKEN_SYNC_KEY = 'auth_token_sync';
const SYNC_CHANNEL_NAME = 'rtc-auth-sync';

/** In-memory token — always refreshed from storage before read. */
let cachedToken = null;
let broadcastChannel = null;
let suppressBroadcast = false;

function readStoredToken() {
  return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || null;
}

function syncCachedFromStorage() {
  cachedToken = readStoredToken();
  return cachedToken;
}

function getBroadcastChannel() {
  if (typeof BroadcastChannel === 'undefined') {
    return null;
  }
  if (!broadcastChannel) {
    broadcastChannel = new BroadcastChannel(SYNC_CHANNEL_NAME);
  }
  return broadcastChannel;
}

function postAuthSync(message) {
  if (suppressBroadcast) {
    return;
  }
  getBroadcastChannel()?.postMessage(message);
  if (message.type === 'TOKEN_UPDATED') {
    try {
      localStorage.setItem(
        TOKEN_SYNC_KEY,
        JSON.stringify({
          token: message.token,
          rememberMe: message.rememberMe,
          at: Date.now(),
        }),
      );
    } catch {
      /* quota / private mode */
    }
  } else if (message.type === 'TOKEN_CLEARED') {
    try {
      localStorage.removeItem(TOKEN_SYNC_KEY);
    } catch {
      /* ignore */
    }
  }
}

function applyTokenToStorage(token, rememberMe) {
  cachedToken = token;
  setRememberMePreference(rememberMe);
  if (rememberMe) {
    localStorage.setItem(TOKEN_KEY, token);
    sessionStorage.removeItem(TOKEN_KEY);
  } else {
    sessionStorage.setItem(TOKEN_KEY, token);
    localStorage.removeItem(TOKEN_KEY);
  }
}

function applyRemoteTokenUpdate(token, rememberMe) {
  suppressBroadcast = true;
  applyTokenToStorage(token, rememberMe);
  suppressBroadcast = false;
}

function applyRemoteTokenClear() {
  suppressBroadcast = true;
  cachedToken = null;
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REMEMBER_KEY);
  try {
    localStorage.removeItem(TOKEN_SYNC_KEY);
  } catch {
    /* ignore */
  }
  suppressBroadcast = false;
}

export const isRememberMeEnabled = () => localStorage.getItem(REMEMBER_KEY) === '1';

export const setRememberMePreference = (remember) => {
  if (remember) {
    localStorage.setItem(REMEMBER_KEY, '1');
  } else {
    localStorage.removeItem(REMEMBER_KEY);
  }
};

export const persistAuthToken = (token, rememberMe = false) => {
  applyTokenToStorage(token, rememberMe);
  postAuthSync({ type: 'TOKEN_UPDATED', token, rememberMe });
};

export const getAuthToken = () => {
  if (cachedToken) {
    return cachedToken;
  }
  return syncCachedFromStorage();
};

export const clearAuthToken = () => {
  applyRemoteTokenClear();
  postAuthSync({ type: 'TOKEN_CLEARED' });
};

/**
 * Keep JWT in sync across tabs/windows (storage events + BroadcastChannel).
 * @param {{ onTokenUpdated?: (token: string) => void, onTokenCleared?: () => void }} handlers
 * @returns {() => void} cleanup
 */
export function initAuthStorageSync(handlers = {}) {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const channel = getBroadcastChannel();

  const handleTokenUpdated = (token, rememberMe) => {
    if (!token) {
      return;
    }
    applyRemoteTokenUpdate(token, rememberMe ?? isRememberMeEnabled());
    handlers.onTokenUpdated?.(token);
  };

  const handleTokenCleared = () => {
    applyRemoteTokenClear();
    handlers.onTokenCleared?.();
  };

  const onChannelMessage = (event) => {
    const { type, token, rememberMe } = event.data || {};
    if (type === 'TOKEN_UPDATED' && token) {
      handleTokenUpdated(token, rememberMe);
    } else if (type === 'TOKEN_CLEARED') {
      handleTokenCleared();
    }
  };

  const onStorage = (event) => {
    if (event.key === TOKEN_KEY) {
      if (event.newValue) {
        cachedToken = event.newValue;
        handlers.onTokenUpdated?.(event.newValue);
      } else {
        syncCachedFromStorage();
        if (!readStoredToken()) {
          handleTokenCleared();
        }
      }
      return;
    }

    if (event.key === TOKEN_SYNC_KEY && event.newValue) {
      try {
        const payload = JSON.parse(event.newValue);
        if (payload?.token) {
          handleTokenUpdated(payload.token, payload.rememberMe);
        }
      } catch {
        /* ignore malformed sync payload */
      }
    }
  };

  channel?.addEventListener('message', onChannelMessage);
  window.addEventListener('storage', onStorage);
  syncCachedFromStorage();

  return () => {
    channel?.removeEventListener('message', onChannelMessage);
    window.removeEventListener('storage', onStorage);
  };
}
