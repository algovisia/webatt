import Vue from 'vue';
import { apiRequest, ApiError } from '../utils/apiClient';
import { GEOFENCE_CENTER, GEOFENCE_RADIUS_METERS } from '../config/geofence';

const CACHE_DURATION_MS = 5 * 60 * 1000;

const state = Vue.observable({
  locations: [],
  loading: false,
  error: null,
  lastFetched: 0
});

function normalizeLocation(item, index) {
  if (!item || typeof item !== 'object') {
    return null;
  }

  const lat = Number(item.latitude ?? item.lat);
  const lng = Number(item.longitude ?? item.lng ?? item.long);
  const radius = Number(item.radius ?? item.default_radius ?? GEOFENCE_RADIUS_METERS);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  const safeRadius = Number.isFinite(radius) && radius > 0 ? radius : GEOFENCE_RADIUS_METERS;

  return {
    id: item.id_lokasi ?? item.id ?? `location-${index}`,
    name: item.lokasi_kerja ?? item.name ?? `Lokasi ${index + 1}`,
    center: { lat, lng },
    radius: safeRadius
  };
}

function fallbackLocations() {
  return [
    {
      id: 'fallback',
      name: 'Lokasi Default',
      center: { ...GEOFENCE_CENTER },
      radius: GEOFENCE_RADIUS_METERS
    }
  ];
}

async function fetchLocations({ force = false } = {}) {
  const now = Date.now();
  if (!force && state.locations.length && now - state.lastFetched < CACHE_DURATION_MS) {
    return state.locations;
  }

  state.loading = true;
  state.error = null;

  try {
    const payload = await apiRequest('/v1/locations');
    const data = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
    const normalized = data
      .map((item, index) => normalizeLocation(item, index))
      .filter(Boolean);

    state.locations = normalized.length ? normalized : fallbackLocations();
    state.lastFetched = Date.now();
  } catch (error) {
    state.error = error instanceof ApiError ? error.message : 'Gagal memuat lokasi absen';
    if (!state.locations.length) {
      state.locations = fallbackLocations();
    }
  } finally {
    state.loading = false;
  }

  return state.locations;
}

export function useGeofenceStore() {
  return {
    get locations() {
      return state.locations.length ? state.locations : fallbackLocations();
    },
    get loading() {
      return state.loading;
    },
    get error() {
      return state.error;
    },
    async fetchLocations(options = {}) {
      return fetchLocations(options);
    },
    async ensureLocations() {
      if (!state.locations.length) {
        await fetchLocations();
      } else if (Date.now() - state.lastFetched > CACHE_DURATION_MS) {
        fetchLocations().catch(() => {});
      }
      return state.locations;
    },
    clear() {
      state.locations = [];
      state.lastFetched = 0;
      state.error = null;
    }
  };
}
