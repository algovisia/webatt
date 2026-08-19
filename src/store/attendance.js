import Vue from 'vue';
import { apiRequest, ApiError } from '../utils/apiClient';
import { useAuthStore } from './auth';
import { useGeofenceStore } from './geofence';
import { distanceInMeters } from '../utils/geo';

const CACHE_DURATION_MS = 60 * 1000;

const state = Vue.observable({
  records: [],
  loading: false,
  syncing: false,
  error: null,
  lastFetched: null,
  today: null,
  summary: null,
  lastTodayFetched: null,
  lastSummaryFetched: null,
  subscribers: []
});

const DEFAULT_TIMEZONE = 'Asia/Makassar';
const geofenceStore = useGeofenceStore();

const SUBMISSION_ENDPOINTS = {
  checkin: '/v1/attendance/check-in',
  checkout: '/v1/attendance/check-out',
  lembur: '/v1/attendance/overtime',
  dinas_luar: '/v1/attendance/check-in'
};

const DUPLICATE_MESSAGES = {
  checkin: 'Kamu sudah check-in hari ini',
  checkout: 'Kamu sudah check out hari ini',
  lembur: 'Kamu sudah memilih lembur hari ini'
};

function notify(message) {
  state.subscribers.forEach(fn => fn(message));
}

function parseCoordinates(value) {
  if (!value || typeof value !== 'string') {
    return null;
  }
  const [latRaw, lngRaw] = value.split(',').map(part => part.trim());
  const lat = Number(latRaw);
  const lng = Number(lngRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  return { lat, lng };
}

function extractCoordinates(...candidates) {
  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }
    if (typeof candidate === 'string') {
      const parsed = parseCoordinates(candidate);
      if (parsed) {
        return parsed;
      }
    } else if (
      typeof candidate === 'object' &&
      Number.isFinite(candidate.lat) &&
      Number.isFinite(candidate.lng)
    ) {
      return { lat: Number(candidate.lat), lng: Number(candidate.lng) };
    }
  }
  return null;
}

function toIsoString(date, time) {
  if (!date || !time) {
    return null;
  }
  const isoCandidate = `${date}T${time}`;
  const parsed = new Date(isoCandidate);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString();
}

function mapAttendanceEntry(entry) {
  if (!entry || typeof entry !== 'object') {
    return [];
  }

  const results = [];
  const baseId = entry.id ?? `attendance-${Math.random().toString(36).slice(2)}`;
  const baseNote = entry.notes || '';
  const checkInCoords = extractCoordinates(
    entry.check_in_location,
    entry.check_in_coordinates,
    entry.coordinates
  );
  const checkOutCoords = extractCoordinates(
    entry.check_out_location,
    entry.check_out_coordinates,
    entry.coordinates
  );
  const checkInLocationName = resolveLocationName(checkInCoords ?? entry.check_in_location, entry.location);
  const checkOutLocationName = resolveLocationName(checkOutCoords ?? entry.check_out_location, entry.location);

  if (entry.check_in_time) {
    results.push({
      id: `${baseId}-checkin`,
      type: 'checkin',
      timestamp: toIsoString(entry.date, entry.check_in_time),
      tz: DEFAULT_TIMEZONE,
      coords: checkInCoords,
      note: baseNote,
      synced: true,
      locationName: checkInLocationName,
      meta: entry
    });
  }

  if (entry.check_out_time) {
    results.push({
      id: `${baseId}-checkout`,
      type: 'checkout',
      timestamp: toIsoString(entry.date, entry.check_out_time),
      tz: DEFAULT_TIMEZONE,
      coords: checkOutCoords,
      note: baseNote,
      synced: true,
      locationName: checkOutLocationName,
      meta: entry
    });
  }

  if (entry.is_lembur || entry.status === 'Lembur') {
    results.push({
      id: `${baseId}-lembur`,
      type: 'lembur',
      timestamp: toIsoString(entry.date, entry.overtime_set_time || entry.check_out_time || entry.check_in_time),
      tz: DEFAULT_TIMEZONE,
      coords: checkOutCoords || checkInCoords,
      note: entry.notes || 'Lembur',
      synced: true,
      locationName: checkOutLocationName || checkInLocationName,
      meta: entry
    });
  }

  return results;
}

