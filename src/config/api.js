export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://sdm.visualdata.co.id/api';
export const API_TIMEOUT = parseInt(import.meta.env.VITE_API_TIMEOUT) || 15000;

export function buildApiUrl(path = '') {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}
