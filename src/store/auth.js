import Vue from 'vue';
import { apiRequest, ApiError } from '../utils/apiClient';

const STORAGE_KEY = 'webatt.auth';
const MAX_TIMER_DELAY = 2147483647;

const state = Vue.observable({
  token: null,
  refreshToken: null,
  user: null,
  expiresAt: null,
  loading: false,
  error: null,
  initialized: false,
  credentials: null
});

const subscribers = new Set();
const pendingEvents = [];
let expiryTimer = null;

function sanitizeCredentials(credentials) {
  if (!credentials || typeof credentials !== 'object') {
    return null;
  }
  const username = credentials.username ?? null;
  const password = credentials.password ?? null;
  if (!username || !password) {
    return null;
  }
  return { username, password };
}

function normalizeExpiration(value) {
  if (!value) {
    return null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
}

function notify(event) {
  if (!event) {
    return;
  }
  if (!subscribers.size) {
    pendingEvents.push(event);
    return;
  }
  subscribers.forEach(listener => {
    try {
      listener(event);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn('Auth subscriber error', error);
    }
  });
}

function flushPendingEvents(listener) {
  if (!pendingEvents.length || typeof listener !== 'function') {
    return;
  }
  while (pendingEvents.length) {
    const event = pendingEvents.shift();
    try {
      listener(event);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn('Auth subscriber error', error);
    }
  }
}

function subscribe(listener) {
  if (typeof listener !== 'function') {
    return () => {};
  }
  subscribers.add(listener);
  flushPendingEvents(listener);
  return () => {
    subscribers.delete(listener);
  };
}

function cancelExpiryTimer() {
  if (expiryTimer) {
    clearTimeout(expiryTimer);
    expiryTimer = null;
  }
}

function handleSessionExpired() {
  if (!state.token) {
    return;
  }
  resetSession();
  notify({
    type: 'expired',
    message: 'Sesi login telah berakhir. Silakan login kembali.'
  });
}

function scheduleExpiryCheck() {
  cancelExpiryTimer();
  if (!state.token || !state.expiresAt) {
    return;
  }
  const remaining = state.expiresAt - Date.now();
  if (remaining <= 0) {
    handleSessionExpired();
    return;
  }
  const delay = Math.min(remaining, MAX_TIMER_DELAY);
  expiryTimer = setTimeout(() => {
    expiryTimer = null;
    scheduleExpiryCheck();
  }, delay);
}

function checkTokenValidity() {
  if (!state.token) {
    return false;
  }
  if (!state.expiresAt) {
    return true;
  }
  if (state.expiresAt > Date.now()) {
    return true;
  }
  handleSessionExpired();
  return false;
}

function ensureInitialized() {
  if (state.initialized) {
    return;
  }
  if (typeof window === 'undefined') {
    state.initialized = true;
    return;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      state.token = parsed.token ?? null;
      state.refreshToken = parsed.refreshToken ?? null;
      state.user = parsed.user ?? null;
      state.expiresAt = normalizeExpiration(parsed.expiresAt ?? parsed.expires_at);
      state.credentials = sanitizeCredentials(parsed.credentials) ?? null;
    }
    if (state.token) {
      const valid = checkTokenValidity();
      if (valid && state.expiresAt) {
        scheduleExpiryCheck();
      }
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('Gagal memuat data login lokal', error);
    clearStorage();
  } finally {
    state.initialized = true;
  }
}

function persist() {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    const payload = {
      token: state.token,
      refreshToken: state.refreshToken,
      user: state.user,
      expiresAt: state.expiresAt,
      credentials: state.credentials
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('Tidak bisa menyimpan data login', error);
  }
}

function clearStorage() {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.removeItem(STORAGE_KEY);
}

async function login(credentials) {
  ensureInitialized();
  state.loading = true;
  state.error = null;

  try {
    const payload = await apiRequest('/v1/employee/login', {
      method: 'POST',
      data: credentials
    });

    if (payload?.success === false) {
      throw new ApiError(payload?.message || 'Login gagal', { status: 400, payload });
    }

    const data = payload?.data ?? {};
    const token = data.token || data.access_token || data?.token?.plainTextToken;
    if (!token) {
      throw new ApiError('Token tidak diterima dari server', { status: 422, payload });
    }
    const expiresRaw =
      data.expires_at ??
      (typeof data.expires_in === 'number' ? Date.now() + data.expires_in * 1000 : null);

    state.token = token;
    state.refreshToken = data.refresh_token ?? null;
    state.user = data.employee ?? data.user ?? null;
    state.expiresAt = normalizeExpiration(expiresRaw);
    state.error = null;
    state.credentials = sanitizeCredentials(credentials);

    scheduleExpiryCheck();
    persist();

    if (!state.user) {
      await fetchProfile();
    }

    return payload;
  } catch (error) {
    const message = error instanceof ApiError ? error.message : 'Terjadi kesalahan saat login';
    state.error = message;
    throw error;
  } finally {
    state.loading = false;
  }
}

async function fetchProfile() {
  if (!state.token) {
    return null;
  }
  try {
    const payload = await apiRequest('/v1/employee/profile', {
      method: 'GET',
      token: state.token
    });
    state.user = payload?.data ?? payload ?? null;
    persist();
    return state.user;
  } catch (error) {
    return null;
  }
}

async function validateToken() {
  if (!state.token) {
    return false;
  }
  try {
    await apiRequest('/v1/employee/validate-token', {
      method: 'POST',
      token: state.token
    });
    return true;
  } catch (error) {
    resetSession();
    return false;
  }
}

function resetSession({ keepCredentials = true } = {}) {
  state.token = null;
  state.refreshToken = null;
  state.user = null;
  state.expiresAt = null;
  state.error = null;
  cancelExpiryTimer();
  if (!keepCredentials) {
    state.credentials = null;
    clearStorage();
    return;
  }
  persist();
}

async function logout({ notifyServer = true } = {}) {
  ensureInitialized();
  const token = state.token;
  resetSession({ keepCredentials: false });
  if (notifyServer && token) {
    try {
      await apiRequest('/v1/employee/logout', {
        method: 'POST',
        token
      });
    } catch (error) {
      // Ignore logout failures
    }
  }
}

export function useAuthStore() {
  ensureInitialized();

  return {
    get token() {
      return state.token;
    },
    get user() {
      return state.user;
    },
    get refreshToken() {
      return state.refreshToken;
    },
    get expiresAt() {
      return state.expiresAt;
    },
    get loading() {
      return state.loading;
    },
    get error() {
      return state.error;
    },
    get isAuthenticated() {
      return Boolean(state.token);
    },
    get credentials() {
      return state.credentials;
    },
    async login(credentials) {
      return login(credentials);
    },
    async relogin() {
      if (!state.credentials) {
        throw new Error('Kredensial tidak tersedia');
      }
      return login({ ...state.credentials });
    },
    async logout(options) {
      return logout(options);
    },
    async fetchProfile() {
      return fetchProfile();
    },
    async validateToken() {
      return validateToken();
    },
    checkExpiration() {
      return checkTokenValidity();
    },
    subscribe(callback) {
      return subscribe(callback);
    },
    clearSession() {
      resetSession();
    }
  };
}