function mapSubmissionResponse(type, payload) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }
  const data = payload.data ?? {};
  const message = payload.message || null;
  const locationLabel = data.location ?? data.check_in_location ?? data.check_out_location ?? null;
  const timestamp =
    type === 'checkin'
      ? toIsoString(data.date, data.check_in_time)
      : type === 'checkout'
      ? toIsoString(data.date, data.check_out_time)
      : toIsoString(data.date, data.overtime_set_time || data.check_out_time || data.check_in_time);

  return {
    record: {
      id: `${data.attendance_id || Date.now()}-${type}`,
      type,
      timestamp,
      tz: DEFAULT_TIMEZONE,
      coords: extractCoordinates(
        data.coordinates,
        data.location_coordinates,
        data.check_in_location,
        data.check_out_location
      ),
      note: data.notes || '',
      synced: true,
      locationName: locationLabel ?? resolveLocationName(data.coordinates),
      meta: data
    },
    message
  };
}

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
}

function dateKeyFromTimestamp(timestamp) {
  if (!timestamp) {
    return null;
  }
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function hasTodayRecord(type) {
  const today = todayKey();
  const normalizedType = type === 'dinas_luar' ? 'checkin' : type;

  return state.records.some(record => {
    const recordKey = dateKeyFromTimestamp(record.timestamp);
    if (recordKey !== today) {
      return false;
    }
    if (normalizedType === 'checkin') {
      return record.type === 'checkin' || record.type === 'dinas_luar';
    }
    return record.type === normalizedType;
  });
}

function resolveLocationName(source, fallback = null) {
  let coords = null;
  if (typeof source === 'string') {
    coords = parseCoordinates(source);
  } else if (
    source &&
    typeof source === 'object' &&
    Number.isFinite(source.lat) &&
    Number.isFinite(source.lng)
  ) {
    coords = { lat: Number(source.lat), lng: Number(source.lng) };
  }

  if (!coords) {
    return fallback || null;
  }

  const locations = geofenceStore.locations;
  let nearest = null;

  locations.forEach(location => {
    if (!location || !location.center) {
      return;
    }
    const distance = distanceInMeters(coords, location.center);
    if (!Number.isFinite(distance)) {
      return;
    }
    if (!nearest || distance < nearest.distance) {
      nearest = { location, distance };
    }
  });

  if (nearest && nearest.distance <= nearest.location.radius) {
    return nearest.location.name;
  }

  return fallback || null;
}

async function fetchTodayRemote({ force = false } = {}) {
  const auth = useAuthStore();
  if (!auth.token) {
    state.today = null;
    state.lastTodayFetched = null;
    return null;
  }

  const now = Date.now();
  if (!force && state.today && state.lastTodayFetched && now - state.lastTodayFetched < CACHE_DURATION_MS) {
    return state.today;
  }

  try {
    const payload = await apiRequest('/v1/attendance/today', {
      token: auth.token
    });
    state.today = payload?.data ?? payload ?? null;
    state.lastTodayFetched = Date.now();
    return state.today;
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      state.today = null;
      state.lastTodayFetched = null;
      return null;
    }
    // eslint-disable-next-line no-console
    console.warn('Gagal mengambil ringkasan absensi hari ini', error);
    return null;
  }
}

async function fetchSummaryRemote({ force = false } = {}) {
  const auth = useAuthStore();
  if (!auth.token) {
    state.summary = null;
    state.lastSummaryFetched = null;
    return null;
  }

  const now = Date.now();
  if (!force && state.summary && state.lastSummaryFetched && now - state.lastSummaryFetched < CACHE_DURATION_MS) {
    return state.summary;
  }

  try {
    const payload = await apiRequest('/v1/attendance/summary', {
      token: auth.token
    });
    state.summary = payload?.data ?? payload ?? null;
    state.lastSummaryFetched = Date.now();
    return state.summary;
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      state.summary = null;
      state.lastSummaryFetched = null;
      return null;
    }
    // eslint-disable-next-line no-console
    console.warn('Gagal mengambil ringkasan absensi', error);
    return null;
  }
}

