import { API_TIMEOUT, buildApiUrl } from '../config/api';

export class ApiError extends Error {
  constructor(message, { status, payload } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status ?? null;
    this.payload = payload ?? null;
  }
}

export async function apiRequest(path, options = {}) {
  const {
    method = 'GET',
    data,
    headers = {},
    token,
    timeout = API_TIMEOUT,
    signal,
    ...rest
  } = options;

  const requestConfig = {
    method,
    headers: {
      Accept: 'application/json',
      ...headers
    },
    ...rest
  };

  if (data !== undefined) {
    const isFormData =
      typeof FormData !== 'undefined' && data instanceof FormData;
    if (isFormData) {
      requestConfig.body = data;
    } else if (data instanceof URLSearchParams) {
      requestConfig.body = data;
      requestConfig.headers['Content-Type'] =
        requestConfig.headers['Content-Type'] ?? 'application/x-www-form-urlencoded;charset=UTF-8';
    } else if (data instanceof Blob || data instanceof ArrayBuffer) {
      requestConfig.body = data;
    } else {
      requestConfig.body = JSON.stringify(data);
      requestConfig.headers['Content-Type'] =
        requestConfig.headers['Content-Type'] ?? 'application/json';
    }
  }

  if (token) {
    requestConfig.headers.Authorization = `Bearer ${token}`;
  }

  const controller = signal ? null : new AbortController();
  let timeoutId = null;

  if (!signal && controller) {
    timeoutId = setTimeout(() => controller.abort(), timeout);
    requestConfig.signal = controller.signal;
  } else if (signal) {
    requestConfig.signal = signal;
  }

  try {
    const response = await fetch(buildApiUrl(path), requestConfig);
    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json') ? await response.json() : await response.text();

    if (!response.ok) {
      throw new ApiError(payload?.message || 'Permintaan API gagal', {
        status: response.status,
        payload
      });
    }

    return payload;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new ApiError('Permintaan ke server kedaluwarsa', { status: 0 });
    }
    throw error instanceof ApiError ? error : new ApiError(error.message, { status: 0 });
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}