async function fetchHistory({ force = false } = {}, retried = false) {
  const auth = useAuthStore();
  if (!auth.token) {
    state.records = [];
    state.lastFetched = null;
    return [];
  }

  const now = Date.now();
  if (!force && state.lastFetched && now - state.lastFetched < CACHE_DURATION_MS) {
    return state.records;
  }

  state.loading = true;
  state.error = null;
  try {
    await geofenceStore.ensureLocations();
    const payload = await fetchHistoryRemote(auth);

    console.log(payload)
    const attendances = Array.isArray(payload?.data?.attendances)
      ? payload.data.attendances
      : Array.isArray(payload?.attendances)
      ? payload.attendances
      : [];
    const mapped = attendances.flatMap(mapAttendanceEntry).sort((a, b) => {
      const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return timeB - timeA;
    });
    state.records = mapped;
    state.lastFetched = now;

    console.log("store record : ",state.records)
    await fetchTodayRemote({ force: true });
    await fetchSummaryRemote({ force: true });
    return mapped;
  } catch (error) {
    console.log("error fetchHistory history", error)
    const message = (error?.message || '').toLowerCase();
    const invalidMessage = 'invalid or expired token';
    const shouldRetry =
      !retried &&
      ((message && message.includes(invalidMessage)) || (error instanceof ApiError && error.status === 401));
    if (shouldRetry) {
      const refreshed = await tryRefreshAuth(auth);
      if (refreshed) {
        return fetchHistory({ force: true }, true);
      }
    }
    state.error = error instanceof ApiError ? error.message : 'Gagal memuat riwayat absen';
    throw error;
  } finally {
    state.loading = false;
  }
}

async function fetchHistoryRemote(auth, retried = false) {
  await ensureValidAuthSession(auth);
  try {
    return await apiRequest('/v1/attendance/history', {
      token: auth.token
    });
  } catch (error) {
    console.log("error fetchHistory history", error)
    if (!retried && shouldRetryWithAuth(error)) {
      const refreshed = await tryRefreshAuth(auth);
      if (refreshed) {
        return fetchHistoryRemote(auth, true);
      }
    }
    throw error;
  }
}

async function ensureValidAuthSession(auth) {
  if (!auth || !auth.token) {
    throw new ApiError('Anda belum login', { status: 401 });
  }
  if (!isTokenExpired(auth)) {
    return;
  }
  const refreshed = await tryRefreshAuth(auth);
  if (refreshed) {
    return;
  }
  throw new ApiError('Sesi login telah berakhir. Silakan login kembali.', { status: 401 });
}

function isTokenExpired(auth) {
  if (!auth) {
    return false;
  }
  const expiresAt = typeof auth.expiresAt === 'number' ? auth.expiresAt : null;
  if (!Number.isFinite(expiresAt)) {
    return false;
  }
  return expiresAt <= Date.now();
}

function shouldRetryWithAuth(error) {
  if (!(error instanceof ApiError)) {
    return false;
  }
  return error.status === 401 || error.status === 419;
}

async function tryRefreshAuth(auth) {
  if (!auth || typeof auth.relogin !== 'function' || !auth.credentials) {
    return false;
  }
  await auth.relogin();
  return true;
}

async function submitAttendance(type, { coords, note, locationName, photoFile } = {}) {
  const auth = useAuthStore();
  if (!auth.token) {
    const err = new ApiError('Anda belum login', { status: 401 });
    notify(err.message);
    throw err;
  }

  const endpoint = SUBMISSION_ENDPOINTS[type];
  if (!endpoint) {
    throw new ApiError('Jenis absensi belum didukung', { status: 400 });
  }

  await geofenceStore.ensureLocations();
  const todayInfo = await fetchTodayRemote();
  const normalizedType = type === 'dinas_luar' ? 'checkin' : type;

  if (normalizedType === 'checkin') {
    if (todayInfo && todayInfo.has_attendance && todayInfo.can_check_in === false) {
      throw new ApiError(DUPLICATE_MESSAGES.checkin, { status: 409 });
    }
    if (hasTodayRecord(type)) {
      throw new ApiError(DUPLICATE_MESSAGES.checkin, { status: 409 });
    }
  } else if (normalizedType === 'checkout') {
    if (todayInfo && todayInfo.can_check_out === false) {
      throw new ApiError(DUPLICATE_MESSAGES.checkout, { status: 409 });
    }
    if (hasTodayRecord(type)) {
      throw new ApiError(DUPLICATE_MESSAGES.checkout, { status: 409 });
    }
  }

  const canUseFormData = typeof FormData !== 'undefined' && !!photoFile;
  const submissionPayload = canUseFormData ? new FormData() : {};
  const appendField = (key, value) => {
    if (value === undefined || value === null || value === '') {
      return;
    }
    if (canUseFormData) {
      submissionPayload.append(key, value);
    } else {
      submissionPayload[key] = value;
    }
  };

  if (coords) {
    appendField('latitude', coords.lat);
    appendField('longitude', coords.lng);
  }
  if (note) {
    appendField('notes', note);
  } else if (type === 'dinas_luar' && locationName) {
    appendField('notes', locationName);
  }

  if (canUseFormData && photoFile) {
    const filename =
      typeof photoFile.name === 'string' && photoFile.name.length
        ? photoFile.name
        : `attendance-${Date.now()}.jpg`;
    submissionPayload.append('foto', photoFile, filename);
  }

  if (type === 'dinas_luar') {
    appendField('attendance_type', 'dinas_luar');
  } else if (type === 'lembur') {
    appendField('attendance_type', 'lembur');
    appendField('overtime', canUseFormData ? '1' : true);
  }

  state.syncing = true;
  try {
    const response = await apiRequest(endpoint, {
      method: 'POST',
      data: submissionPayload,
      token: auth.token
    });
    console.log("response : ", response);
    const mapped = mapSubmissionResponse(type, response);
    await fetchHistory({ force: true });
    await fetchTodayRemote({ force: true });
    await fetchSummaryRemote({ force: true });
    notify(mapped?.message || response?.message || 'Absensi tercatat');
    return mapped?.record ?? null;
  } catch (error) {
    console.log('error : ', error);
    const message = error instanceof ApiError ? error.message : 'Gagal memproses absensi';
    notify(message);
    throw error instanceof ApiError ? error : new ApiError(message, { status: 0 });
  } finally {
    state.syncing = false;
  }
}

export function useAttendanceStore() {
  return {
    get records() {
      return state.records;
    },
    get loading() {
      return state.loading;
    },
    get syncing() {
      return state.syncing;
    },
    get error() {
      return state.error;
    },
    get today() {
      return state.today;
    },
    get summary() {
      return state.summary;
    },
    listRecords() {
      return [...state.records];
    },
    subscribe(callback) {
      state.subscribers.push(callback);
      return () => {
        state.subscribers = state.subscribers.filter(fn => fn !== callback);
      };
    },
    pushMessage(message) {
      notify(message);
    },
    async refresh(options) {
      return fetchHistory(options);
    },
    async fetchToday(options) {
      return fetchTodayRemote(options);
    },
    async fetchSummary(options) {
      return fetchSummaryRemote(options);
    },
    async submit(type, payload) {
      return submitAttendance(type, payload);
    },
    isReminderDismissedToday() {
      if (typeof window === 'undefined') return false;
      const today = todayKey();
      return window.localStorage.getItem(`webatt.reminder_dismissed_${today}`) === 'true';
    },
    dismissReminderToday() {
      if (typeof window === 'undefined') return;
      const today = todayKey();
      window.localStorage.setItem(`webatt.reminder_dismissed_${today}`, 'true');
    }
  };
}
